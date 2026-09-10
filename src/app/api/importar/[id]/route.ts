import { NextResponse } from "next/server";
import { leerSesion } from "@/lib/auth/sesion";
import { borrarImportacion, importacionPorId } from "@/lib/consultas/importaciones";
import { borrarArchivosImportacion } from "@/lib/importacion/archivos";

/** Descarta una importación que no llegó a levantamiento: borra su PDF, sus fotos y el renglón. */
export async function DELETE(_peticion: Request, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });

  const { id } = await contexto.params;
  const idImportacion = Number(id);
  if (!Number.isInteger(idImportacion) || idImportacion <= 0) {
    return NextResponse.json({ mensaje: "Importación inválida." }, { status: 400 });
  }

  const importacion = await importacionPorId(idImportacion);
  if (!importacion) return NextResponse.json({ mensaje: "La importación no existe." }, { status: 404 });
  if (importacion.Estado === "APLICADA") {
    return NextResponse.json(
      { mensaje: "Esta importación ya generó un levantamiento; no se puede descartar." },
      { status: 409 },
    );
  }

  try {
    // Primero la base, condicionada a que no esté aplicada; los archivos sólo después.
    const borrada = await borrarImportacion(idImportacion);
    if (!borrada) {
      return NextResponse.json(
        { mensaje: "Esta importación ya generó un levantamiento; no se puede descartar." },
        { status: 409 },
      );
    }
    await borrarArchivosImportacion(idImportacion);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`No se pudo descartar la importación ${idImportacion}:`, error);
    return NextResponse.json({ mensaje: "No se pudo descartar la importación." }, { status: 500 });
  }
}
