import type { PoolConnection } from "mysql2/promise";
import { ErrorDeNegocio } from "@/lib/errores";
import type { DatosLevantamiento, DetalleLevantamiento } from "./esquemas";

/** Actividades, personal e insumos del levantamiento, en ese orden. */
export async function insertarDetalleLevantamiento(
  cx: PoolConnection,
  idLev: number,
  d: DetalleLevantamiento,
): Promise<void> {
  for (const [i, a] of d.actividades.entries()) {
    await cx.query(
      "INSERT INTO tblLevantamientoActividades (IdLevantamiento, Orden, Descripcion, Metros) VALUES (?, ?, ?, ?)",
      [idLev, i + 1, a.descripcion, a.metros],
    );
  }
  for (const p of d.personal) {
    await cx.query(
      "INSERT INTO tblLevantamientoPersonal (IdLevantamiento, IdPuesto, Cantidad, TiempoExtra, Bono) VALUES (?, ?, ?, ?, ?)",
      [idLev, p.idPuesto, p.cantidad, p.tiempoExtra ? 1 : 0, p.bono ? 1 : 0],
    );
  }
  for (const i of d.insumos) {
    await cx.query(
      `INSERT INTO tblLevantamientoInsumos
         (IdLevantamiento, IdInsumo, Descripcion, Cantidad, EsHerramental, Aplica)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idLev, i.idInsumo, i.descripcion, i.cantidad, i.esHerramental ? 1 : 0, i.aplica ? 1 : 0],
    );
  }
}

export async function borrarDetalleLevantamiento(cx: PoolConnection, idLev: number): Promise<void> {
  await cx.query("DELETE FROM tblLevantamientoActividades WHERE IdLevantamiento = ?", [idLev]);
  await cx.query("DELETE FROM tblLevantamientoPersonal WHERE IdLevantamiento = ?", [idLev]);
  await cx.query("DELETE FROM tblLevantamientoInsumos WHERE IdLevantamiento = ?", [idLev]);
}

export interface LevantamientoBloqueado {
  IdLevantamiento: number;
  Folio: number;
  Status: string;
  NoCotizacion: number | null;
}

/** Toma el levantamiento con bloqueo y dice si ya tiene cotización. */
export async function bloquearLevantamiento(cx: PoolConnection, id: number): Promise<LevantamientoBloqueado> {
  const [filas] = await cx.query(
    `SELECT l.IdLevantamiento, l.Folio, l.Status,
            (SELECT co.NoCotizacion FROM tblCotizaciones co WHERE co.IdLevantamiento = l.IdLevantamiento LIMIT 1) AS NoCotizacion
       FROM tblLevantamientos l WHERE l.IdLevantamiento = ? FOR UPDATE`,
    [id],
  );
  const fila = (filas as LevantamientoBloqueado[])[0];
  if (!fila) throw new ErrorDeNegocio("El levantamiento no existe.", 404);
  return fila;
}

/** Actualiza el encabezado. El folio y el origen nunca cambian; el estatus sólo si no está cotizado. */
export async function actualizarLevantamiento(
  cx: PoolConnection,
  actual: LevantamientoBloqueado,
  lev: DatosLevantamiento,
  idCliente: number,
): Promise<void> {
  const status = actual.NoCotizacion !== null || actual.Status === "CANCELADO" ? actual.Status : lev.status;
  await cx.query(
    `UPDATE tblLevantamientos
        SET IdCliente = ?, Proyecto = ?, AreaTrabajo = ?, UsuarioContacto = ?, CorreoUsuario = ?,
            Fecha = ?, NivelRiesgo = ?, Dias = ?, TrabajoNormal = ?, TrabajoExtra = ?,
            AplicaCena = ?, AplicaBono = ?, Observaciones = ?, Elaboro = ?, Status = ?
      WHERE IdLevantamiento = ?`,
    [
      idCliente, lev.proyecto, lev.areaTrabajo || null, lev.usuarioContacto || null, lev.correoUsuario || null,
      lev.fecha, lev.nivelRiesgo, lev.dias, lev.trabajoNormal ? 1 : 0, lev.trabajoExtra ? 1 : 0,
      lev.aplicaCena ? 1 : 0, lev.aplicaBono ? 1 : 0, lev.observaciones || null, lev.elaboro || null,
      status, actual.IdLevantamiento,
    ],
  );
}
