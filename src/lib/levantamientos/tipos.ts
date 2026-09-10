/** Formas que comparten el asistente de captura y quien lo precarga (importación de PDF). */

export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO";

export interface Actividad {
  descripcion: string;
  metros: number;
}

export interface LineaPersonal {
  idPuesto: number;
  cantidad: number;
  tiempoExtra: boolean;
  bono: boolean;
}

export interface LineaInsumo {
  idInsumo: number | null;
  descripcion: string;
  cantidad: number;
  costo: number;
  esHerramental: boolean;
  aplica: boolean;
}

/** Todo lo que el asistente puede traer ya lleno al abrirse. */
export interface ValoresIniciales {
  idCliente: number | "nuevo";
  clienteNuevo: string;
  proyecto: string;
  areaTrabajo: string;
  usuarioContacto: string;
  correoUsuario: string;
  fecha: string;
  nivelRiesgo: NivelRiesgo;
  dias: number;
  trabajoNormal: boolean;
  trabajoExtra: boolean;
  aplicaCena: boolean;
  aplicaBono: boolean;
  elaboro: string;
  actividades: Actividad[];
  observaciones: string;
  personal: LineaPersonal[];
  insumos: LineaInsumo[];
}
