import { NextResponse } from "next/server";
import { z } from "zod";
import { enTransaccion } from "@/lib/db";
import { leerSesion } from "@/lib/auth/sesion";
import { resolverCliente } from "@/lib/costeo/guardar";
import { borrarLevantamiento } from "@/lib/borrar";
import { ErrorDeNegocio } from "@/lib/errores";
import { cotizarLevantamiento } from "@/lib/levantamientos/cotizar";
import {
  EsquemaActividades, EsquemaCosteoCaptura, EsquemaInsumosLevantamiento, EsquemaLevantamiento, EsquemaPersonal,
} from "@/lib/levantamientos/esquemas";
import {
  actualizarLevantamiento, bloquearLevantamiento, borrarDetalleLevantamiento, insertarDetalleLevantamiento,
} from "@/lib/levantamientos/guardar";

const Entrada = z.object({
  levantamiento: EsquemaLevantamiento,
  actividades: EsquemaActividades,
  personal: EsquemaPersonal,
  insumos: EsquemaInsumosLevantamiento,
  /** Si viene y el levantamiento aún no tiene cotización, se genera aquí mismo. */
  costeo: EsquemaCosteoCaptura.nullable().optional(),
});

/**
 * Edición completa: encabezado y detalle. Si ya tiene cotización, ésta no se
 * toca (se edita en su propia pantalla); si no la tiene y el paso 4 mandó
 * costeo, se generan cotización y costeo como en el alta.
 */
export async function PUT(peticion: Request, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });

  const { id } = await contexto.params;
  const idLev = Number(id);
  if (!Number.isInteger(idLev) || idLev <= 0) {
    return NextResponse.json({ mensaje: "Levantamiento inválido." }, { status: 400 });
  }
  const cuerpo = Entrada.safeParse(await peticion.json().catch(() => null));
  if (!cuerpo.success) {
    return NextResponse.json(
      { mensaje: "Datos incompletos o inválidos.", detalle: cuerpo.error.issues.slice(0, 3) },
      { status: 400 },
    );
  }
  const d = cuerpo.data;

  try {
    const resultado = await enTransaccion(async (cx) => {
      const actual = await bloquearLevantamiento(cx, idLev);
      const idCliente = await resolverCliente(cx, {
        idCliente: d.levantamiento.idCliente, clienteNuevo: d.levantamiento.clienteNuevo,
        contacto: d.levantamiento.usuarioContacto, correo: d.levantamiento.correoUsuario,
      });
      await actualizarLevantamiento(cx, actual, d.levantamiento, idCliente);
      await borrarDetalleLevantamiento(cx, idLev);
      await insertarDetalleLevantamiento(cx, idLev, d);

      const ids = d.costeo && actual.NoCotizacion === null
        ? await cotizarLevantamiento(cx, {
            idLev, idCliente, lev: d.levantamiento, costeo: d.costeo, personal: d.personal,
            insumos: d.insumos, idUsuario: sesion.idUsuario, exacto: false,
          })
        : null;
      if (ids) {
        await cx.query("UPDATE tblLevantamientos SET Status = 'COTIZADO' WHERE IdLevantamiento = ?", [idLev]);
      }
      await cx.query(
        "INSERT INTO tblBitacora (IdUsuario, Entidad, IdEntidad, Accion, Detalle) VALUES (?, 'LEVANTAMIENTO', ?, 'EDICION', ?)",
        [sesion.idUsuario, idLev, ids ? `Folio ${actual.Folio} editado y cotizado (${ids.noCotizacion})` : `Folio ${actual.Folio} editado`],
      );
      return ids;
    });
    return NextResponse.json({ ok: true, idLevantamiento: idLev, idCosteo: resultado?.idCosteo ?? null });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      return NextResponse.json({ mensaje: error.message }, { status: error.estado });
    }
    console.error(`Error al editar levantamiento ${idLev}:`, error);
    return NextResponse.json({ mensaje: "No se pudo guardar el levantamiento." }, { status: 500 });
  }
}

/** Borra el levantamiento y, si los tiene, su cotización y costeo. */
export async function DELETE(_peticion: Request, contexto: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });
  const { id } = await contexto.params;
  const idLev = Number(id);
  if (!Number.isInteger(idLev) || idLev <= 0) return NextResponse.json({ mensaje: "Levantamiento inválido." }, { status: 400 });
  try {
    await enTransaccion(async (cx) => {
      const r = await borrarLevantamiento(cx, idLev);
      await cx.query(
        "INSERT INTO tblBitacora (IdUsuario, Entidad, IdEntidad, Accion, Detalle) VALUES (?, 'LEVANTAMIENTO', ?, 'BAJA', ?)",
        [sesion.idUsuario, idLev, r.detalle],
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) return NextResponse.json({ mensaje: error.message }, { status: error.estado });
    console.error(`Error al borrar levantamiento ${idLev}:`, error);
    return NextResponse.json({ mensaje: "No se pudo borrar el levantamiento." }, { status: 500 });
  }
}
