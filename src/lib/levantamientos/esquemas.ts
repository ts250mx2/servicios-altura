import { z } from "zod";

/** Encabezado de la hoja de levantamiento, tal como lo manda el asistente de captura. */
export const EsquemaLevantamiento = z.object({
  folio: z.number().int().positive(),
  idCliente: z.number().int().positive().nullable(),
  clienteNuevo: z.string().max(200).optional().default(""),
  proyecto: z.string().min(1).max(500),
  areaTrabajo: z.string().max(300).optional().default(""),
  usuarioContacto: z.string().max(160).optional().default(""),
  correoUsuario: z.string().max(160).optional().default(""),
  fecha: z.string().min(10).max(10),
  nivelRiesgo: z.enum(["BAJO", "MEDIO", "ALTO"]),
  dias: z.number().int().min(1).max(365),
  trabajoNormal: z.boolean().optional().default(true),
  trabajoExtra: z.boolean(),
  aplicaCena: z.boolean(),
  aplicaBono: z.boolean(),
  observaciones: z.string().max(4000).optional().default(""),
  elaboro: z.string().max(160).optional().default(""),
  status: z.enum(["BORRADOR", "CERRADO", "COTIZADO"]),
});
export type DatosLevantamiento = z.infer<typeof EsquemaLevantamiento>;

export const EsquemaActividades = z.array(z.object({ descripcion: z.string().max(4000), metros: z.number().min(0) })).max(100);

export const EsquemaPersonal = z.array(
  z.object({
    idPuesto: z.number().int(),
    cantidad: z.number().int().min(0).max(500),
    tiempoExtra: z.boolean(),
    bono: z.boolean(),
  }),
).max(50);

export const EsquemaInsumosLevantamiento = z.array(
  z.object({
    idInsumo: z.number().int().nullable(),
    descripcion: z.string().max(255),
    cantidad: z.number().min(0),
    costo: z.number().min(0),
    esHerramental: z.boolean(),
    aplica: z.boolean(),
  }),
).max(300);

/** Lo que el paso 4 manda para generar cotización y costeo junto con el levantamiento. */
export const EsquemaCosteoCaptura = z.object({
  noCotizacion: z.number().int().positive(),
  metodoPrecio: z.enum(["TARIFA", "MARGEN", "MANUAL"]),
  precioVenta: z.number().min(0),
  porcentajes: z.object({
    impuestosPct: z.number(),
    administrativosPct: z.number(),
    financiamientoPct: z.number(),
    comisionPct: z.number(),
  }),
  gastos: z.object({
    gasolina: z.number(),
    administrativo: z.number(),
    epp: z.number(),
    equipo: z.number(),
  }),
});

export interface DetalleLevantamiento {
  actividades: z.infer<typeof EsquemaActividades>;
  personal: z.infer<typeof EsquemaPersonal>;
  insumos: z.infer<typeof EsquemaInsumosLevantamiento>;
}
