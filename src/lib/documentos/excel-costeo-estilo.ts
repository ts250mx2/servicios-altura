import type ExcelJS from "exceljs";
import type { Worksheet } from "exceljs";
import { normalizar } from "@/lib/importacion/lineas";
import {
  BORDE_CELDA, FECHA, FUENTE_BLANCA, FUENTE_ETIQUETA, FUENTE_NAVY, MONEDA, RELLENO_AMARILLO, RELLENO_NAVY,
  RELLENO_NAVY_2, RELLENO_SUAVE, RELLENO_TOTAL, cuerpo, preparar, totalFila,
} from "./excel-base";

/**
 * Pasada de formato sobre el libro de costeo ya armado. No mueve ninguna
 * celda (el importador depende de las posiciones): sólo pinta, alinea,
 * da anchos, congela y prepara la impresión.
 */
export function estilizarLibroCosteo(libro: ExcelJS.Workbook): void {
  for (const hoja of libro.worksheets) {
    const nombre = normalizar(hoja.name);
    if (nombre === "GASTOS PROYECTO") estilizarGastos(hoja);
    else if (nombre === "NOMINA" || nombre === "IMSS") estilizarMatriz(hoja, 5, 2, 4, 5);
    else if (nombre === "DESGASTE DE EQUIPO") estilizarMatriz(hoja, 7, 1, 2, 3);
    else if (nombre === "TABLA DE MONTOS") estilizarTablaMontos(hoja);
    else estilizarLista(hoja);
  }
}

function ultimaFilaConValor(hoja: Worksheet, col: number, desde: number): number {
  let ultima = desde - 1;
  for (let fila = desde; fila <= hoja.rowCount; fila++) {
    const v = hoja.getCell(fila, col).value;
    if (v !== null && v !== undefined && v !== "") ultima = fila;
  }
  return ultima;
}

function etiquetas(hoja: Worksheet, filaInicio: number, filaFin: number, col: number): void {
  for (let fila = filaInicio; fila <= filaFin; fila++) {
    const celda = hoja.getCell(fila, col);
    if (typeof celda.value === "string" && celda.value) celda.font = FUENTE_ETIQUETA;
  }
}

// ── Gastos proyecto ─────────────────────────────────────────────────────────

function estilizarGastos(h: Worksheet): void {
  [34, 16, 16, 16, 20, 34, 16].forEach((ancho, i) => { h.getColumn(i + 1).width = ancho; });
  const t = h.getCell("A1");
  t.fill = RELLENO_NAVY;
  t.font = { ...FUENTE_BLANCA, size: 14 };
  t.alignment = { vertical: "middle", wrapText: true, indent: 1 };
  h.getRow(1).height = 40;
  h.getRow(2).height = 4;
  for (let col = 1; col <= 7; col++) h.getCell(2, col).fill = RELLENO_AMARILLO;

  for (const dir of ["A3", "A4", "A5", "A6", "A7", "C7", "F3", "F4", "F5", "F6"]) h.getCell(dir).font = FUENTE_ETIQUETA;
  for (const dir of ["B3", "B4", "B5", "B6", "B7", "D7", "G3", "G4", "G5", "G6"]) h.getCell(dir).font = { ...FUENTE_NAVY, bold: true };
  h.getCell("B5").alignment = { wrapText: true, vertical: "top" };
  h.getCell("B6").alignment = { wrapText: true, vertical: "top" };
  h.getCell("D7").numFmt = FECHA;

  // Las dos cadenas: plan (A-C) y real (F-G), con su encabezado en la fila 9
  for (const [dirEnc, cols] of [["A9", [1, 2, 3]], ["F9", [6, 7]]] as const) {
    const enc = h.getCell(dirEnc);
    enc.fill = RELLENO_NAVY_2;
    enc.font = FUENTE_BLANCA;
    for (const col of cols) { h.getCell(9, col).fill = RELLENO_NAVY_2; h.getCell(9, col).border = BORDE_CELDA; }
    for (let fila = 10; fila <= 23; fila++) {
      for (const col of cols) {
        const celda = h.getCell(fila, col);
        celda.border = BORDE_CELDA;
        celda.font = FUENTE_NAVY;
        if (col === cols[cols.length - 1]) celda.numFmt = MONEDA;
      }
    }
    for (const fila of [12, 20, 23]) {
      for (const col of cols) { h.getCell(fila, col).font = { ...FUENTE_NAVY, bold: true }; h.getCell(fila, col).fill = RELLENO_TOTAL; }
    }
    const precio = h.getCell(10, cols[cols.length - 1]);
    precio.fill = RELLENO_AMARILLO;
    precio.font = { ...FUENTE_NAVY, bold: true };
  }
  h.getCell("E10").font = { ...FUENTE_NAVY, bold: true, italic: true };

  // Resumen de conceptos
  for (let col = 1; col <= 6; col++) {
    const celda = h.getCell(25, col);
    celda.fill = RELLENO_NAVY;
    celda.font = FUENTE_BLANCA;
    celda.border = BORDE_CELDA;
    celda.alignment = { horizontal: col >= 3 && col <= 5 ? "right" : "left" };
  }
  cuerpo(h, 26, 34, 1, 6);
  for (let fila = 26; fila <= 34; fila++) for (const col of [3, 4, 5]) h.getCell(fila, col).numFmt = MONEDA;
  totalFila(h, 35, 1, 6);
  for (const col of [3, 4, 5]) h.getCell(35, col).numFmt = MONEDA;

  h.getCell("A39").font = FUENTE_ETIQUETA;
  preparar(h, 8, "landscape");
}

