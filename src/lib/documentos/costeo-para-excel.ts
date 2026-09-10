import { CONCEPTOS, type Concepto } from "@/lib/costeo/tipos";
import type { DatosCosteoDoc } from "./datos";
import type { CosteoParaExcel } from "./excel-costeo";

/** De lo cargado de la base a los datos planos que arma el Excel de 12 hojas. */
export function costeoParaExcel(d: DatosCosteoDoc): CosteoParaExcel {
  const { ficha } = d;
  const porConcepto = new Map(d.conceptos.map((c) => [c.Concepto, c]));
  const conceptos = (campo: "GastoPlan" | "GastoReal") =>
    Object.fromEntries(CONCEPTOS.map((c) => [c, Number(porConcepto.get(c)?.[campo] ?? 0)])) as Record<Concepto, number>;
  const fechasPor = new Map<number, string[]>();
  for (const dia of d.dias) {
    if (dia.Laborado !== 1) continue;
    fechasPor.set(dia.IdCosteoNomina, [...(fechasPor.get(dia.IdCosteoNomina) ?? []), String(dia.Fecha).slice(0, 10)]);
  }
  return {
    noCotizacion: ficha.NoCotizacion,
    folio: ficha.Folio,
    descripcion: ficha.Descripcion,
    usuario: d.usuarioContacto ?? "",
    planta: ficha.Cliente,
    vendedor: d.vendedor ?? "",
    fecha: String(ficha.Fecha).slice(0, 10),
    dias: ficha.Dias,
    personal: ficha.Personal,
    precioVenta: Number(ficha.PrecioVenta),
    isr: Number(ficha.Isr),
    autoriza: ficha.StatusCotizacion === "AUTORIZADA" ? "AUTORIZA" : "",
    porcentajes: {
      impuestosPct: Number(ficha.ImpuestosPct), administrativosPct: Number(ficha.AdministrativosPct),
      financiamientoPct: Number(ficha.FinanciamientoPct), comisionPct: Number(ficha.ComisionPct),
    },
    conceptosPlan: conceptos("GastoPlan"),
    conceptosReal: conceptos("GastoReal"),
    nomina: d.nomina.map((n) => ({
      nombre: n.Nombre, salarioDiario: Number(n.SalarioDiario), imssDiario: Number(n.ImssDiario),
      desgasteDiario: Number(n.DesgasteDiario), bono: Number(n.Bono), fechas: fechasPor.get(n.IdCosteoNomina) ?? [],
    })),
    insumos: d.insumos.map((i) => ({
      descripcion: i.Descripcion, unidades: Number(i.Unidades), costoPlan: Number(i.CostoPlan),
      costoReal: Number(i.CostoReal), comentario: i.Comentario,
    })),
    gastos: d.gastos.map((g) => ({
      concepto: g.Concepto as CosteoParaExcel["gastos"][number]["concepto"],
      fecha: g.Fecha ? String(g.Fecha).slice(0, 10) : null,
      descripcion: g.Descripcion, cantidad: Number(g.Cantidad),
    })),
    tarifasEpp: d.tarifasEpp.map((t) => ({ montoHasta: Number(t.MontoHasta), costo: Number(t.Costo) })),
    tarifasEquipo: d.tarifasEquipo.map((t) => ({ montoHasta: Number(t.MontoHasta), costo: Number(t.Costo) })),
  };
}
