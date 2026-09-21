import { consulta, consultaUna } from "@/lib/db";
import type { Concepto } from "@/lib/costeo/tipos";
import { indiceUltimosCostos, type CostoHistorico, type UltimosCostos } from "@/lib/costeo/ultimos-costos";

export interface CosteoLista {
  IdCosteo: number;
  IdCotizacion: number;
  NoCotizacion: number;
  Folio: number | null;
  Cliente: string;
  Descripcion: string;
  Fecha: string;
  Dias: number;
  Personal: number;
  PrecioVenta: number;
  GastoTotalPlan: number;
  UtilidadNetaPlan: number;
  MargenPlanPct: number;
  GastoTotalReal: number;
  UtilidadNetaReal: number;
  MargenRealPct: number;
  Status: "PLANEADO" | "EN_PROCESO" | "CERRADO";
  StatusCotizacion: string;
}

export function listaCosteos(filtro: { status?: string; texto?: string } = {}) {
  const donde: string[] = ["1 = 1"];
  const par: unknown[] = [];
  if (filtro.status) {
    donde.push("cs.Status = ?");
    par.push(filtro.status);
  }
  if (filtro.texto) {
    donde.push("(co.Descripcion LIKE ? OR c.Cliente LIKE ? OR CAST(co.NoCotizacion AS CHAR) LIKE ?)");
    par.push(`%${filtro.texto}%`, `%${filtro.texto}%`, `%${filtro.texto}%`);
  }
  return consulta<CosteoLista>(
    `SELECT cs.IdCosteo, cs.IdCotizacion, co.NoCotizacion, l.Folio, c.Cliente,
            co.Descripcion, co.Fecha, cs.Dias, cs.Personal, cs.PrecioVenta,
            cs.GastoTotalPlan, cs.UtilidadNetaPlan, cs.MargenPlanPct,
            cs.GastoTotalReal, cs.UtilidadNetaReal, cs.MargenRealPct,
            cs.Status, co.Status AS StatusCotizacion
       FROM tblCosteos cs
       JOIN tblCotizaciones co ON co.IdCotizacion = cs.IdCotizacion
       JOIN tblClientes c      ON c.IdCliente = co.IdCliente
       LEFT JOIN tblLevantamientos l ON l.IdLevantamiento = cs.IdLevantamiento
      WHERE ${donde.join(" AND ")}
      ORDER BY co.Fecha DESC, co.NoCotizacion DESC
      LIMIT 300`,
    par,
  );
}

export function fichaCosteo(id: number) {
  return consultaUna<CosteoLista & {
    ImpuestosPct: number;
    AdministrativosPct: number;
    FinanciamientoPct: number;
    ComisionPct: number;
    Isr: number;
    InsumosPlan: number;
    GastoDirectoPlan: number;
    Comentario: string | null;
    IdLevantamiento: number | null;
  }>(
    `SELECT cs.*, co.NoCotizacion, co.Descripcion, co.Fecha, co.Status AS StatusCotizacion,
            c.Cliente, l.Folio
       FROM tblCosteos cs
       JOIN tblCotizaciones co ON co.IdCotizacion = cs.IdCotizacion
       JOIN tblClientes c      ON c.IdCliente = co.IdCliente
       LEFT JOIN tblLevantamientos l ON l.IdLevantamiento = cs.IdLevantamiento
      WHERE cs.IdCosteo = ?`,
    [id],
  );
}

export function conceptosDe(idCosteo: number) {
  return consulta<{ Concepto: Concepto; GastoPlan: number; GastoReal: number; Comentario: string | null }>(
    "SELECT Concepto, GastoPlan, GastoReal, Comentario FROM tblCosteoConceptos WHERE IdCosteo = ?",
    [idCosteo],
  );
}

export function nominaDe(idCosteo: number) {
  return consulta<{
    IdCosteoNomina: number;
    Nombre: string;
    Puesto: string;
    SalarioDiario: number;
    ImssDiario: number;
    DesgasteDiario: number;
    Bono: number;
    DiasPlan: number;
    DiasReal: number;
  }>(
    `SELECT n.IdCosteoNomina, n.Nombre, p.Puesto, n.SalarioDiario, n.ImssDiario,
            n.DesgasteDiario, n.Bono,
            COALESCE(SUM(d.Laborado), 0)                            AS DiasPlan,
            COALESCE(SUM(CASE WHEN d.EsReal = 1 THEN d.Laborado END), 0) AS DiasReal
       FROM tblCosteoNomina n
       JOIN tblPuestos p ON p.IdPuesto = n.IdPuesto
       LEFT JOIN tblCosteoNominaDias d ON d.IdCosteoNomina = n.IdCosteoNomina
      WHERE n.IdCosteo = ?
      GROUP BY n.IdCosteoNomina, n.Nombre, p.Puesto, n.SalarioDiario, n.ImssDiario,
               n.DesgasteDiario, n.Bono
      ORDER BY n.IdCosteoNomina`,
    [idCosteo],
  );
}

export function insumosCosteoDe(idCosteo: number) {
  return consulta<{
    IdCosteoInsumo: number;
    IdInsumo: number | null;
    Descripcion: string;
    Unidades: number;
    CostoPlan: number;
    CostoReal: number;
    Comentario: string | null;
  }>(
    "SELECT IdCosteoInsumo, IdInsumo, Descripcion, Unidades, CostoPlan, CostoReal, Comentario FROM tblCosteoInsumos WHERE IdCosteo = ? ORDER BY IdCosteoInsumo",
    [idCosteo],
  );
}

const MAX_PARTIDAS_HISTORICO = 5000;

/**
 * Último costo unitario de cada insumo/herramental en costeos anteriores. Editar un
 * costeo reinserta su detalle, así que el Id más alto es también el más actualizado.
 */
export async function ultimosCostosInsumo(): Promise<UltimosCostos> {
  const filas = await consulta<CostoHistorico>(
    `SELECT IdInsumo, Descripcion, Unidades, CostoPlan
       FROM tblCosteoInsumos
      WHERE Unidades > 0 AND CostoPlan > 0
      ORDER BY IdCosteoInsumo DESC
      LIMIT ${MAX_PARTIDAS_HISTORICO}`,
  );
  return indiceUltimosCostos(filas);
}

export function gastosDe(idCosteo: number) {
  return consulta<{
    IdCosteoGasto: number;
    Concepto: string;
    Fecha: string | null;
    Descripcion: string | null;
    Cantidad: number;
    EsReal: number;
  }>(
    "SELECT IdCosteoGasto, Concepto, Fecha, Descripcion, Cantidad, EsReal FROM tblCosteoGastos WHERE IdCosteo = ? ORDER BY Concepto, Fecha",
    [idCosteo],
  );
}
