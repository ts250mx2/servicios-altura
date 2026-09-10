import { z } from "zod";
import { CONCEPTOS } from "@/lib/costeo/tipos";

/**
 * Lo que se extrae del Excel de costeo de 12 hojas ("NoC. NNNN …xlsx").
 * Espejo del archivo, sin empatar contra catálogos: eso lo hace `preparar.ts`.
 */
export const PorcentajesExtraidos = z.object({
  impuestosPct: z.number(),
  administrativosPct: z.number(),
  financiamientoPct: z.number(),
  comisionPct: z.number(),
});

export const ConceptosExtraidos = z.object(
  Object.fromEntries(CONCEPTOS.map((c) => [c, z.number()])) as Record<
    (typeof CONCEPTOS)[number],
    z.ZodNumber
  >,
);

/** Una persona de la matriz persona × día, ya fundidas las hojas Nomina, Imss y Desgaste. */
export const PersonaExtraida = z.object({
  nombre: z.string(),
  dias: z.number().int(),
  salarioDiario: z.number(),
  imssDiario: z.number(),
  desgasteDiario: z.number(),
  bono: z.number(),
});

export const InsumoExtraido = z.object({
  descripcion: z.string(),
  unidades: z.number(),
  costoPlan: z.number(),
  costoReal: z.number(),
  fecha: z.string().nullable(),
  comentario: z.string(),
  aplica: z.boolean(),
});

export const GastoExtraido = z.object({
  concepto: z.enum(["GASOLINA", "ADMINISTRATIVO", "EPP", "EQUIPO"]),
  fecha: z.string().nullable(),
  descripcion: z.string(),
  cantidad: z.number(),
});

export const CosteoExtraido = z.object({
  noCotizacion: z.number().int().nullable(),
  folio: z.number().int().nullable(),
  descripcion: z.string(),
  usuario: z.string(),
  planta: z.string(),
  vendedor: z.string(),
  fecha: z.string().nullable(),
  dias: z.number().int().nullable(),
  personal: z.number().int().nullable(),
  precioVenta: z.number(),
  isr: z.number(),
  autoriza: z.string(),
  porcentajes: PorcentajesExtraidos,
  conceptosPlan: ConceptosExtraidos,
  conceptosReal: ConceptosExtraidos,
  /** Los totales que el propio Excel calculó; sirven para comprobar que el motor cuadra. */
  gastoTotalExcel: z.number(),
  utilidadNetaExcel: z.number(),
  nomina: z.array(PersonaExtraida),
  insumos: z.array(InsumoExtraido),
  gastos: z.array(GastoExtraido),
  avisos: z.array(z.string()),
});
export type CosteoExtraido = z.infer<typeof CosteoExtraido>;
export type PersonaExtraida = z.infer<typeof PersonaExtraida>;
export type InsumoExtraido = z.infer<typeof InsumoExtraido>;
export type GastoExtraido = z.infer<typeof GastoExtraido>;

/** Lo que se guarda en `tblImportaciones.JsonExtraido` para una importación de Excel. */
export const PaqueteImportacionExcel = z.object({
  version: z.literal(1),
  tipo: z.literal("EXCEL"),
  datos: CosteoExtraido,
});
export type PaqueteImportacionExcel = z.infer<typeof PaqueteImportacionExcel>;
