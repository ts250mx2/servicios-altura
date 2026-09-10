import ExcelJS, { type Worksheet } from "exceljs";

export const RELLENO_NAVY: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF051622" } };
export const RELLENO_AMARILLO: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5C400" } };
export const RELLENO_SUAVE: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F6F8" } };
export const FUENTE_BLANCA: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };
export const MONEDA = '"$"#,##0.00';
export const FECHA = "dd/mm/yyyy";

export function nuevoLibro(): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Servicios de Altura";
  libro.created = new Date();
  return libro;
}

/** Título de sección: una fila navy con texto blanco. */
export function titulo(hoja: Worksheet, fila: number, texto: string, columnas = 6): number {
  hoja.mergeCells(fila, 1, fila, columnas);
  const celda = hoja.getCell(fila, 1);
  celda.value = texto;
  celda.fill = RELLENO_NAVY;
  celda.font = { ...FUENTE_BLANCA, size: 12 };
  celda.alignment = { vertical: "middle" };
  hoja.getRow(fila).height = 22;
  return fila + 1;
}

/** Encabezado de tabla: relleno suave y negritas. */
export function encabezados(hoja: Worksheet, fila: number, textos: string[]): number {
  textos.forEach((t, i) => {
    const celda = hoja.getCell(fila, i + 1);
    celda.value = t;
    celda.font = { bold: true };
    celda.fill = RELLENO_SUAVE;
    celda.border = { bottom: { style: "thin", color: { argb: "FF26536F" } } };
  });
  return fila + 1;
}

/** Pares etiqueta/valor en dos columnas. */
export function pares(hoja: Worksheet, fila: number, lista: [string, ExcelJS.CellValue][]): number {
  for (const [etiqueta, valor] of lista) {
    hoja.getCell(fila, 1).value = etiqueta;
    hoja.getCell(fila, 1).font = { bold: true, color: { argb: "FF63808F" } };
    hoja.getCell(fila, 2).value = valor;
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

export async function bytesDe(libro: ExcelJS.Workbook): Promise<Uint8Array> {
  const buffer = await libro.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
