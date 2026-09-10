import { readFile } from "node:fs/promises";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTable, { type CellInput, type RowInput, type UserOptions } from "jspdf-autotable";
import sharp from "sharp";
import { formatoFechaHora } from "@/lib/formato";

/** Identidad: navy y amarillo de la marca, tal como en la pantalla. */
export const NAVY: [number, number, number] = [5, 22, 34];
export const AMARILLO: [number, number, number] = [245, 196, 0];
export const GRIS: [number, number, number] = [110, 120, 128];
export const GRIS_CLARO: [number, number, number] = [236, 240, 243];

export const PAGINA = { ancho: 612, alto: 792, margen: 40 } as const;
export const ANCHO_UTIL = PAGINA.ancho - PAGINA.margen * 2;

type Doc = jsPDF & { lastAutoTable?: { finalY: number } };

/**
 * Las fuentes base de PDF sólo saben Latin-1: los acentos van bien, pero
 * guiones largos, «≥» o «×» se romperían. Se cambian por su equivalente simple.
 */
export function limpiar(texto: string | number | null | undefined): string {
  return String(texto ?? "")
    .replace(/[—–]/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/×/g, "x")
    .replace(/…/g, "...")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/→/g, ">")
    .replace(/ /g, " ");
}

let logoJpeg: Promise<string> | null = null;

/** El sello oficial (public/logo.png) aplanado sobre blanco y como JPEG, que es lo que jsPDF pinta más ligero. */
export function logo(): Promise<string> {
  if (!logoJpeg) {
    logoJpeg = readFile(path.join(process.cwd(), "public", "logo.png"))
      .then((png) => sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer())
      .then((jpeg) => jpeg.toString("base64"));
  }
  return logoJpeg;
}

export interface Encabezado {
  titulo: string;
  subtitulo: string;
  /** Texto chico a la derecha (folio, número, fecha). */
  referencia: string[];
}

/** Documento carta con encabezado de marca; devuelve el doc y la `y` donde empieza el cuerpo. */
export async function crearDocumento(enc: Encabezado): Promise<{ doc: Doc; y: number }> {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true }) as Doc;
  doc.setProperties({ title: `${enc.titulo} ${enc.referencia[0] ?? ""}`.trim(), creator: "Servicios de Altura" });
  const y = await pintarEncabezado(doc, enc);
  return { doc, y };
}

