import { z } from "zod";

/**
 * Lo que se extrae de la hoja "LEVANTAMIENTO DE PROYECTO" (plantilla mPDF).
 * Es un espejo fiel del papel: los puestos van por su etiqueta de columna y
 * los insumos sin costo. El empate contra catálogos se hace después, en
 * `preparar.ts`, para que el parser sea puro y se pruebe sin base de datos.
 */
export const ActividadExtraida = z.object({
  descripcion: z.string(),
  metros: z.number(),
});

export const PartidaExtraida = z.object({
  cantidad: z.number(),
  descripcion: z.string(),
});

export const PersonalExtraido = z.object({
  puesto: z.string(),
  cantidad: z.number().int(),
  tiempoExtra: z.boolean(),
  bono: z.boolean(),
});

export const LevantamientoExtraido = z.object({
  noCotizacion: z.number().int().nullable(),
  folio: z.number().int().nullable(),
  fecha: z.string().nullable(),
  proyecto: z.string(),
  areaTrabajo: z.string(),
  cliente: z.string(),
  usuarioContacto: z.string(),
  correoUsuario: z.string(),
  responsable: z.string(),
  actividades: z.array(ActividadExtraida),
  observaciones: z.string(),
  personal: z.array(PersonalExtraido),
  nivelRiesgo: z.enum(["BAJO", "MEDIO", "ALTO"]).nullable(),
  insumos: z.array(PartidaExtraida),
  herramental: z.array(PartidaExtraida),
  dias: z.number().int().nullable(),
  trabajoNormal: z.boolean(),
  trabajoExtra: z.boolean(),
  aplicaCena: z.boolean(),
  aplicaBono: z.boolean(),
  elaboro: z.string(),
  recibio: z.string(),
  reviso: z.string(),
  /** Lo que no se pudo leer o quedó dudoso; se muestra en la pantalla de revisión. */
  avisos: z.array(z.string()),
});
export type LevantamientoExtraido = z.infer<typeof LevantamientoExtraido>;

/** Lo que se guarda en `tblImportaciones.JsonExtraido`. */
export const PaqueteImportacion = z.object({
  version: z.literal(1),
  datos: LevantamientoExtraido,
  /** Rutas públicas (/uploads/…) de las fotos extraídas, en orden. */
  evidencias: z.array(z.string().startsWith("/uploads/")),
});
export type PaqueteImportacion = z.infer<typeof PaqueteImportacion>;

/** Un fragmento de texto con su posición en la página; el origen es la esquina superior izquierda. */
export interface Fragmento {
  x: number;
  y: number;
  ancho: number;
  texto: string;
}

export interface PaginaTexto {
  numero: number;
  ancho: number;
  alto: number;
  fragmentos: Fragmento[];
}
