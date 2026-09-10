import { inflateSync } from "node:zlib";
import {
  PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFStream,
} from "pdf-lib";

export interface FotoPdf {
  pagina: number;
  ancho: number;
  alto: number;
  /** El JPEG tal cual va incrustado en el PDF (flujo DCTDecode), sin recodificar. */
  jpeg: Uint8Array;
}

/** Una foto de celular mide al menos esto; el sello de la empresa mide 607 × 453. */
const LADO_MINIMO_FOTO = 800;
/** Una hoja trae tres o cuatro fotos; más que esto ya no es una hoja de levantamiento. */
const MAX_FOTOS = 30;
/** Las instrucciones de dibujo de una página mPDF pesan unos KB; con esto sobra. */
const MAX_CONTENIDO_PAGINA = 4 * 1024 * 1024;

/**
 * Fotos de evidencia incrustadas en el PDF, en orden de página.
 * Se descartan las imágenes de plantilla: las chicas y las que se pintan en
 * más de una página (el logo del encabezado).
 */
export async function extraerFotos(bytes: Uint8Array): Promise<FotoPdf[]> {
  const documento = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const usos = paginasPorImagen(documento);

  const fotos = [...usos.values()].flatMap(({ ref, paginas }) => {
    if (paginas.length !== 1) return [];
    const flujo = documento.context.lookup(ref);
    if (!(flujo instanceof PDFRawStream)) return [];
    const imagen = describirImagen(flujo);
    if (!imagen || Math.max(imagen.ancho, imagen.alto) < LADO_MINIMO_FOTO) return [];
    return [{ pagina: paginas[0], ancho: imagen.ancho, alto: imagen.alto, jpeg: flujo.contents }];
  });

  return fotos.sort((a, b) => a.pagina - b.pagina).slice(0, MAX_FOTOS);
}

/** Referencia de cada XObject de imagen y las páginas donde realmente se dibuja (`/Nombre Do`). */
function paginasPorImagen(documento: PDFDocument): Map<string, { ref: PDFRef; paginas: number[] }> {
  const usos = new Map<string, { ref: PDFRef; paginas: number[] }>();
  documento.getPages().forEach((pagina, indice) => {
    const xobjetos = pagina.node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
    if (!xobjetos) return;
    const referencias = new Map<string, PDFRef>();
    for (const [nombre, valor] of xobjetos.entries()) {
      if (valor instanceof PDFRef) referencias.set(nombre.toString(), valor);
    }
    const contenido = textoDeContenido(documento, pagina.node.Contents());
    for (const coincidencia of contenido.matchAll(/(\/[^\s/[\]<>()]+)\s+Do\b/g)) {
      const ref = referencias.get(coincidencia[1]);
      if (!ref) continue;
      const actual = usos.get(ref.toString()) ?? { ref, paginas: [] };
      const paginas = actual.paginas.includes(indice + 1)
        ? actual.paginas
        : [...actual.paginas, indice + 1];
      usos.set(ref.toString(), { ref, paginas });
    }
  });
  return usos;
}

function textoDeContenido(documento: PDFDocument, contenido: PDFStream | PDFArray | undefined): string {
  if (!contenido) return "";
  const flujos = contenido instanceof PDFArray
    ? contenido.asArray().map((ref) => documento.context.lookup(ref))
    : [contenido];
  return flujos
    .map((flujo) => {
      if (flujo instanceof PDFRawStream) return descomprimirAcotado(flujo);
      if (flujo instanceof PDFStream) return Buffer.from(flujo.getContents()).toString("latin1");
      return "";
    })
    .join("\n");
}

/**
 * Descomprime el flujo con zlib de Node y tope de salida. El decodificador de
 * pdf-lib infla sin límite, y un PDF malicioso de unos KB podría pedirle gigas
 * (bomba de compresión). Otros filtros no se descomprimen: esa página se salta.
 */
function descomprimirAcotado(flujo: PDFRawStream): string {
  const filtro = flujo.dict.get(PDFName.of("Filter"));
  try {
    if (filtro === undefined) return Buffer.from(flujo.contents).toString("latin1");
    if (filtro === PDFName.of("FlateDecode")) {
      return inflateSync(flujo.contents, { maxOutputLength: MAX_CONTENIDO_PAGINA }).toString("latin1");
    }
    return "";
  } catch {
    return "";
  }
}

/** Sólo interesan imágenes JPEG puras (DCTDecode): el flujo ya es un archivo .jpg. */
function describirImagen(flujo: PDFRawStream): { ancho: number; alto: number } | null {
  const dict = flujo.dict;
  if (dict.get(PDFName.of("Subtype")) !== PDFName.of("Image")) return null;
  if (dict.get(PDFName.of("Filter")) !== PDFName.of("DCTDecode")) return null;
  const ancho = dict.lookupMaybe(PDFName.of("Width"), PDFNumber)?.asNumber();
  const alto = dict.lookupMaybe(PDFName.of("Height"), PDFNumber)?.asNumber();
  if (!ancho || !alto) return null;
  return { ancho, alto };
}
