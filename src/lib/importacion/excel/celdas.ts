import type { CellValue, Workbook, Worksheet } from "exceljs";
import { normalizar } from "../lineas";

/** Lo que puede haber en una celda una vez resueltas fórmulas, texto enriquecido y errores. */
export type Escalar = number | string | Date | null;

/** Hasta dónde se buscan etiquetas en una hoja; ninguna tabla de la plantilla pasa de aquí. */
export const MAX_FILAS_BUSQUEDA = 80;

/** "A" → 1, "AI" → 35. */
export function columna(letras: string): number {
  return [...letras.toUpperCase()].reduce((n, letra) => n * 26 + (letra.charCodeAt(0) - 64), 0);
}

/** Valor plano de una celda: el resultado de la fórmula, el texto pegado, o null si es error o está vacía. */
export function escalar(valor: CellValue): Escalar {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number" || typeof valor === "string") return valor;
  if (typeof valor === "boolean") return valor ? 1 : 0;
  if (valor instanceof Date) return valor;
  if ("richText" in valor) return valor.richText.map((r) => r.text).join("");
  if ("formula" in valor || "sharedFormula" in valor) {
    const resultado = (valor as { result?: CellValue }).result;
    return resultado === undefined ? null : escalar(resultado as CellValue);
  }
  if ("hyperlink" in valor) return escalar(valor.text as CellValue);
  return null; // CellErrorValue (#REF!, #DIV/0!…)
}

export function celda(hoja: Worksheet, fila: number, col: number): Escalar {
  return escalar(hoja.getCell(fila, col).value);
}

export function texto(hoja: Worksheet, fila: number, col: number): string {
  const valor = celda(hoja, fila, col);
  if (valor === null) return "";
  if (valor instanceof Date) return fechaIso(valor) ?? "";
  return String(valor).trim();
}

/** Número de la celda; null si está vacía o no es numérica. "1,250.50" también cuenta. */
export function numero(hoja: Worksheet, fila: number, col: number): number | null {
  const valor = celda(hoja, fila, col);
  if (valor === null || valor instanceof Date) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const limpio = Number.parseFloat(valor.replace(/[$,\s]/g, ""));
  return Number.isFinite(limpio) ? limpio : null;
}

/** Fecha en ISO (yyyy-mm-dd) o null. Acepta celdas de fecha, "2026-08-26" y "26/08/2026". */
export function fecha(hoja: Worksheet, fila: number, col: number): string | null {
  return fechaIso(celda(hoja, fila, col));
}

export function fechaIso(valor: Escalar): string | null {
  if (valor === null) return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return valor.toISOString().slice(0, 10);
  }
  if (typeof valor === "number") return null;
  const iso = valor.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dma = valor.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dma) return `${dma[3]}-${dma[2].padStart(2, "0")}-${dma[1].padStart(2, "0")}`;
  return null;
}

/** Hoja cuyo nombre coincide sin importar acentos, mayúsculas ni espacios sobrantes. */
export function hojaPorNombre(libro: Workbook, nombre: string): Worksheet | undefined {
  const buscado = normalizar(nombre);
  return libro.worksheets.find((h) => normalizar(h.name) === buscado);
}

/** Primera fila (1-based) cuya celda en `col` empieza con la etiqueta, o -1. */
export function filaConEtiqueta(
  hoja: Worksheet,
  col: number,
  etiqueta: string,
  desde = 1,
  hasta = MAX_FILAS_BUSQUEDA,
): number {
  const buscado = normalizar(etiqueta);
  for (let fila = desde; fila <= hasta; fila++) {
    if (normalizar(texto(hoja, fila, col)).startsWith(buscado)) return fila;
  }
  return -1;
}

/** Última fila cuya celda en `col` empieza con la etiqueta, o -1 (para etiquetas repetidas). */
export function ultimaFilaConEtiqueta(hoja: Worksheet, col: number, etiqueta: string): number {
  const buscado = normalizar(etiqueta);
  let encontrada = -1;
  for (let fila = 1; fila <= MAX_FILAS_BUSQUEDA; fila++) {
    if (normalizar(texto(hoja, fila, col)).startsWith(buscado)) encontrada = fila;
  }
  return encontrada;
}

/**
 * Busca una etiqueta ("Usuario:", "Cotización:") en cualquier celda del bloque
 * de encabezado y devuelve la celda inmediata a su derecha.
 */
export function valorJuntoA(
  hoja: Worksheet,
  etiqueta: string,
  filas = 12,
  columnas = 10,
): Escalar {
  const buscado = normalizar(etiqueta).replace(/:$/, "");
  for (let fila = 1; fila <= filas; fila++) {
    for (let col = 1; col <= columnas; col++) {
      const contenido = normalizar(texto(hoja, fila, col)).replace(/:$/, "");
      if (contenido === buscado) return celda(hoja, fila, col + 1);
    }
  }
  return null;
}

export function comoNumero(valor: Escalar): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") {
    const n = Number.parseFloat(valor.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function comoTexto(valor: Escalar): string {
  if (valor === null) return "";
  if (valor instanceof Date) return fechaIso(valor) ?? "";
  return String(valor).trim();
}
