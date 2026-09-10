import type { PoolConnection } from "mysql2/promise";
import { ErrorDeNegocio } from "@/lib/errores";
import { centavos } from "@/lib/formato";
import type { DatosCotizacion } from "./esquemas";

export interface TotalesCotizacion {
  subtotal: number;
  descuento: number;
  /** Lo que realmente se cobra sin IVA; es el precio de venta del costeo. */
  base: number;
  iva: number;
  total: number;
}

/** Los totales de la cotización a partir de sus partidas; se usan igual en pantalla y en el servidor. */
export function totalesCotizacion(
  partidas: { cantidad: number; precioUnitario: number }[],
  descuentoPct: number,
  ivaPct: number,
): TotalesCotizacion {
  const subtotal = partidas.reduce((s, p) => s + centavos(p.cantidad * p.precioUnitario), 0);
  const descuento = centavos(subtotal * (descuentoPct / 100));
  const base = centavos(subtotal - descuento);
  const iva = centavos(base * (ivaPct / 100));
  return { subtotal, descuento, base, iva, total: centavos(base + iva) };
}

/**
 * Si la cotización tiene varias partidas o descuento, su base (subtotal menos
 * descuento) es el precio de venta y el editor del costeo no puede cambiarlo.
 * Devuelve esa base, o null cuando el costeo sí manda (una partida, sin descuento).
 */
export async function precioMandaDesdeCotizacion(cx: PoolConnection, idCotizacion: number): Promise<number | null> {
  const [filas] = await cx.query(
    `SELECT co.Subtotal, co.Descuento, co.DescuentoPct,
            (SELECT COUNT(*) FROM tblCotizacionPartidas p WHERE p.IdCotizacion = co.IdCotizacion) AS Partidas
       FROM tblCotizaciones co WHERE co.IdCotizacion = ?`,
    [idCotizacion],
  );
  const fila = (filas as { Subtotal: number; Descuento: number; DescuentoPct: number; Partidas: number }[])[0];
  if (!fila) return null;
  if (Number(fila.Partidas) <= 1 && Number(fila.DescuentoPct) === 0) return null;
  return centavos(Number(fila.Subtotal) - Number(fila.Descuento));
}

/** Actualiza encabezado y partidas; devuelve el precio de venta resultante. */
export async function actualizarCotizacion(
  cx: PoolConnection,
  idCotizacion: number,
  d: DatosCotizacion,
): Promise<{ noCotizacion: number; base: number; idCosteo: number | null }> {
  const [filas] = await cx.query(
    `SELECT co.NoCotizacion, co.IvaPct, co.FechaEnvio, co.FechaAutoriza, cs.IdCosteo
       FROM tblCotizaciones co LEFT JOIN tblCosteos cs ON cs.IdCotizacion = co.IdCotizacion
      WHERE co.IdCotizacion = ? FOR UPDATE`,
    [idCotizacion],
  );
  const actual = (filas as {
    NoCotizacion: number; IvaPct: number; FechaEnvio: string | null; FechaAutoriza: string | null; IdCosteo: number | null;
  }[])[0];
  if (!actual) throw new ErrorDeNegocio("La cotización no existe.", 404);

  const ivaPct = Number(actual.IvaPct) || 16;
  const t = totalesCotizacion(d.partidas, d.descuentoPct, ivaPct);
  const enviada = d.status !== "BORRADOR";
  const autorizada = d.status === "AUTORIZADA";

  await cx.query(
    `UPDATE tblCotizaciones
        SET Fecha = ?, Vigencia = ?, Descripcion = ?, Condiciones = ?, IdVendedor = ?,
            DescuentoPct = ?, Descuento = ?, Subtotal = ?, Iva = ?, Total = ?,
            Status = ?, FechaEnvio = ?, FechaAutoriza = ?, AutorizadoPor = ?, MotivoRechazo = ?
      WHERE IdCotizacion = ?`,
    [
      d.fecha, d.vigencia, d.descripcion, d.condiciones || null, d.idVendedor,
      d.descuentoPct, t.descuento, t.subtotal, t.iva, t.total,
      d.status,
      enviada ? (actual.FechaEnvio ?? new Date()) : null,
      autorizada ? (actual.FechaAutoriza ?? new Date()) : null,
      autorizada ? d.autorizadoPor || null : null,
      d.status === "RECHAZADA" ? d.motivoRechazo || null : null,
      idCotizacion,
    ],
  );

  await cx.query("DELETE FROM tblCotizacionPartidas WHERE IdCotizacion = ?", [idCotizacion]);
  for (const [i, p] of d.partidas.entries()) {
    await cx.query(
      `INSERT INTO tblCotizacionPartidas (IdCotizacion, Orden, Concepto, Unidad, Cantidad, PrecioUnitario, Importe)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idCotizacion, i + 1, p.concepto, p.unidad, p.cantidad, p.precioUnitario, centavos(p.cantidad * p.precioUnitario)],
    );
  }

  return { noCotizacion: actual.NoCotizacion, base: t.base, idCosteo: actual.IdCosteo };
}