// ── Matrices persona × día ──────────────────────────────────────────────────

function estilizarMatriz(h: Worksheet, filaEnc: number, colNombre: number, colTarifa: number, colDiaInicio: number): void {
  etiquetas(h, 1, 3, 1);
  for (let fila = 1; fila <= 3; fila++) h.getCell(fila, colTarifa === 4 ? 3 : 2).numFmt = MONEDA;
  const ultimaFila = ultimaFilaConValor(h, colNombre, filaEnc + 1);
  const ultimaCol = Math.max(colDiaInicio, ...[...Array(h.columnCount).keys()].map((i) => i + 1).filter((c) => h.getCell(filaEnc, c).value !== null && h.getCell(filaEnc, c).value !== undefined));
  const colTotal = h.columnCount;
  for (let col = 1; col <= ultimaCol; col++) {
    const celda = h.getCell(filaEnc, col);
    celda.fill = RELLENO_NAVY;
    celda.font = FUENTE_BLANCA;
    celda.border = BORDE_CELDA;
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    if (col >= colDiaInicio) { celda.numFmt = "dd/mm"; h.getColumn(col).width = 8; }
  }
  h.getRow(filaEnc).height = 28;
  h.getColumn(colNombre).width = 22;
  h.getColumn(colTarifa).width = 12;
  if (ultimaFila >= filaEnc + 1) {
    cuerpo(h, filaEnc + 1, ultimaFila, 1, ultimaCol);
    for (let fila = filaEnc + 1; fila <= ultimaFila; fila++) {
      for (let col = colTarifa; col <= ultimaCol; col++) h.getCell(fila, col).numFmt = MONEDA;
      const total = h.getCell(fila, colTotal);
      total.numFmt = MONEDA;
      total.font = { ...FUENTE_NAVY, bold: true };
      total.border = BORDE_CELDA;
    }
    const filaTotal = ultimaFila + 1;
    h.getCell(filaTotal, colTotal - 1).value = h.getCell(filaTotal, colTotal - 1).value ?? "TOTAL";
    totalFila(h, filaTotal, colTotal - 1, colTotal);
    h.getCell(filaTotal, colTotal).numFmt = MONEDA;
  }
  h.getColumn(colTotal).width = 14;
  h.getCell(filaEnc, colTotal).value = h.getCell(filaEnc, colTotal).value ?? "TOTAL";
  h.getCell(filaEnc, colTotal).fill = RELLENO_NAVY;
  h.getCell(filaEnc, colTotal).font = FUENTE_BLANCA;
  preparar(h, filaEnc, "landscape");
}

