import { rm } from "node:fs/promises";
import path from "node:path";
import type { PoolConnection } from "mysql2/promise";
import { ErrorDeNegocio } from "@/lib/errores";
import { RAIZ_UPLOADS, resolverRutaUpload } from "@/lib/importacion/archivos";

/**
 * Borrados en cascada, siempre dentro de la transacción que recibe:
 *   levantamiento → su cotización → su costeo (y las fotos en disco)
 *   cotización    → su costeo (el levantamiento regresa a "listo para cotizar")
 *   costeo        → sólo el costeo
 * Las importaciones que apuntaban a lo borrado quedan sin liga, no se borran.
 */

export interface Borrado {
  folio?: number;
  noCotizacion?: number;
  detalle: string;
}

export async function borrarLevantamiento(cx: PoolConnection, id: number): Promise<Borrado> {
  const [filas] = (await cx.query(
    `SELECT l.Folio, co.IdCotizacion, co.NoCotizacion
       FROM tblLevantamientos l LEFT JOIN tblCotizaciones co ON co.IdLevantamiento = l.IdLevantamiento
      WHERE l.IdLevantamiento = ? FOR UPDATE`,
    [id],
  )) as unknown as [{ Folio: number; IdCotizacion: number | null; NoCotizacion: number | null }[]];
  const lev = filas[0];
  if (!lev) throw new ErrorDeNegocio("El levantamiento no existe.", 404);

  const [evidencias] = (await cx.query(
    "SELECT Archivo FROM tblLevantamientoEvidencias WHERE IdLevantamiento = ?",
    [id],
  )) as unknown as [{ Archivo: string }[]];

  if (lev.IdCotizacion) {
    await cx.query("DELETE FROM tblCosteos WHERE IdCotizacion = ?", [lev.IdCotizacion]);
    await cx.query("DELETE FROM tblCotizaciones WHERE IdCotizacion = ?", [lev.IdCotizacion]);
  }
  await cx.query("DELETE FROM tblLevantamientos WHERE IdLevantamiento = ?", [id]); // detalle y evidencias en cascada
  await cx.query("UPDATE tblImportaciones SET IdLevantamiento = NULL, IdCosteo = NULL WHERE IdLevantamiento = ?", [id]);
  await borrarArchivosDeEvidencias(evidencias.map((e) => e.Archivo));

  return {
    folio: lev.Folio,
    noCotizacion: lev.NoCotizacion ?? undefined,
    detalle: lev.NoCotizacion
      ? `Folio ${lev.Folio} borrado junto con la cotización ${lev.NoCotizacion} y su costeo`
      : `Folio ${lev.Folio} borrado`,
  };
}

export async function borrarCotizacion(cx: PoolConnection, id: number): Promise<Borrado> {
  const [filas] = (await cx.query(
    "SELECT NoCotizacion, IdLevantamiento FROM tblCotizaciones WHERE IdCotizacion = ? FOR UPDATE",
    [id],
  )) as unknown as [{ NoCotizacion: number; IdLevantamiento: number | null }[]];
  const cot = filas[0];
  if (!cot) throw new ErrorDeNegocio("La cotización no existe.", 404);

  await cx.query("UPDATE tblImportaciones SET IdCosteo = NULL WHERE IdCosteo IN (SELECT IdCosteo FROM tblCosteos WHERE IdCotizacion = ?)", [id]);
  await cx.query("DELETE FROM tblCosteos WHERE IdCotizacion = ?", [id]);
  await cx.query("DELETE FROM tblCotizaciones WHERE IdCotizacion = ?", [id]); // partidas en cascada
  if (cot.IdLevantamiento) {
    await cx.query(
      "UPDATE tblLevantamientos SET Status = 'CERRADO' WHERE IdLevantamiento = ? AND Status = 'COTIZADO'",
      [cot.IdLevantamiento],
    );
  }
  return { noCotizacion: cot.NoCotizacion, detalle: `Cotización ${cot.NoCotizacion} borrada con su costeo` };
}

export async function borrarCosteo(cx: PoolConnection, id: number): Promise<Borrado> {
  const [filas] = (await cx.query(
    `SELECT co.NoCotizacion FROM tblCosteos cs JOIN tblCotizaciones co ON co.IdCotizacion = cs.IdCotizacion
      WHERE cs.IdCosteo = ? FOR UPDATE`,
    [id],
  )) as unknown as [{ NoCotizacion: number }[]];
  const costeo = filas[0];
  if (!costeo) throw new ErrorDeNegocio("El costeo no existe.", 404);
  await cx.query("UPDATE tblImportaciones SET IdCosteo = NULL WHERE IdCosteo = ?", [id]);
  await cx.query("DELETE FROM tblCosteos WHERE IdCosteo = ?", [id]); // conceptos, nómina, insumos y gastos en cascada
  return { noCotizacion: costeo.NoCotizacion, detalle: `Costeo de la cotización ${costeo.NoCotizacion} borrado` };
}

/** Las fotos viven en uploads/evidencias/<importación>/; se borran una a una, sin salir de uploads/. */
async function borrarArchivosDeEvidencias(rutas: string[]): Promise<void> {
  for (const ruta of rutas) {
    const segmentos = ruta.replace(/^\/uploads\//, "").split("/");
    const absoluta = resolverRutaUpload(segmentos);
    if (!absoluta || !absoluta.startsWith(path.join(RAIZ_UPLOADS, "evidencias"))) continue;
    await rm(absoluta, { force: true });
  }
}