export async function pintarEncabezado(doc: Doc, enc: Encabezado): Promise<number> {
  const m = PAGINA.margen;
  doc.addImage(await logo(), "JPEG", m, 28, 78, 52);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(limpiar(enc.titulo), m + 92, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text(limpiar(enc.subtitulo), m + 92, 62, { maxWidth: 300 });
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  enc.referencia.forEach((linea, i) => {
    doc.text(limpiar(linea), PAGINA.ancho - m, 40 + i * 13, { align: "right" });
  });
  doc.setDrawColor(...AMARILLO);
  doc.setLineWidth(2.5);
  doc.line(m, 90, PAGINA.ancho - m, 90);
  return 106;
}

/** Título de sección en versalitas navy con filete fino. */
export function seccion(doc: Doc, y: number, texto: string): number {
  if (y > PAGINA.alto - 90) {
    doc.addPage();
    y = PAGINA.margen;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(limpiar(texto).toUpperCase(), PAGINA.margen, y);
  doc.setDrawColor(...GRIS_CLARO);
  doc.setLineWidth(0.8);
  doc.line(PAGINA.margen, y + 4, PAGINA.ancho - PAGINA.margen, y + 4);
  return y + 14;
}

/** Párrafo normal; devuelve la y siguiente. */
export function parrafo(doc: Doc, y: number, texto: string, opciones: { tamano?: number; color?: [number, number, number] } = {}): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(opciones.tamano ?? 9);
  doc.setTextColor(...(opciones.color ?? NAVY));
  const lineas = doc.splitTextToSize(limpiar(texto), ANCHO_UTIL) as string[];
  const alto = lineas.length * (opciones.tamano ?? 9) * 1.35;
  if (y + alto > PAGINA.alto - 60) {
    doc.addPage();
    y = PAGINA.margen;
  }
  doc.text(lineas, PAGINA.margen, y);
  return y + alto + 4;
}

/** Tabla con el estilo de la casa: encabezado navy, cebra suave, cifras a la derecha donde se indique. */
export function tabla(
  doc: Doc,
  y: number,
  opciones: {
    encabezados?: CellInput[];
    filas: RowInput[];
    anchos?: Record<number, number>;
    derecha?: number[];
    tamano?: number;
    sinEncabezado?: boolean;
  } & Pick<UserOptions, "columnStyles" | "theme" | "didParseCell">,
): number {
  const columnStyles: UserOptions["columnStyles"] = { ...(opciones.columnStyles ?? {}) };
  for (const [col, ancho] of Object.entries(opciones.anchos ?? {})) {
    columnStyles[col] = { ...(columnStyles[col] ?? {}), cellWidth: ancho };
  }
  for (const col of opciones.derecha ?? []) {
    columnStyles[col] = { ...(columnStyles[col] ?? {}), halign: "right", font: "courier" };
  }
  autoTable(doc, {
    startY: y,
    margin: { left: PAGINA.margen, right: PAGINA.margen },
    head: opciones.sinEncabezado || !opciones.encabezados ? undefined : [opciones.encabezados.map((c) => limpiarCelda(c))],
    body: opciones.filas.map((fila) => (Array.isArray(fila) ? fila.map((c) => limpiarCelda(c)) : fila)),
    theme: opciones.theme ?? "grid",
    styles: { font: "helvetica", fontSize: opciones.tamano ?? 8.5, cellPadding: 3.5, textColor: NAVY, lineColor: GRIS_CLARO, lineWidth: 0.5, overflow: "linebreak" },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: [248, 250, 251] },
    columnStyles,
    didParseCell: opciones.didParseCell,
  });
  return (doc.lastAutoTable?.finalY ?? y) + 12;
}

function limpiarCelda(celda: CellInput): CellInput {
  if (typeof celda === "string" || typeof celda === "number") return limpiar(celda);
  if (celda && typeof celda === "object" && "content" in celda) {
    return { ...celda, content: limpiar(String(celda.content ?? "")) };
  }
  return celda;
}

/** Pie de página en todas las hojas y salida como bytes. */
export function terminar(doc: Doc, notaPie: string): Uint8Array {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(limpiar(notaPie), PAGINA.margen, PAGINA.alto - 24);
    doc.text(`Página ${p} de ${total} · generado el ${formatoFechaHora(new Date())}`, PAGINA.ancho - PAGINA.margen, PAGINA.alto - 24, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

/** Pares etiqueta/valor a dos columnas, para encabezados de documento. */
export function cuadricula(doc: Doc, y: number, pares: [string, string | number | null | undefined][]): number {
  const filas: RowInput[] = [];
  for (let i = 0; i < pares.length; i += 2) {
    const izq = pares[i];
    const der = pares[i + 1];
    filas.push([
      { content: izq[0].toUpperCase(), styles: { fontStyle: "bold", textColor: GRIS, fontSize: 7 } },
      String(izq[1] ?? "-"),
      { content: der ? der[0].toUpperCase() : "", styles: { fontStyle: "bold", textColor: GRIS, fontSize: 7 } },
      der ? String(der[1] ?? "-") : "",
    ]);
  }
  return tabla(doc, y, {
    filas, sinEncabezado: true, theme: "plain", tamano: 8.5,
    anchos: { 0: 90, 1: ANCHO_UTIL / 2 - 90, 2: 90, 3: ANCHO_UTIL / 2 - 90 },
  });
}

export function si(valor: number | boolean | null | undefined): string {
  return valor === 1 || valor === true ? "Sí" : "No";
}

export type { Doc };
