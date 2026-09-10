import { calcularCosteo, calcularDesdeConceptos } from "./motor";
import type { DatosCosteoCompleto } from "./esquemas";
import type { DetalleCosteo } from "./guardar";
import { CONCEPTOS, type Concepto, type RenglonNomina } from "./tipos";

/**
 * Del cuerpo validado de la API al detalle que se guarda: nómina como renglones
 * del motor, resultado recalculado en el servidor y, si viene, la cadena real.
 */
export function armarDetalleCosteo(d: DatosCosteoCompleto): DetalleCosteo {
  const nomina: RenglonNomina[] = d.nomina.map((p) => ({
    nombre: p.nombre, idPuesto: p.idPuesto, salarioDiario: p.salarioDiario, imssDiario: p.imssDiario,
    desgasteDiario: p.desgasteDiario, bono: p.bono, diasLaborados: p.dias,
  }));
  const resultado = calcularCosteo({
    nomina,
    insumos: d.insumos.map((i) => ({ descripcion: i.descripcion, unidades: i.unidades, costo: i.costo, aplica: i.aplica })),
    gastos: sumaGastos(d.gastos),
    porcentajes: d.porcentajes,
    precioVenta: d.precioVenta,
  });
  const real = d.conceptosReal
    ? {
        conceptos: completarConceptos(d.conceptosReal),
        resultado: calcularDesdeConceptos(completarConceptos(d.conceptosReal), d.porcentajes, d.precioVenta),
      }
    : null;
  return {
    dias: d.dias,
    isr: d.isr,
    resultado,
    nomina,
    insumos: d.insumos,
    gastos: d.gastos.map((g) => ({ ...g, descripcion: g.descripcion || null })),
    real,
    status: d.statusCosteo,
  };
}

export function sumaGastos(gastos: DatosCosteoCompleto["gastos"]) {
  const suma = (concepto: DatosCosteoCompleto["gastos"][number]["concepto"]) =>
    gastos.filter((g) => g.concepto === concepto).reduce((s, g) => s + g.cantidad, 0);
  return { gasolina: suma("GASOLINA"), administrativo: suma("ADMINISTRATIVO"), epp: suma("EPP"), equipo: suma("EQUIPO") };
}

export function completarConceptos(parcial: Partial<Record<Concepto, number>>): Record<Concepto, number> {
  return Object.fromEntries(CONCEPTOS.map((c) => [c, parcial[c] ?? 0])) as Record<Concepto, number>;
}
