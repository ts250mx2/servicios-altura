import type { TarjetaProyecto } from "@/lib/consultas/proyectos";

/**
 * Las columnas del tablero siguen el flujo del negocio. Cada tarjeta cae en una
 * sola columna según lo más avanzado que tenga: costeo > cotización > levantamiento.
 */
export const COLUMNAS = [
  { clave: "LEVANTADO", titulo: "Levantado", ayuda: "Hoja capturada, todavía en borrador." },
  { clave: "LISTO", titulo: "Listo para cotizar", ayuda: "Levantamiento cerrado; falta ponerle precio." },
  { clave: "COTIZANDO", titulo: "Cotización en borrador", ayuda: "Ya tiene precio y costeo; aún no se manda." },
  { clave: "ENVIADA", titulo: "Enviada al cliente", ayuda: "Esperando respuesta del cliente." },
  { clave: "AUTORIZADA", titulo: "Autorizada", ayuda: "El cliente dijo que sí; el trabajo no ha empezado." },
  { clave: "EN_OBRA", titulo: "En obra", ayuda: "Se está ejecutando; se captura el gasto real." },
  { clave: "TERMINADO", titulo: "Terminado", ayuda: "Costeo cerrado: plan contra real definitivo." },
  { clave: "PERDIDO", titulo: "Rechazado / cancelado", ayuda: "No se hizo o el cliente lo rechazó." },
] as const;

export type ClaveColumna = (typeof COLUMNAS)[number]["clave"];

export function columnaDe(t: TarjetaProyecto): ClaveColumna {
  if (t.levantamiento?.status === "CANCELADO") return "PERDIDO";
  if (t.cotizacion?.status === "RECHAZADA" || t.cotizacion?.status === "CANCELADA") return "PERDIDO";
  if (t.costeo?.status === "CERRADO") return "TERMINADO";
  if (t.costeo?.status === "EN_PROCESO") return "EN_OBRA";
  if (t.cotizacion?.status === "AUTORIZADA") return "AUTORIZADA";
  if (t.cotizacion?.status === "ENVIADA") return "ENVIADA";
  if (t.cotizacion) return "COTIZANDO";
  if (t.levantamiento?.status === "CERRADO") return "LISTO";
  return "LEVANTADO";
}

export interface CambiosDeEstado {
  levantamiento?: "BORRADOR" | "CERRADO" | "CANCELADO";
  cotizacion?: "BORRADOR" | "ENVIADA" | "AUTORIZADA" | "RECHAZADA";
  costeo?: "PLANEADO" | "EN_PROCESO" | "CERRADO";
}

/**
 * Qué hay que cambiar para que la tarjeta quede en la columna pedida, o por qué
 * no se puede. Es una función pura: se prueba sin base de datos.
 */
export function cambiosParaColumna(
  t: TarjetaProyecto,
  destino: ClaveColumna,
): { ok: true; cambios: CambiosDeEstado } | { ok: false; motivo: string } {
  const tieneCot = t.cotizacion !== null;
  const tieneCosteo = t.costeo !== null;
  switch (destino) {
    case "LEVANTADO":
      if (tieneCot) return { ok: false, motivo: "Ya tiene cotización; no puede regresar a levantado." };
      if (!t.levantamiento) return { ok: false, motivo: "Esta cotización no tiene hoja de levantamiento." };
      return { ok: true, cambios: { levantamiento: "BORRADOR" } };
    case "LISTO":
      if (tieneCot) return { ok: false, motivo: "Ya tiene cotización; no puede regresar a «listo para cotizar»." };
      if (!t.levantamiento) return { ok: false, motivo: "Esta cotización no tiene hoja de levantamiento." };
      return { ok: true, cambios: { levantamiento: "CERRADO" } };
    case "COTIZANDO":
      if (!tieneCot) return { ok: false, motivo: "Primero genera la cotización desde la ficha del levantamiento." };
      return { ok: true, cambios: { cotizacion: "BORRADOR", ...(tieneCosteo ? { costeo: "PLANEADO" as const } : {}) } };
    case "ENVIADA":
      if (!tieneCot) return { ok: false, motivo: "Primero genera la cotización desde la ficha del levantamiento." };
      return { ok: true, cambios: { cotizacion: "ENVIADA", ...(tieneCosteo ? { costeo: "PLANEADO" as const } : {}) } };
    case "AUTORIZADA":
      if (!tieneCot) return { ok: false, motivo: "Primero genera la cotización desde la ficha del levantamiento." };
      return { ok: true, cambios: { cotizacion: "AUTORIZADA", ...(tieneCosteo ? { costeo: "PLANEADO" as const } : {}) } };
    case "EN_OBRA":
      if (!tieneCosteo) return { ok: false, motivo: "Para pasar a obra hace falta el costeo." };
      return { ok: true, cambios: { cotizacion: "AUTORIZADA", costeo: "EN_PROCESO" } };
    case "TERMINADO":
      if (!tieneCosteo) return { ok: false, motivo: "Para terminar hace falta el costeo." };
      return { ok: true, cambios: { cotizacion: "AUTORIZADA", costeo: "CERRADO" } };
    case "PERDIDO":
      if (tieneCot) return { ok: true, cambios: { cotizacion: "RECHAZADA" } };
      if (t.levantamiento) return { ok: true, cambios: { levantamiento: "CANCELADO" } };
      return { ok: false, motivo: "No hay nada que cancelar." };
  }
}
