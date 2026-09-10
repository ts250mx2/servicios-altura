/** Los nueve conceptos del resumen de gasto del Excel. */
export const CONCEPTOS = [
  "NOMINA",
  "IMSS",
  "BONOS",
  "GASOLINA",
  "DESGASTE",
  "ADMINISTRATIVO",
  "INSUMOS",
  "EPP",
  "EQUIPO",
] as const;

export type Concepto = (typeof CONCEPTOS)[number];

export const ETIQUETA_CONCEPTO: Record<Concepto, string> = {
  NOMINA: "Nómina",
  IMSS: "IMSS",
  BONOS: "Bonos",
  GASOLINA: "Gasolina",
  DESGASTE: "Desgaste de equipo",
  ADMINISTRATIVO: "Administrativo",
  INSUMOS: "Insumos",
  EPP: "EPP",
  EQUIPO: "Compra de equipo",
};

/**
 * Los insumos NO entran en el gasto directo: se suman después de los
 * administrativos, tal como en la hoja "Gastos proyecto".
 */
export const CONCEPTOS_DIRECTOS: Concepto[] = [
  "NOMINA",
  "IMSS",
  "BONOS",
  "GASOLINA",
  "DESGASTE",
  "ADMINISTRATIVO",
  "EPP",
  "EQUIPO",
];

export interface Porcentajes {
  impuestosPct: number;
  administrativosPct: number;
  financiamientoPct: number;
  comisionPct: number;
}

export const PORCENTAJES_DEFAULT: Porcentajes = {
  impuestosPct: 10,
  administrativosPct: 5,
  financiamientoPct: 5,
  comisionPct: 4,
};

/** Una persona en la nómina del proyecto. */
export interface RenglonNomina {
  nombre: string;
  idPuesto: number;
  salarioDiario: number;
  imssDiario: number;
  desgasteDiario: number;
  bono: number;
  diasLaborados: number;
}

/** Una partida de insumos o herramental. */
export interface RenglonInsumo {
  descripcion: string;
  unidades: number;
  costo: number;
  /** false = "NO APLICAR": lo pone el cliente, no suma. */
  aplica?: boolean;
}

/** Gastos que no salen de la nómina ni de los insumos. */
export interface GastosSueltos {
  gasolina?: number;
  administrativo?: number;
  epp?: number;
  equipo?: number;
}

export interface EntradaCosteo {
  nomina: RenglonNomina[];
  insumos: RenglonInsumo[];
  gastos?: GastosSueltos;
  porcentajes?: Partial<Porcentajes>;
  precioVenta?: number;
}

export interface ResultadoCosteo {
  conceptos: Record<Concepto, number>;
  gastoDirecto: number;
  impuestos: number;
  subtotal1: number;
  administrativos: number;
  subtotal2: number;
  insumos: number;
  subtotal3: number;
  financiamiento: number;
  gastoTotal: number;
  precioVenta: number;
  utilidadBruta: number;
  comision: number;
  utilidadNeta: number;
  margenPct: number;
  porcentajes: Porcentajes;
}
