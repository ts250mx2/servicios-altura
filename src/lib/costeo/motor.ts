import { centavos } from "@/lib/formato";
import {
  CONCEPTOS,
  CONCEPTOS_DIRECTOS,
  PORCENTAJES_DEFAULT,
  type Concepto,
  type EntradaCosteo,
  type Porcentajes,
  type RenglonInsumo,
  type RenglonNomina,
  type ResultadoCosteo,
} from "./tipos";

/**
 * Motor de costeo de Servicios de Altura.
 *
 * Reproduce la cadena de la hoja "Gastos proyecto" del Excel de costeo:
 *
 *   GastoDirecto   = Nómina + IMSS + Bonos + Gasolina + Desgaste + Admvo + EPP + Equipo
 *   Impuestos      = GastoDirecto × impuestosPct
 *   Subtotal1      = GastoDirecto + Impuestos
 *   Administrativos= Subtotal1 × administrativosPct
 *   Subtotal2      = Subtotal1 + Administrativos
 *   Insumos        = Σ partidas que aplican
 *   Subtotal3      = Subtotal2 + Insumos
 *   Financiamiento = Subtotal3 × financiamientoPct
 *   GastoTotal     = Subtotal3 + Financiamiento
 *   UtilidadBruta  = PrecioVenta − GastoTotal
 *   Comisión       = UtilidadBruta × comisionPct
 *   UtilidadNeta   = UtilidadBruta − Comisión
 *
 * Verificado contra los proyectos 6744 y 6745 (ver motor.test.ts).
 */

export function totalNomina(nomina: RenglonNomina[]): {
  nomina: number;
  imss: number;
  desgaste: number;
  bonos: number;
} {
  return nomina.reduce(
    (acumulado, r) => ({
      nomina: acumulado.nomina + r.salarioDiario * r.diasLaborados,
      imss: acumulado.imss + r.imssDiario * r.diasLaborados,
      desgaste: acumulado.desgaste + r.desgasteDiario * r.diasLaborados,
      bonos: acumulado.bonos + r.bono,
    }),
    { nomina: 0, imss: 0, desgaste: 0, bonos: 0 },
  );
}

export function totalInsumos(insumos: RenglonInsumo[]): number {
  return insumos.reduce((suma, i) => (i.aplica === false ? suma : suma + i.costo), 0);
}

export function calcularCosteo(entrada: EntradaCosteo): ResultadoCosteo {
  const porcentajes: Porcentajes = { ...PORCENTAJES_DEFAULT, ...entrada.porcentajes };
  const gastos = entrada.gastos ?? {};
  const n = totalNomina(entrada.nomina);
  const insumosCrudo = totalInsumos(entrada.insumos);

  // Los conceptos sí se redondean: son importes que se capturan y se cuadran.
  const conceptos = {
    NOMINA: centavos(n.nomina),
    IMSS: centavos(n.imss),
    BONOS: centavos(n.bonos),
    GASOLINA: centavos(gastos.gasolina ?? 0),
    DESGASTE: centavos(n.desgaste),
    ADMINISTRATIVO: centavos(gastos.administrativo ?? 0),
    INSUMOS: centavos(insumosCrudo),
    EPP: centavos(gastos.epp ?? 0),
    EQUIPO: centavos(gastos.equipo ?? 0),
  } as Record<Concepto, number>;

  // La cadena se calcula con precisión completa y sólo se redondea al
  // presentar cada renglón. Redondear paso a paso arrastra el error y deja de
  // cuadrar contra el Excel; así el resultado es idéntico al de la hoja.
  const gastoDirecto = CONCEPTOS_DIRECTOS.reduce((suma, c) => suma + conceptos[c], 0);
  const impuestos = gastoDirecto * (porcentajes.impuestosPct / 100);
  const subtotal1 = gastoDirecto + impuestos;
  const administrativos = subtotal1 * (porcentajes.administrativosPct / 100);
  const subtotal2 = subtotal1 + administrativos;
  const subtotal3 = subtotal2 + insumosCrudo;
  const financiamiento = subtotal3 * (porcentajes.financiamientoPct / 100);
  const gastoTotal = subtotal3 + financiamiento;

  const precioVenta = entrada.precioVenta ?? 0;
  const utilidadBruta = precioVenta - gastoTotal;
  const comision = utilidadBruta * (porcentajes.comisionPct / 100);
  const utilidadNeta = utilidadBruta - comision;
  const margenPct = precioVenta > 0 ? (utilidadNeta / precioVenta) * 100 : 0;

  return {
    conceptos,
    gastoDirecto: centavos(gastoDirecto),
    impuestos: centavos(impuestos),
    subtotal1: centavos(subtotal1),
    administrativos: centavos(administrativos),
    subtotal2: centavos(subtotal2),
    insumos: centavos(insumosCrudo),
    subtotal3: centavos(subtotal3),
    financiamiento: centavos(financiamiento),
    gastoTotal: centavos(gastoTotal),
    precioVenta: centavos(precioVenta),
    utilidadBruta: centavos(utilidadBruta),
    comision: centavos(comision),
    utilidadNeta: centavos(utilidadNeta),
    margenPct: Math.round(margenPct * 100) / 100,
    porcentajes,
  };
}

