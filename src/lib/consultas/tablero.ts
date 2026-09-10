import { consulta, consultaUna } from "@/lib/db";
import type { RangoFechas } from "@/lib/fechas";

export interface ResumenPeriodo {
  Levantamientos: number;
  Cotizaciones: number;
  Autorizadas: number;
  MontoCotizado: number;
  MontoAutorizado: number;
  UtilidadPlan: number;
  MargenPromedio: number;
}

const SQL_RESUMEN = `
  SELECT
    (SELECT COUNT(*) FROM tblLevantamientos WHERE Fecha BETWEEN ? AND ? AND Status <> 'CANCELADO') AS Levantamientos,
    COUNT(co.IdCotizacion)                                                        AS Cotizaciones,
    SUM(co.Status = 'AUTORIZADA')                                                 AS Autorizadas,
    COALESCE(SUM(co.Subtotal), 0)                                                 AS MontoCotizado,
    COALESCE(SUM(CASE WHEN co.Status = 'AUTORIZADA' THEN co.Subtotal END), 0)     AS MontoAutorizado,
    COALESCE(SUM(CASE WHEN co.Status = 'AUTORIZADA' THEN cs.UtilidadNetaPlan END), 0) AS UtilidadPlan,
    COALESCE(AVG(CASE WHEN co.Status = 'AUTORIZADA' THEN cs.MargenPlanPct END), 0)    AS MargenPromedio
  FROM tblCotizaciones co
  LEFT JOIN tblCosteos cs ON cs.IdCotizacion = co.IdCotizacion
  WHERE co.Fecha BETWEEN ? AND ? AND co.Status <> 'CANCELADA'`;

export async function resumen(rango: RangoFechas) {
  const actual = await consultaUna<ResumenPeriodo>(SQL_RESUMEN, [
    rango.desde, rango.hasta, rango.desde, rango.hasta,
  ]);
  const anterior = await consultaUna<ResumenPeriodo>(SQL_RESUMEN, [
    rango.desdeAnterior, rango.hastaAnterior, rango.desdeAnterior, rango.hastaAnterior,
  ]);
  return { actual, anterior };
}

/** Embudo: levantamiento → cotizada → enviada → autorizada. */
export async function embudo(rango: RangoFechas) {
  const fila = await consultaUna<{
    Levantados: number; Cotizados: number; Enviadas: number; Autorizadas: number;
  }>(
    `SELECT
        COUNT(*)                                                          AS Levantados,
        SUM(co.IdCotizacion IS NOT NULL)                                  AS Cotizados,
        SUM(co.Status IN ('ENVIADA','AUTORIZADA','RECHAZADA'))            AS Enviadas,
        SUM(co.Status = 'AUTORIZADA')                                     AS Autorizadas
       FROM tblLevantamientos l
       LEFT JOIN tblCotizaciones co ON co.IdLevantamiento = l.IdLevantamiento
      WHERE l.Fecha BETWEEN ? AND ? AND l.Status <> 'CANCELADO'`,
    [rango.desde, rango.hasta],
  );
  return [
    { etapa: "Levantados", valor: Number(fila?.Levantados ?? 0) },
    { etapa: "Cotizados", valor: Number(fila?.Cotizados ?? 0) },
    { etapa: "Enviadas", valor: Number(fila?.Enviadas ?? 0) },
    { etapa: "Autorizadas", valor: Number(fila?.Autorizadas ?? 0) },
  ];
}

export function porMes(meses = 12) {
  return consulta<{ Mes: string; Cotizado: number; Autorizado: number; Utilidad: number }>(
    `SELECT DATE_FORMAT(co.Fecha, '%Y-%m')                                        AS Mes,
            COALESCE(SUM(co.Subtotal), 0)                                         AS Cotizado,
            COALESCE(SUM(CASE WHEN co.Status = 'AUTORIZADA' THEN co.Subtotal END), 0) AS Autorizado,
            COALESCE(SUM(CASE WHEN co.Status = 'AUTORIZADA' THEN cs.UtilidadNetaPlan END), 0) AS Utilidad
       FROM tblCotizaciones co
       LEFT JOIN tblCosteos cs ON cs.IdCotizacion = co.IdCotizacion
      WHERE co.Fecha >= DATE_SUB(CURDATE(), INTERVAL ? MONTH) AND co.Status <> 'CANCELADA'
      GROUP BY DATE_FORMAT(co.Fecha, '%Y-%m')
      ORDER BY Mes`,
    [meses],
  );
}

export function margenPorCliente(rango: RangoFechas, limite = 8) {
  return consulta<{ Cliente: string; Autorizado: number; Utilidad: number; Margen: number }>(
    `SELECT c.Cliente,
            COALESCE(SUM(co.Subtotal), 0)          AS Autorizado,
            COALESCE(SUM(cs.UtilidadNetaPlan), 0)  AS Utilidad,
            COALESCE(AVG(cs.MargenPlanPct), 0)     AS Margen
       FROM tblCotizaciones co
       JOIN tblClientes c ON c.IdCliente = co.IdCliente
       LEFT JOIN tblCosteos cs ON cs.IdCotizacion = co.IdCotizacion
      WHERE co.Status = 'AUTORIZADA' AND co.Fecha BETWEEN ? AND ?
      GROUP BY c.IdCliente, c.Cliente
      ORDER BY Autorizado DESC
      LIMIT ?`,
    [rango.desde, rango.hasta, limite],
  );
}

export function proyectosEnCurso() {
  return consulta<{
    IdCosteo: number; NoCotizacion: number; Cliente: string; Descripcion: string;
    PrecioVenta: number; MargenPlanPct: number; MargenRealPct: number; Dias: number;
  }>(
    `SELECT cs.IdCosteo, co.NoCotizacion, c.Cliente, co.Descripcion,
            cs.PrecioVenta, cs.MargenPlanPct, cs.MargenRealPct, cs.Dias
       FROM tblCosteos cs
       JOIN tblCotizaciones co ON co.IdCotizacion = cs.IdCotizacion
       JOIN tblClientes c      ON c.IdCliente = co.IdCliente
      WHERE cs.Status = 'EN_PROCESO'
      ORDER BY co.Fecha DESC
      LIMIT 10`,
  );
}

export function ultimosLevantamientos(limite = 8) {
  return consulta<{
    IdLevantamiento: number; Folio: number; Cliente: string; Proyecto: string;
    Fecha: string; Status: string; NivelRiesgo: string;
  }>(
    `SELECT l.IdLevantamiento, l.Folio, c.Cliente, l.Proyecto, l.Fecha, l.Status, l.NivelRiesgo
       FROM tblLevantamientos l
       JOIN tblClientes c ON c.IdCliente = l.IdCliente
      ORDER BY l.FechaAlta DESC
      LIMIT ?`,
    [limite],
  );
}