// ── Listas (Bonos, Insumos, Gasolina, Administrativos, Epp, Compra de Equipo) ──

function estilizarLista(h: Worksheet): void {
  etiquetas(h, 1, 3, 1);
  const colValorResumen = typeof h.getCell(1, 3).value === "number" || typeof h.getCell(1, 3).value === "object" ? 3 : 2;
  for (let fila = 1; fila <= 3; fila++) h.getCell(fila, colValorResumen).numFmt = MONEDA;
  const t5 = h.getCell(5, 1);
  if (t5.value) {
    const ancho = Math.max(4, h.columnCount);
    for (let col = 1; col <= ancho; col++) { h.getCell(5, col).fill = RELLENO_NAVY_2; h.getCell(5, col).font = FUENTE_BLANCA; }
    h.getRow(5).height = 20;
  }
  const ultimaCol = Math.max(2, ...[...Array(h.columnCount).keys()].map((i) => i + 1).filter((c) => h.getCell(6, c).value));
  for (let col = 1; col <= ultimaCol; col++) {
    const celda = h.getCell(6, col);
    celda.fill = RELLENO_NAVY;
    celda.font = FUENTE_BLANCA;
    celda.border = BORDE_CELDA;
    celda.alignment = { horizontal: "center" };
  }
  const filaTotal = [...Array(h.rowCount).keys()].map((i) => i + 1).find((fila) => fila > 6 && (normalizar(String(h.getCell(fila, 1).value ?? "")) === "TOTAL" || esFormula(h, fila, ultimaCol)));
  const ultimaFila = (filaTotal ?? h.rowCount + 1) - 1;
  if (ultimaFila >= 7) {
    cuerpo(h, 7, ultimaFila, 1, ultimaCol);
    for (let fila = 7; fila <= ultimaFila; fila++) {
      for (let col = 2; col <= ultimaCol; col++) {
        const celda = h.getCell(fila, col);
        if (typeof celda.value === "number" && col > 2) celda.numFmt = MONEDA;
        if (celda.value instanceof Date) celda.numFmt = FECHA;
      }
      if (h.getCell(fila, 2).value instanceof Date) h.getCell(fila, 2).numFmt = FECHA;
    }
  }
  if (filaTotal) {
    totalFila(h, filaTotal, 1, ultimaCol);
    for (let col = 2; col <= ultimaCol; col++) if (esFormula(h, filaTotal, col) || typeof h.getCell(filaTotal, col).value === "number") h.getCell(filaTotal, col).numFmt = MONEDA;
  }
  if (h.getColumn(2).width === undefined || h.getColumn(2).width! < 20) h.getColumn(2).width = 24;
  h.getColumn(1).width = Math.max(h.getColumn(1).width ?? 0, 12);
  preparar(h, 6, "portrait");
}

function esFormula(h: Worksheet, fila: number, col: number): boolean {
  const v = h.getCell(fila, col).value;
  return typeof v === "object" && v !== null && "formula" in v;
}

// ── Tabla de montos ─────────────────────────────────────────────────────────

function estilizarTablaMontos(h: Worksheet): void {
  for (const fila of [1, 5]) {
    for (let col = 1; col <= 10; col++) { h.getCell(fila, col).fill = RELLENO_NAVY; h.getCell(fila, col).font = FUENTE_BLANCA; }
  }
  for (const fila of [2, 3, 6, 7]) {
    h.getCell(fila, 1).font = FUENTE_ETIQUETA;
    for (let col = 2; col <= 10; col++) {
      const celda = h.getCell(fila, col);
      celda.numFmt = MONEDA;
      celda.border = BORDE_CELDA;
      if (fila === 3 || fila === 7) celda.fill = RELLENO_SUAVE;
    }
  }
  for (let col = 2; col <= 10; col++) h.getColumn(col).width = 14;
  h.getColumn(1).width = 22;
  preparar(h, 0, "landscape");
}
