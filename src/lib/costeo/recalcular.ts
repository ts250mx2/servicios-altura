import type { PoolConnection } from "mysql2/promise";
import { actualizarTotalesCosteo, type DetalleCosteo } from "./guardar";
import { calcularCosteo, calcularDesdeConceptos } from "./motor";
import { CONCEPTOS, type Concepto, type RenglonNomina } from "./tipos";

interface FilaCosteo {
  Dias: number; Isr: number; ImpuestosPct: number; AdministrativosPct: number;
  FinanciamientoPct: number; ComisionPct: number; Status: "PLANEADO" | "EN_PROCESO" | "CERRADO";
}

/**
 * Vuelve a correr la cadena de un costeo guardado con otro precio de venta
 * (cuando se edita la cotización). El detalle no cambia; sólo los totales.
 */
export async function recalcularPrecioCosteo(cx: PoolConnection, idCosteo: number, precioVenta: number): Promise<void> {
  const [[costeo]] = (await cx.query(
    "SELECT Dias, Isr, ImpuestosPct, AdministrativosPct, FinanciamientoPct, ComisionPct, Status FROM tblCosteos WHERE IdCosteo = ? FOR UPDATE",
    [idCosteo],
  )) as unknown as [FilaCosteo[]];
  if (!costeo) return;

  const [nominaFilas] = (await cx.query(
    `SELECT n.Nombre, n.IdPuesto, n.SalarioDiario, n.ImssDiario, n.DesgasteDiario, n.Bono,
            COALESCE(SUM(d.Laborado), 0) AS Dias
       FROM tblCosteoNomina n LEFT JOIN tblCosteoNominaDias d ON d.IdCosteoNomina = n.IdCosteoNomina
      WHERE n.IdCosteo = ? GROUP BY n.IdCosteoNomina`,
    [idCosteo],
  )) as unknown as [{
    Nombre: string; IdPuesto: number; SalarioDiario: number; ImssDiario: number; DesgasteDiario: number; Bono: number; Dias: number;
  }[]];
  const [insumos] = (await cx.query(
    "SELECT Descripcion, Unidades, CostoPlan, Comentario FROM tblCosteoInsumos WHERE IdCosteo = ?",
    [idCosteo],
  )) as unknown as [{ Descripcion: string; Unidades: number; CostoPlan: number; Comentario: string | null }[]];
  const [gastos] = (await cx.query(
    "SELECT Concepto, COALESCE(SUM(Cantidad), 0) AS Total FROM tblCosteoGastos WHERE IdCosteo = ? AND EsReal = 0 GROUP BY Concepto",
    [idCosteo],
  )) as unknown as [{ Concepto: string; Total: number }[]];
  const [conceptos] = (await cx.query(
    "SELECT Concepto, GastoReal FROM tblCosteoConceptos WHERE IdCosteo = ?",
    [idCosteo],
  )) as unknown as [{ Concepto: Concepto; GastoReal: number }[]];

  const nomina: RenglonNomina[] = nominaFilas.map((n) => ({
    nombre: n.Nombre, idPuesto: n.IdPuesto, salarioDiario: Number(n.SalarioDiario), imssDiario: Number(n.ImssDiario),
    desgasteDiario: Number(n.DesgasteDiario), bono: Number(n.Bono), diasLaborados: Number(n.Dias),
  }));
  const gasto = (c: string) => Number(gastos.find((g) => g.Concepto === c)?.Total ?? 0);
  const porcentajes = {
    impuestosPct: Number(costeo.ImpuestosPct), administrativosPct: Number(costeo.AdministrativosPct),
    financiamientoPct: Number(costeo.FinanciamientoPct), comisionPct: Number(costeo.ComisionPct),
  };
  const resultado = calcularCosteo({
    nomina,
    insumos: insumos.map((i) => ({
      descripcion: i.Descripcion, unidades: Number(i.Unidades), costo: Number(i.CostoPlan), aplica: i.Comentario !== "NO APLICAR",
    })),
    gastos: { gasolina: gasto("GASOLINA"), administrativo: gasto("ADMINISTRATIVO"), epp: gasto("EPP"), equipo: gasto("EQUIPO") },
    porcentajes,
    precioVenta,
  });
  const hayReal = conceptos.some((c) => Number(c.GastoReal) > 0);
  const conceptosReal = Object.fromEntries(
    CONCEPTOS.map((c) => [c, Number(conceptos.find((x) => x.Concepto === c)?.GastoReal ?? 0)]),
  ) as Record<Concepto, number>;

  const detalle: DetalleCosteo = {
    dias: Number(costeo.Dias), isr: Number(costeo.Isr), resultado, nomina,
    insumos: [], gastos: [],
    real: hayReal ? { conceptos: conceptosReal, resultado: calcularDesdeConceptos(conceptosReal, porcentajes, precioVenta) } : null,
    status: costeo.Status,
  };
  await actualizarTotalesCosteo(cx, idCosteo, detalle);
}