/**
 * La misma cadena, pero partiendo de los nueve conceptos ya sumados (por
 * ejemplo el gasto real que trae un Excel) en lugar de la nómina y las partidas.
 */
export function calcularDesdeConceptos(
  conceptos: Record<Concepto, number>,
  porcentajes: Partial<Porcentajes>,
  precioVenta: number,
): ResultadoCosteo {
  const directos = CONCEPTOS_DIRECTOS.reduce((suma, c) => suma + conceptos[c], 0);
  const resultado = calcularCosteo({
    nomina: [],
    insumos: [{ descripcion: "INSUMOS", unidades: 1, costo: conceptos.INSUMOS }],
    gastos: { gasolina: directos },
    porcentajes,
    precioVenta,
  });
  const desglose = Object.fromEntries(
    CONCEPTOS.map((c) => [c, centavos(conceptos[c])]),
  ) as Record<Concepto, number>;
  return { ...resultado, conceptos: desglose };
}

/**
 * La fórmula invertida: qué precio hay que cobrar para dejar un margen dado.
 *
 *   utilidadNeta = (P − G)(1 − c)   y   margen = utilidadNeta / P
 *   ⇒  P = G(1 − c) / (1 − c − m)
 *
 * Esto es lo que el Excel no puede hacer.
 */
export function precioPorMargen(
  gastoTotal: number,
  margenObjetivoPct: number,
  comisionPct = PORCENTAJES_DEFAULT.comisionPct,
): number {
  const c = comisionPct / 100;
  const m = margenObjetivoPct / 100;
  const denominador = 1 - c - m;
  if (denominador <= 0) return 0;
  return centavos((gastoTotal * (1 - c)) / denominador);
}

/** Precio por tarifa: personas-día × tarifa del puesto, más los bonos. */
export function precioPorTarifa(
  personal: { cantidad: number; tarifaVentaDia: number; bono?: number }[],
  dias: number,
): number {
  const servicio = personal.reduce((s, p) => s + p.cantidad * p.tarifaVentaDia * dias, 0);
  const bonos = personal.reduce((s, p) => s + p.cantidad * (p.bono ?? 0), 0);
  return centavos(servicio + bonos);
}

/** Escalón de EPP o compra de equipo según el monto de venta. */
export function costoPorMonto(
  tabla: { montoHasta: number; costo: number }[],
  monto: number,
): number {
  const ordenada = [...tabla].sort((a, b) => a.montoHasta - b.montoHasta);
  const escalon = ordenada.find((t) => monto <= t.montoHasta);
  return escalon ? escalon.costo : (ordenada.at(-1)?.costo ?? 0);
}

export type SemaforoMargen = "bueno" | "alerta" | "critico";

export function semaforoMargen(margenPct: number, alertaPct = 30, buenoPct = 45): SemaforoMargen {
  if (margenPct >= buenoPct) return "bueno";
  if (margenPct >= alertaPct) return "alerta";
  return "critico";
}

export { CONCEPTOS };
