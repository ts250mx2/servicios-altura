import type { Concepto, Porcentajes } from "@/lib/costeo/tipos";

/**
 * Lo que se edita en la pantalla de revisión de un Excel de costeo y lo que
 * viaja a `POST /api/costeos`. Son tipos planos: los usan el servidor y el
 * componente de cliente.
 */
export type StatusCotizacionRevisable = "BORRADOR" | "ENVIADA" | "AUTORIZADA";
export type ConceptoGasto = "GASOLINA" | "ADMINISTRATIVO" | "EPP" | "EQUIPO";

/** Clave de renglón sólo para React (inserciones y borrados); el servidor la ignora. */
export interface ConClave {
  clave?: string;
}

export interface PersonaRevision extends ConClave {
  nombre: string;
  idPuesto: number;
  dias: number;
  salarioDiario: number;
  imssDiario: number;
  desgasteDiario: number;
  bono: number;
}

export interface InsumoRevision extends ConClave {
  idInsumo: number | null;
  descripcion: string;
  unidades: number;
  costo: number;
  costoReal: number;
  aplica: boolean;
}

export interface GastoRevision extends ConClave {
  concepto: ConceptoGasto;
  fecha: string | null;
  descripcion: string;
  cantidad: number;
}

export interface ValoresCosteo {
  noCotizacion: number;
  folio: number | null;
  /** Levantamiento al que se liga la cotización, si el folio existe y sigue libre. */
  idLevantamiento: number | null;
  idCliente: number | "nuevo";
  clienteNuevo: string;
  contacto: string;
  descripcion: string;
  fecha: string;
  dias: number;
  precioVenta: number;
  isr: number;
  statusCotizacion: StatusCotizacionRevisable;
  autorizadoPor: string;
  idVendedor: number | null;
  porcentajes: Porcentajes;
  nomina: PersonaRevision[];
  insumos: InsumoRevision[];
  gastos: GastoRevision[];
  /** Gasto real por concepto, sólo cuando el Excel ya lo traía distinto del plan. */
  conceptosReal: Record<Concepto, number> | null;
  /** Sólo al editar un costeo guardado. */
  statusCosteo?: "PLANEADO" | "EN_PROCESO" | "CERRADO";
}

/** Lo que el Excel dice que da el costeo, para comprobar que el motor cuadra. */
export interface ReferenciaExcel {
  gastoTotal: number;
  utilidadNeta: number;
}

/** Qué levantamiento se encontró para el folio del Excel, para explicarlo en pantalla. */
export interface LevantamientoLigado {
  idLevantamiento: number;
  folio: number;
  proyecto: string;
  cliente: string;
  noCotizacion: number | null;
}
