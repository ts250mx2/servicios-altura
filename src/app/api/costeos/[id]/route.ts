import { NextResponse } from "next/server";
import { enTransaccion } from "@/lib/db";
import { leerSesion } from "@/lib/auth/sesion";
import { armarDetalleCosteo } from "@/lib/costeo/armar";
import { precioMandaDesdeCotizacion } from "@/lib/cotizaciones/guardar";
import { EsquemaCosteoCompleto } from "@/lib/costeo/esquemas";
import { reemplazarCosteo } from "@/lib/costeo/guardar";
import { borrarCosteo } from "@/lib/borrar";
import { ErrorDeNegocio } from "@/lib/errores";

/** Edición completa del costeo y del encabezado de su cotización. Se recalcula todo en el servidor. */
export async function PUT(peticion: Request, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });

  const { id } = await contexto.params;
  const idCosteo = Number(id);
  if (!Number.isInteger(idCosteo) || idCosteo <= 0) {
    return NextResponse.json({ mensaje: "Costeo inválido." }, { status: 400 });
  }
  const cuerpo = EsquemaCosteoCompleto.safeParse(await peticion.json().catch(() => null));
  if (!cuerpo.success) {
    return NextResponse.json(
      { mensaje: "Datos incompletos o inválidos.", detalle: cuerpo.error.issues.slice(0, 3) },
      { status: 400 },
    );
  }
  const d = cuerpo.data;
  if (d.precioVenta <= 0) {
    return NextResponse.json({ mensaje: "Captura el precio de venta antes de guardar." }, { status: 400 });
  }
  const statusCosteo = d.statusCosteo ?? (d.conceptosReal ? "EN_PROCESO" : "PLANEADO");
  if (statusCosteo !== "PLANEADO" && d.statusCotizacion !== "AUTORIZADA") {
    return NextResponse.json(
      { mensaje: "Para poner el costeo en obra o cerrarlo, la cotización debe estar autorizada." },
      { status: 400 },
    );
  }

  try {
    await enTransaccion(async (cx) => {
      const [filas] = await cx.query(
        `SELECT cs.IdCosteo, cs.IdCotizacion, co.NoCotizacion, co.IvaPct
           FROM tblCosteos cs JOIN tblCotizaciones co ON co.IdCotizacion = cs.IdCotizacion
          WHERE cs.IdCosteo = ? FOR UPDATE`,
        [idCosteo],
      );
      const actual = (filas as { IdCosteo: number; IdCotizacion: number; NoCotizacion: number; IvaPct: number }[])[0];
      if (!actual) throw new ErrorDeNegocio("El costeo no existe.", 404);

      // Con varias partidas o descuento, el precio lo define la cotización, no este editor.
      const precioCotizacion = await precioMandaDesdeCotizacion(cx, actual.IdCotizacion);
      const datos = precioCotizacion === null ? d : { ...d, precioVenta: precioCotizacion };

      await reemplazarCosteo(
        cx,
        { idCosteo, idCotizacion: actual.IdCotizacion },
        {
          idVendedor: d.idVendedor, fecha: d.fecha, descripcion: d.descripcion,
          status: d.statusCotizacion, autorizadoPor: d.autorizadoPor || null, ivaPct: Number(actual.IvaPct) || 16,
        },
        armarDetalleCosteo(datos),
        precioCotizacion !== null,
      );
      await cx.query(
        "INSERT INTO tblBitacora (IdUsuario, Entidad, IdEntidad, Accion, Detalle) VALUES (?, 'COSTEO', ?, 'EDICION', ?)",
        [sesion.idUsuario, idCosteo, `Cotización ${actual.NoCotizacion} recalculada`],
      );
    });
    return NextResponse.json({ ok: true, idCosteo });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      return NextResponse.json({ mensaje: error.message }, { status: error.estado });
    }
    console.error(`Error al editar costeo ${idCosteo}:`, error);
    return NextResponse.json({ mensaje: "No se pudo guardar el costeo." }, { status: 500 });
  }
}

/** Borra sólo el costeo; la cotización se queda. */
export async function DELETE(_peticion: Request, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });
  const { id } = await contexto.params;
  const idCosteo = Number(id);
  if (!Number.isInteger(idCosteo) || idCosteo <= 0) return NextResponse.json({ mensaje: "Costeo inválido." }, { status: 400 });
  try {
    await enTransaccion(async (cx) => {
      const r = await borrarCosteo(cx, idCosteo);
      await cx.query(
        "INSERT INTO tblBitacora (IdUsuario, Entidad, IdEntidad, Accion, Detalle) VALUES (?, 'COSTEO', ?, 'BAJA', ?)",
        [sesion.idUsuario, idCosteo, r.detalle],
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) return NextResponse.json({ mensaje: error.message }, { status: error.estado });
    console.error(`Error al borrar costeo ${idCosteo}:`, error);
    return NextResponse.json({ mensaje: "No se pudo borrar el costeo." }, { status: 500 });
  }
}
