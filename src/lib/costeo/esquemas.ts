import { z } from "zod";
import { CONCEPTOS } from "./tipos";

export const EsquemaPersonaCosteo = z.object({
  nombre: z.string().min(1).max(160),
  idPuesto: z.number().int().positive(),
  dias: z.number().int().min(0).max(365),
  salarioDiario: z.number().min(0),
  imssDiario: z.number().min(0),
  desgasteDiario: z.number().min(0),
  bono: z.number().min(0),
});

export const EsquemaInsumoCosteo = z.object({
  idInsumo: z.number().int().nullable(),
  descripcion: z.string().min(1).max(255),
  unidades: z.number().min(0),
  costo: z.number().min(0),
  costoReal: z.number().min(0),
  aplica: z.boolean(),
});

export const EsquemaGastoCosteo = z.object({
  concepto: z.enum(["GASOLINA", "ADMINISTRATIVO", "EPP", "EQUIPO"]),
  fecha: z.string().length(10).nullable(),
  descripcion: z.string().max(255),
  cantidad: z.number().min(0),
});

/** Cuerpo de `POST /api/costeos` y `PUT /api/costeos/[id]`: la cotización y todo el detalle del costeo. */
export const EsquemaCosteoCompleto = z.object({
  noCotizacion: z.number().int().positive(),
  idLevantamiento: z.number().int().positive().nullable(),
  idCliente: z.number().int().positive().nullable(),
  clienteNuevo: z.string().max(200),
  contacto: z.string().max(160),
  descripcion: z.string().min(1).max(500),
  fecha: z.string().length(10),
  dias: z.number().int().min(1).max(365),
  precioVenta: z.number().min(0),
  isr: z.number().min(0),
  statusCotizacion: z.enum(["BORRADOR", "ENVIADA", "AUTORIZADA"]),
  autorizadoPor: z.string().max(160),
  idVendedor: z.number().int().positive().nullable(),
  porcentajes: z.object({
    impuestosPct: z.number().min(0).max(100),
    administrativosPct: z.number().min(0).max(100),
    financiamientoPct: z.number().min(0).max(100),
    comisionPct: z.number().min(0).max(100),
  }),
  // Topes generosos para un proyecto real; evitan que una petición enorme bloquee la base.
  nomina: z.array(EsquemaPersonaCosteo).max(100),
  insumos: z.array(EsquemaInsumoCosteo).max(300),
  gastos: z.array(EsquemaGastoCosteo).max(300),
  conceptosReal: z.record(z.enum(CONCEPTOS), z.number().min(0)).nullable(),
  /** Sólo al editar: el estatus del costeo (plan, en obra, cerrado). */
  statusCosteo: z.enum(["PLANEADO", "EN_PROCESO", "CERRADO"]).optional(),
});
export type DatosCosteoCompleto = z.infer<typeof EsquemaCosteoCompleto>;
