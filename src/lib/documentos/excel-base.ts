import ExcelJS, { type Worksheet } from "exceljs";

/** Identidad en Excel: navy para encabezados, amarillo como acento, gris suave para la cebra. */
export const RELLENO_NAVY: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF051622" } };
export const RELLENO_NAVY_2: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2E42" } };
export const RELLENO_AMARILLO: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5C400" } };
export const RELLENO_SUAVE: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F6F8" } };
export const RELLENO_TOTAL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6ECF0" } };
export const FUENTE_BLANCA: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
export const FUENTE_ETIQUETA: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF63808F" }, name: "Calibri", size: 10 };
export const FUENTE_NAVY: Partial<ExcelJS.Font> = { color: { argb: "FF051622" }, name: "Calibri", size: 11 };
export const MONEDA = '"$"#,##0.00';
export const FECHA = "dd/mm/yyyy";

const LINEA: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFC9D3DA" } };
const LINEA_FUERTE: Partial<ExcelJS.Border> = { style: "medium", color: { argb: "FF26536F" } };
export const BORDE_CELDA: Partial<ExcelJS.Borders> = { top: LINEA, left: LINEA, bottom: LINEA, right: LINEA };

export function nuevoLibro(): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Servicios de Altura";
  libro.created = new Date();
  return libro;
}

/** Banda de marca: título en navy con texto blanco y un filete amarillo debajo. */
export function bandaMarca(hoja: Worksheet, titulo: string, subtitulo: string, columnas: number): number {
  hoja.mergeCells(1, 1, 1, columnas);
  const t = hoja.getCell(1, 1);
  t.value = titulo;
  t.fill = RELLENO_NAVY;
  t.font = { ...FUENTE_BLANCA, size: 16 };
  t.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(1).height = 34;
  hoja.mergeCells(2, 1, 2, columnas);
  const s = hoja.getCell(2, 1);
  s.value = subtitulo;
  s.fill = RELLENO_NAVY;
  s.font = { color: { argb: "FF9DB3C1" }, name: "Calibri", size: 10 };
  s.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(2).height = 18;
  hoja.mergeCells(3, 1, 3, columnas);
  hoja.getCell(3, 1).fill = RELLENO_AMARILLO;
  hoja.getRow(3).height = 4;
  return 5;
}

/** Título de sección: fila navy con texto blanco. */
export function titulo(hoja: Worksheet, fila: number, texto: string, columnas = 6): number {
  hoja.mergeCells(fila, 1, fila, columnas);
  const celda = hoja.getCell(fila, 1);
  celda.value = texto;
  celda.fill = RELLENO_NAVY_2;
  celda.font = { ...FUENTE_BLANCA, size: 12 };
  celda.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(fila).height = 22;
  return fila + 1;
}

/** Encabezado de tabla: relleno navy, texto blanco, bordes. */
export function encabezados(hoja: Worksheet, fila: number, textos: (string | null)[], desde = 1): number {
  textos.forEach((t, i) => {
    const celda = hoja.getCell(fila, desde + i);
    celda.value = t ?? "";
    celda.font = FUENTE_BLANCA;
    celda.fill = RELLENO_NAVY;
    celda.border = BORDE_CELDA;
    celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  hoja.getRow(fila).height = 20;
  return fila + 1;
}

/** Cuerpo de tabla: bordes finos, cebra y alineación arriba. */
export function cuerpo(hoja: Worksheet, filaInicio: number, filaFin: number, colInicio: number, colFin: number): void {
  for (let fila = filaInicio; fila <= filaFin; fila++) {
    for (let col = colInicio; col <= colFin; col++) {
      const celda = hoja.getCell(fila, col);
      celda.border = BORDE_CELDA;
      celda.font = { ...FUENTE_NAVY, ...(celda.font ?? {}) };
      if ((fila - filaInicio) % 2 === 1 && !celda.fill) celda.fill = RELLENO_SUAVE;
      celda.alignment = { ...(celda.alignment ?? {}), vertical: "top", wrapText: celda.alignment?.wrapText ?? typeof celda.value === "string" };
    }
  }
}

/** Renglón de total: negritas, relleno y filete arriba. */
export function totalFila(hoja: Worksheet, fila: number, colInicio: number, colFin: number): void {
  for (let col = colInicio; col <= colFin; col++) {
    const celda = hoja.getCell(fila, col);
    celda.font = { ...FUENTE_NAVY, bold: true };
    celda.fill = RELLENO_TOTAL;
    celda.border = { ...BORDE_CELDA, top: LINEA_FUERTE };
  }
}

/** Pares etiqueta/valor a dos columnas, con la etiqueta en gris y el valor con ajuste de texto. */
export function pares(hoja: Worksheet, fila: number, lista: [string, ExcelJS.CellValue][], colEtiqueta = 1): number {
  for (const [etiqueta, valor] of lista) {
    const e = hoja.getCell(fila, colEtiqueta);
    e.value = etiqueta.toUpperCase();
    e.font = FUENTE_ETIQUETA;
    e.alignment = { vertical: "top" };
    const v = hoja.getCell(fila, colEtiqueta + 1);
    v.value = valor;
    v.font = FUENTE_NAVY;
    v.alignment = { vertical: "top", wrapText: true };
    if (valor instanceof Date) v.numFmt = FECHA;
    fila += 1;
  }
  return fila;
}

export function anchos(hoja: Worksheet, lista: number[]): void {
  lista.forEach((ancho, i) => {
    hoja.getColumn(i + 1).width = ancho;
  });
}

export function moneda(hoja: Worksheet, fila: number, col: number, valor: ExcelJS.CellValue): void {
  const celda = hoja.getCell(fila, col);
  celda.value = valor;
  celda.numFmt = MONEDA;
}

/** Congela las filas de arriba y deja la hoja lista para imprimir en una página de ancho. */
export function preparar(hoja: Worksheet, filasCongeladas: number, orientacion: "portrait" | "landscape" = "portrait"): void {
  hoja.views = [{ state: "frozen", ySplit: filasCongeladas, showGridLines: false }];
  hoja.pageSetup = { orientation: orientacion, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
  hoja.headerFooter = { oddFooter: "&LServicios de Altura&RPágina &P de &N" };
}

export async function bytesDe(libro: ExcelJS.Workbook): Promise<Uint8Array> {
  const buffer = await libro.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
