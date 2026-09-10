import path from "node:path";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { leerSesion } from "@/lib/auth/sesion";
import { actualizarImportacion, crearImportacion } from "@/lib/consultas/importaciones";
import {
  TAMANO_MAXIMO_EXCEL, borrarArchivosImportacion, carpetaImportacion, esExcel, esExcelViejo,
  guardarArchivo, nombreSeguro,
} from "@/lib/importacion/archivos";
import { ErrorDeImportacion } from "@/lib/importacion/errores";
import { interpretarCosteo } from "@/lib/importacion/excel/interpretar";
import { verificarZipSeguro } from "@/lib/importacion/excel/zip-seguro";
import type { PaqueteImportacionExcel } from "@/lib/importacion/excel/tipos";
import { recibirArchivo } from "@/lib/importacion/subida";

/**
 * Recibe el Excel de costeo de 12 hojas, lo interpreta y deja el resultado en
 * `tblImportaciones` en estado REVISION. La cotización y el costeo se crean
 * cuando alguien revisa y guarda desde /dashboard/importar/[id].
 */
export async function POST(peticion: Request) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });

  const archivo = await recibirArchivo(peticion);
  if (!archivo) return NextResponse.json({ mensaje: "Adjunta un archivo de Excel (.xlsx)." }, { status: 400 });
  if (archivo.bytes.length > TAMANO_MAXIMO_EXCEL) {
    return NextResponse.json({ mensaje: "El Excel pesa más de 10 MB." }, { status: 413 });
  }
  const { bytes } = archivo;
  if (esExcelViejo(archivo.nombre, bytes)) {
    return NextResponse.json(
      { mensaje: "Es un Excel de formato viejo (.xls). Ábrelo y guárdalo como .xlsx para importarlo." },
      { status: 400 },
    );
  }
  if (!esExcel(archivo.nombre, bytes)) {
    return NextResponse.json({ mensaje: "Sólo se aceptan archivos .xlsx." }, { status: 400 });
  }
  // Antes de que exceljs lo infle entero: cada entrada del ZIP con tope de tamaño.
  try {
    verificarZipSeguro(bytes);
  } catch (error) {
    const mensaje = error instanceof ErrorDeImportacion ? error.message : "El archivo no es un .xlsx válido.";
    return NextResponse.json({ mensaje }, { status: 400 });
  }

  const nombre = nombreSeguro(archivo.nombre);
  const idImportacion = await crearImportacion({ archivo: nombre, tipo: "EXCEL", idUsuario: sesion.idUsuario });

  try {
    await guardarArchivo(path.join(carpetaImportacion(idImportacion), "original.xlsx"), bytes);
    const libro = new ExcelJS.Workbook();
    // exceljs declara su propio tipo Buffer; el de Node es compatible en tiempo de ejecución.
    await libro.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof libro.xlsx.load>[0]);
    const datos = interpretarCosteo(libro);
    if (datos.noCotizacion === null && !datos.descripcion && datos.nomina.length === 0) {
      throw new ErrorDeImportacion("El archivo no parece el Excel de costeo de Servicios de Altura.");
    }
    const paquete: PaqueteImportacionExcel = { version: 1, tipo: "EXCEL", datos };
    await actualizarImportacion(idImportacion, {
      estado: "REVISION",
      json: JSON.stringify(paquete),
      mensaje: resumen(paquete),
    });
    return NextResponse.json({ ok: true, idImportacion, avisos: datos.avisos });
  } catch (error) {
    console.error(`Importación ${idImportacion} (${nombre}) falló:`, error);
    const mensaje = error instanceof ErrorDeImportacion
      ? error.message
      : "No se pudo leer el Excel: está dañado o no es el libro de costeo.";
    await actualizarImportacion(idImportacion, { estado: "ERROR", mensaje: mensaje.slice(0, 500) });
    await borrarArchivosImportacion(idImportacion); // el archivo fallido no se queda ocupando disco
    return NextResponse.json({ mensaje, idImportacion }, { status: 422 });
  }
}

function resumen(paquete: PaqueteImportacionExcel): string {
  const d = paquete.datos;
  const personas = d.nomina.filter((p) => p.dias > 0).length;
  return `Cotización ${d.noCotizacion ?? "?"} · folio ${d.folio ?? "?"} · ${personas} personas · ${d.insumos.length} insumos`;
}
