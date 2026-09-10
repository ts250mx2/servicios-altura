import { NextResponse } from "next/server";
import { enTransaccion } from "@/lib/db";
import { leerSesion } from "@/lib/auth/sesion";
import { recalcularPrecioCosteo } from "@/lib/costeo/recalcular";
import { EsquemaCotizacion } from "@/lib/cotizaciones/esquemas";
import { actualizarCotizacion } from "@/lib/cotizaciones/guardar";
import { borrarCotizacion } from "@/lib/borrar";
import { ErrorDeNegocio } from "@/lib/errores";

/**
 * Edición comercial de la cotización: fecha, vigencia, condiciones, partidas,
 * descuento y estatus. Si tiene costeo, éste se recalcula con el nuevo precio.
 */
export async function PUT(peticion: Request, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });

  const { id } = await contexto.params;
  const idCotizacion = Number(id);
  if (!Number.isInteger(idCotizacion) || idCotizacion <= 0) {
    return NextResponse.json({ mensaje: "Cotización inválida." }, { status: 400 });
  }
  const cuerpo = EsquemaCotizacion.safeParse(await peticion.json().catch(() => null));
  if (!cuerpo.success) {
    return NextResponse.json(
      { mensaje: "Datos incompletos o inválidos.", detalle: cuerpo.error.issues.slice(0, 3) },
      { status: 400 },
    );
  }

  try {
    const resultado = await enTransaccion(async (cx) => {
      const r = await actualizarCotizacion(cx, idCotizacion, cuerpo.data);
      if (r.idCosteo) await recalcularPrecioCosteo(cx, r.idCosteo, r.base);
      await cx.query(
        "INSERT INTO tblBitacora (IdUsuario, Entidad, IdEntidad, Accion, Detalle) VALUES (?, 'COTIZACION', ?, 'EDICION', ?)",
        [sesion.idUsuario, idCotizacion, `Cotización ${r.noCotizacion} editada (${cuerpo.data.status})`],
      );
      return r;
    });
    return NextResponse.json({ ok: true, idCotizacion, precioVenta: resultado.base });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      return NextResponse.json({ mensaje: error.message }, { status: error.estado });
    }
    console.error(`Error al editar cotización ${idCotizacion}:`, error);
    return NextResponse.json({ mensaje: "No se pudo guardar la cotización." }, { status: 500 });
  }
}

/** Borra la cotización y su costeo; el levantamiento regresa a «listo para cotizar». */
export async function DELETE(_peticion: Request, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });
  const { id } = await contexto.params;
  const idCotizacion = Number(id);
  if (!Number.isInteger(idCotizacion) || idCotizacion <= 0) return NextResponse.json({ mensaje: "Cotización inválida." }, { status: 400 });
  try {
    await enTransaccion(async (cx) => {
      const r = await borrarCotizacion(cx, idCotizacion);
      await cx.query(
        "INSERT INTO tblBitacora (IdUsuario, Entidad, IdEntidad, Accion, Detalle) VALUES (?, 'COTIZACION', ?, 'BAJA', ?)",
        [sesion.idUsuario, idCotizacion, r.detalle],
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) return NextResponse.json({ mensaje: error.message }, { status: error.estado });
    console.error(`Error al borrar cotización ${idCotizacion}:`, error);
    return NextResponse.json({ mensaje: "No se pudo borrar la cotización." }, { status: 500 });
  }
}
