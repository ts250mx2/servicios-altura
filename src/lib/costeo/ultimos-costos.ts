import { normalizar } from "@/lib/importacion/lineas";

/** Una partida de un costeo anterior, de la más reciente a la más vieja. */
export interface CostoHistorico {
  IdInsumo: number | null;
  Descripcion: string;
  Unidades: number;
  CostoPlan: number;
}

/**
 * Último costo unitario con el que se costeó cada insumo o herramental. Se busca
 * por Id de catálogo y, para la captura libre, por descripción normalizada.
 */
export interface UltimosCostos {
  porId: Record<number, number>;
  porDescripcion: Record<string, number>;
}

export const SIN_ULTIMOS_COSTOS: UltimosCostos = { porId: {}, porDescripcion: {} };

/** Las filas llegan de la más reciente a la más vieja: gana la primera de cada insumo. */
export function indiceUltimosCostos(filas: CostoHistorico[]): UltimosCostos {
  return filas.reduce<UltimosCostos>((indice, fila) => {
    const unidades = Number(fila.Unidades);
    const costo = Number(fila.CostoPlan);
    if (!(unidades > 0) || !(costo > 0)) return indice;

    const unitario = costo / unidades;
    const clave = normalizar(fila.Descripcion);
    const faltaId = fila.IdInsumo !== null && !(fila.IdInsumo in indice.porId);
    const faltaDescripcion = clave !== "" && !(clave in indice.porDescripcion);
    if (!faltaId && !faltaDescripcion) return indice;

    return {
      porId: faltaId ? { ...indice.porId, [fila.IdInsumo as number]: unitario } : indice.porId,
      porDescripcion: faltaDescripcion ? { ...indice.porDescripcion, [clave]: unitario } : indice.porDescripcion,
    };
  }, SIN_ULTIMOS_COSTOS);
}

/**
 * Costo unitario de una partida: primero el último costeado (la descripción exacta
 * manda sobre el Id), luego el del catálogo. `null` si nunca se ha costeado.
 */
export function costoUnitarioDe(
  partida: { idInsumo: number | null; descripcion: string },
  ultimos: UltimosCostos,
  costoCatalogo?: number | null,
): number | null {
  const historico =
    ultimos.porDescripcion[normalizar(partida.descripcion)] ??
    (partida.idInsumo !== null ? ultimos.porId[partida.idInsumo] : undefined);
  if (historico !== undefined) return historico;
  return costoCatalogo !== undefined && costoCatalogo !== null ? Number(costoCatalogo) : null;
}

/** Importe de la partida a dos decimales, como se captura. */
export function importePartida(costoUnitario: number, cantidad: number): number {
  return Math.round(costoUnitario * cantidad * 100) / 100;
}
