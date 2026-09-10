import { inflateRawSync } from "node:zlib";
import { ErrorDeImportacion } from "../errores";

/**
 * Un .xlsx es un ZIP y exceljs lo infla entero sin tope, así que un archivo de
 * unos KB podría pedir gigas de memoria (bomba de compresión). Antes de
 * entregárselo, aquí se recorre el directorio central y se infla cada entrada
 * con zlib y límite de salida. Un libro de costeo real pesa unos 50 KB y se
 * infla a menos de 1 MB; los topes dejan margen de sobra.
 */
export interface LimitesZip {
  maxEntradas: number;
  maxPorEntrada: number;
  maxTotal: number;
}

export const LIMITES_ZIP: LimitesZip = {
  maxEntradas: 500,
  maxPorEntrada: 24 * 1024 * 1024,
  maxTotal: 64 * 1024 * 1024,
};

const FIRMA_FIN_DIRECTORIO = 0x06054b50;
const FIRMA_ENTRADA_CENTRAL = 0x02014b50;
const FIRMA_ENCABEZADO_LOCAL = 0x04034b50;
const METODO_ALMACENADO = 0;
const METODO_DEFLATE = 8;
/** El registro de fin de directorio mide 22 bytes más un comentario de hasta 64 KB. */
const MAX_BUSQUEDA_FIN = 22 + 65535;

/** Lanza `ErrorDeImportacion` si el ZIP no es sano; si regresa, exceljs lo puede leer sin riesgo. */
export function verificarZipSeguro(bytes: Uint8Array, limites = LIMITES_ZIP): void {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fin = buscarFinDirectorio(vista);
  if (fin < 0) throw new ErrorDeImportacion("El archivo no es un .xlsx válido (falta el directorio del ZIP).");

  const entradas = vista.getUint16(fin + 10, true);
  const inicioDirectorio = vista.getUint32(fin + 16, true);
  if (entradas > limites.maxEntradas) {
    throw new ErrorDeImportacion(`El archivo trae ${entradas} partes internas; un libro de costeo tiene unas 30.`);
  }

  let posicion = inicioDirectorio;
  let totalInflado = 0;
  for (let i = 0; i < entradas; i++) {
    if (posicion + 46 > bytes.byteLength || vista.getUint32(posicion, true) !== FIRMA_ENTRADA_CENTRAL) {
      throw new ErrorDeImportacion("El archivo no es un .xlsx válido (directorio del ZIP dañado).");
    }
    const metodo = vista.getUint16(posicion + 10, true);
    const tamanoComprimido = vista.getUint32(posicion + 20, true);
    const tamanoDeclarado = vista.getUint32(posicion + 24, true);
    const largoNombre = vista.getUint16(posicion + 28, true);
    const largoExtra = vista.getUint16(posicion + 30, true);
    const largoComentario = vista.getUint16(posicion + 32, true);
    const inicioLocal = vista.getUint32(posicion + 42, true);

    if (tamanoDeclarado === 0xffffffff || tamanoComprimido === 0xffffffff) {
      throw new ErrorDeImportacion("El archivo usa ZIP64; un libro de costeo nunca es tan grande.");
    }
    if (tamanoDeclarado > limites.maxPorEntrada) {
      throw new ErrorDeImportacion("Una parte interna del archivo es demasiado grande para ser un libro de costeo.");
    }
    totalInflado += inflarAcotado(bytes, vista, { inicioLocal, metodo, tamanoComprimido, tamanoDeclarado });
    if (totalInflado > limites.maxTotal) {
      throw new ErrorDeImportacion("El archivo se expande demasiado al abrirse; no parece un libro de costeo.");
    }
    posicion += 46 + largoNombre + largoExtra + largoComentario;
  }
}

/** Busca la firma de fin de directorio desde el final; el comentario del ZIP puede empujarla hacia atrás. */
function buscarFinDirectorio(vista: DataView): number {
  const minimo = Math.max(0, vista.byteLength - MAX_BUSQUEDA_FIN);
  for (let p = vista.byteLength - 22; p >= minimo; p--) {
    if (vista.getUint32(p, true) === FIRMA_FIN_DIRECTORIO) return p;
  }
  return -1;
}

/**
 * Infla la entrada con `maxOutputLength` igual a lo declarado: si el flujo real
 * produce más de lo que el directorio dice, zlib corta y se rechaza el archivo.
 * Devuelve los bytes que ocupa inflada.
 */
function inflarAcotado(
  bytes: Uint8Array,
  vista: DataView,
  entrada: { inicioLocal: number; metodo: number; tamanoComprimido: number; tamanoDeclarado: number },
): number {
  const { inicioLocal, metodo, tamanoComprimido, tamanoDeclarado } = entrada;
  if (inicioLocal + 30 > bytes.byteLength || vista.getUint32(inicioLocal, true) !== FIRMA_ENCABEZADO_LOCAL) {
    throw new ErrorDeImportacion("El archivo no es un .xlsx válido (entrada del ZIP dañada).");
  }
  const largoNombre = vista.getUint16(inicioLocal + 26, true);
  const largoExtra = vista.getUint16(inicioLocal + 28, true);
  const inicioDatos = inicioLocal + 30 + largoNombre + largoExtra;
  if (inicioDatos + tamanoComprimido > bytes.byteLength) {
    throw new ErrorDeImportacion("El archivo está truncado o dañado.");
  }
  if (metodo === METODO_ALMACENADO) return tamanoComprimido;
  if (metodo !== METODO_DEFLATE) {
    throw new ErrorDeImportacion("El archivo usa una compresión que no es la de Excel.");
  }
  try {
    const inflado = inflateRawSync(bytes.subarray(inicioDatos, inicioDatos + tamanoComprimido), {
      maxOutputLength: Math.max(1, tamanoDeclarado),
    });
    return inflado.byteLength;
  } catch {
    throw new ErrorDeImportacion("Una parte interna del archivo se expande más de lo que declara; se rechaza por seguridad.");
  }
}
