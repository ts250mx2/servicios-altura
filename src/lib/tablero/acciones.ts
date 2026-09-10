import type { AccionEstado } from "@/components/proyectos/AccionesEstado";
import type { CadenaProyecto } from "@/lib/consultas/proyectos";

/** Qué botones de estatus tienen sentido en cada ficha según lo que ya existe. */
export function accionesDeLevantamiento(c: CadenaProyecto): AccionEstado[] {
  const lev = c.levantamiento;
  if (!lev || c.cotizacion) return [];
  if (lev.status === "CANCELADO") return [{ destino: "LEVANTADO", texto: "Reabrir" }];
  return [
    lev.status === "BORRADOR"
      ? { destino: "LISTO", texto: "Marcar listo para cotizar", primaria: true }
      : { destino: "LEVANTADO", texto: "Regresar a borrador" },
    { destino: "PERDIDO", texto: "Cancelar", confirmar: "¿Cancelar este levantamiento? Se puede reabrir después." },
  ];
}

export function accionesDeCotizacion(c: CadenaProyecto): AccionEstado[] {
  const cot = c.cotizacion;
  if (!cot) return [];
  switch (cot.status) {
    case "BORRADOR":
      return [{ destino: "ENVIADA", texto: "Marcar como enviada", primaria: true }];
    case "ENVIADA":
      return [
        { destino: "AUTORIZADA", texto: "El cliente autorizó", primaria: true },
        { destino: "PERDIDO", texto: "El cliente rechazó", confirmar: "¿Marcar la cotización como rechazada?" },
      ];
    case "AUTORIZADA":
      return c.costeo && c.costeo.status === "PLANEADO"
        ? [{ destino: "EN_OBRA", texto: "Iniciar obra", primaria: true }, { destino: "ENVIADA", texto: "Regresar a enviada" }]
        : [{ destino: "ENVIADA", texto: "Regresar a enviada" }];
    default:
      return [{ destino: "ENVIADA", texto: "Reactivar como enviada" }];
  }
}

export function accionesDeCosteo(c: CadenaProyecto): AccionEstado[] {
  const costeo = c.costeo;
  if (!costeo) return [];
  switch (costeo.status) {
    case "PLANEADO":
      return [{ destino: "EN_OBRA", texto: "Iniciar obra", primaria: true }];
    case "EN_PROCESO":
      return [
        { destino: "TERMINADO", texto: "Cerrar costeo", primaria: true, confirmar: "¿Cerrar el costeo? El plan contra real queda como definitivo." },
        { destino: "AUTORIZADA", texto: "Regresar a planeado" },
      ];
    default:
      return [{ destino: "EN_OBRA", texto: "Reabrir en obra" }];
  }
}

/** Clave de tarjeta del tablero para un proyecto: el levantamiento manda; si no hay, la cotización. */
export function claveDe(c: CadenaProyecto): string | null {
  if (c.levantamiento) return `L${c.levantamiento.id}`;
  if (c.cotizacion) return `C${c.cotizacion.id}`;
  return null;
}
