import path from "node:path";
import { NextResponse } from "next/server";
import { leerSesion } from "@/lib/auth/sesion";
import { actualizarImportacion, crearImportacion } from "@/lib/consultas/importaciones";
import {
  TAMANO_MAXIMO_PDF, borrarArchivosImportacion, carpetaImportacion, esPdf, guardarArchivo, nombreSeguro,
} from "@/lib/importacion/archivos";
import { ErrorDeImportacion } from "@/lib/importacion/errores";
import { guardarEvidencias } from "@/lib/importacion/evidencias";
import { interpretarLevantamiento } from "@/lib/importacion/interpretar";
import { recibirArchivo } from "@/lib/importacion/subida";
import { extraerPaginas } from "@/lib/importacion/texto-pdf";
import type { PaqueteImportacion } from "@/lib/importacion/tipos";

/**
 * Recibe la hoja de levantamiento en PDF, la interpreta y deja el resultado en
 * `tblImportaciones` en estado REVISION. No crea ningún levantamiento: eso pasa
 * cuando alguien revisa y guarda desde /dashboard/importar/[id].
 */
export async function POST(peticion: Request) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });

  const archivo = await recibirArchivo(peticion);
  if (!archivo) return NextResponse.json({ mensaje: "Adjunta un archivo PDF." }, { status: 400 });
  if (archivo.bytes.length > TAMANO_MAXIMO_PDF) {
    return NextResponse.json({ mensaje: "El PDF pesa más de 40 MB." }, { status: 413 });
  }
  const { bytes } = archivo;
  if (!esPdf(archivo.nombre, archivo.tipo, bytes)) {
    return NextResponse.json({ mensaje: "Sólo se aceptan archivos PDF." }, { status: 400 });
  }

  const nombre = nombreSeguro(archivo.nombre);
  const idImportacion = await crearImportacion({ archivo: nombre, tipo: "PDF", idUsuario: sesion.idUsuario });

  try {
    await guardarArchivo(path.join(carpetaImportacion(idImportacion), "original.pdf"), bytes);
    const datos = interpretarLevantamiento(await extraerPaginas(bytes));
    if (datos.folio === null && !datos.proyecto && datos.actividades.length === 0) {
      throw new ErrorDeImportacion("El archivo no parece una hoja de levantamiento de Servicios de Altura.");
    }
    const [evidencias, avisosFotos] = await evidenciasSeguras(idImportacion, bytes);
    const paquete: PaqueteImportacion = {
      version: 1,
      datos: { ...datos, avisos: [...datos.avisos, ...avisosFotos] },
      evidencias,
    };
    await actualizarImportacion(idImportacion, {
      estado: "REVISION",
      json: JSON.stringify(paquete),
      mensaje: resumen(paquete),
    });
    return NextResponse.json({ ok: true, idImportacion, avisos: paquete.datos.avisos });
  } catch (error) {
    // El detalle (rutas, errores de pdf.js o de MySQL) se queda en el servidor.
    console.error(`Importación ${idImportacion} (${nombre}) falló:`, error);
    const mensaje = error instanceof ErrorDeImportacion
      ? error.message
      : "No se pudo leer el PDF: está dañado o no es una hoja de levantamiento.";
    await actualizarImportacion(idImportacion, { estado: "ERROR", mensaje: mensaje.slice(0, 500) });
    await borrarArchivosImportacion(idImportacion); // el archivo fallido no se queda ocupando disco
    return NextResponse.json({ mensaje, idImportacion }, { status: 422 });
  }
}

/** Las fotos no deben tumbar la importación: si fallan, se avisa y se sigue con el texto. */
async function evidenciasSeguras(id: number, bytes: Uint8Array): Promise<[string[], string[]]> {
  try {
    return [await guardarEvidencias(id, bytes), []];
  } catch (error) {
    console.error(`No se pudieron extraer las fotos de la importación ${id}:`, error);
    return [[], ["No se pudieron extraer las fotos del PDF; súbelas a mano después."]];
  }
}

function resumen(paquete: PaqueteImportacion): string {
  const d = paquete.datos;
  const partidas = d.insumos.length + d.herramental.length;
  return `Folio ${d.folio ?? "?"} · ${d.actividades.length} actividades · ${partidas} partidas · ${paquete.evidencias.length} fotos`;
}
