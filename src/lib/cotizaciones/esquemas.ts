import { z } from "zod";

export const EsquemaPartida = z.object({
  concepto: z.string().min(1).max(2000),
  unidad: z.string().min(1).max(30),
  cantidad: z.number().min(0),
  precioUnitario: z.number().min(0),
});

/** Cuerpo de `PUT /api/cotizaciones/[id]`: encabezado comercial y partidas. */
export const EsquemaCotizacion = z.object({
  fecha: z.string().length(10),
  vigencia: z.number().int().min(1).max(365),
  descripcion: z.string().min(1).max(500),
  condiciones: z.string().max(4000),
  idVendedor: z.number().int().positive().nullable(),
  descuentoPct: z.number().min(0).max(100),
  status: z.enum(["BORRADOR", "ENVIADA", "AUTORIZADA", "RECHAZADA", "CANCELADA"]),
  autorizadoPor: z.string().max(160),
  motivoRechazo: z.string().max(300),
  partidas: z.array(EsquemaPartida).min(1).max(100),
});
export type DatosCotizacion = z.infer<typeof EsquemaCotizacion>;

/** Lo que edita la pantalla de cotización; mismo cuerpo que la API más los ids para el cliente. */
export interface ValoresCotizacion extends DatosCotizacion {
  idCotizacion: number;
  noCotizacion: number;
  ivaPct: number;
}
