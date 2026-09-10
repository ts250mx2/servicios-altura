import ExcelJS, { type Worksheet } from "exceljs";
import { CONCEPTOS, type Concepto } from "@/lib/costeo/tipos";
import { columna } from "@/lib/importacion/excel/celdas";
import { FECHA, MONEDA, RELLENO_SUAVE, bytesDe, nuevoLibro } from "./excel-base";

/**
 * Datos planos para armar el Excel de costeo. Es independiente de la base para
 * que se pueda probar: se arma un libro y se vuelve a leer con el importador.
 */
export interface CosteoParaExcel {
  noCotizacion: number;
  folio: number | null;
  descripcion: string;
  usuario: string;
  planta: string;
  vendedor: string;
  fecha: string;
  dias: number;
  personal: number;
  precioVenta: number;
  isr: number;
  autoriza: string;
  porcentajes: { impuestosPct: number; administrativosPct: number; financiamientoPct: number; comisionPct: number };
  conceptosPlan: Record<Concepto, number>;
  conceptosReal: Record<Concepto, number>;
  nomina: { nombre: string; salarioDiario: number; imssDiario: number; desgasteDiario: number; bono: number; fechas: string[] }[];
  insumos: { descripcion: string; unidades: number; costoPlan: number; costoReal: number; comentario: string | null }[];
  gastos: { concepto: "GASOLINA" | "ADMINISTRATIVO" | "EPP" | "EQUIPO"; fecha: string | null; descripcion: string | null; cantidad: number }[];
  tarifasEpp: { montoHasta: number; costo: number }[];
  tarifasEquipo: { montoHasta: number; costo: number }[];
}

type Formula = { formula: string; result: number };
const f = (formula: string, result: number): Formula => ({ formula, result });

/** Etiquetas del resumen de conceptos, en el orden y con los textos de la plantilla. */
const ETIQUETAS_CONCEPTO: [Concepto, string][] = [
  ["NOMINA", "Nomina"], ["IMSS", "Imss"], ["BONOS", "Bonos"], ["GASOLINA", "Gasolina"],
  ["DESGASTE", "Desgaste de equipo"], ["ADMINISTRATIVO", "Administrativo"], ["INSUMOS", "Insumos"],
  ["EPP", "Epp"], ["EQUIPO", "Equipo"],
];

/**
 * El Excel de costeo "de siempre": las 12 hojas con la misma plantilla, para
 * que quien lo pida lo siga recibiendo igual y para que se pueda reimportar.
 */
export async function excelCosteo(d: CosteoParaExcel): Promise<Uint8Array> {
  const libro = nuevoLibro();
  const fechas = [...new Set(d.nomina.flatMap((n) => n.fechas))].sort();
  hojaGastos(libro, d);
  hojaMatriz(libro, "Nomina", d, fechas, "SALARIO \nDIARIO", (n) => n.salarioDiario, "NOMINA");
  hojaMatriz(libro, "Imss", d, fechas, "IMSS DIARIO", (n) => n.imssDiario, "IMSS");
  hojaDesgaste(libro, d, fechas);
  hojaBonos(libro, d);
  hojaInsumos(libro, d);
  hojaGasolina(libro, d);
  hojaGastoSimple(libro, "Administrativos", d, "ADMINISTRATIVO");
  hojaGastoSimple(libro, "Epp", d, "EPP");
  hojaGastoSimple(libro, "Compra de Equipo", d, "EQUIPO");
  hojaTablaMontos(libro, d);
  return bytesDe(libro);
}

// ── Gastos proyecto ─────────────────────────────────────────────────────────

function hojaGastos(libro: ExcelJS.Workbook, d: CosteoParaExcel): void {
  const h = libro.addWorksheet("Gastos proyecto");
  h.getColumn(1).width = 30; h.getColumn(2).width = 14; h.getColumn(3).width = 16; h.getColumn(4).width = 16;
  h.getColumn(5).width = 18; h.getColumn(6).width = 24; h.getColumn(7).width = 16;
  const p = d.porcentajes;
  const plan = d.conceptosPlan;
  const real = d.conceptosReal;
  const hayReal = CONCEPTOS.some((c) => real[c] > 0);
  const totalPlan = CONCEPTOS.filter((c) => c !== "INSUMOS").reduce((s, c) => s + plan[c], 0);
  const totalReal = hayReal ? CONCEPTOS.filter((c) => c !== "INSUMOS").reduce((s, c) => s + real[c], 0) : totalPlan;

  h.getCell("A1").value = `${d.noCotizacion} ${d.descripcion}`;
  h.mergeCells("A1:G1");
  h.getCell("A1").font = { bold: true };
  h.getCell("A3").value = "Usuario:"; h.getCell("B3").value = d.usuario;
  h.getCell("A4").value = "Planta:"; h.getCell("B4").value = d.planta;
  h.getCell("A5").value = "Proyecto:"; h.getCell("B5").value = f("A1", 0) as never; h.getCell("B5").value = { formula: "A1", result: `${d.noCotizacion} ${d.descripcion}` };
  h.getCell("F3").value = "Cotización:"; h.getCell("G3").value = d.noCotizacion;
  h.getCell("F4").value = "Hoja de levantamiento:"; h.getCell("G4").value = d.folio;
  h.getCell("F5").value = "Dias de trabajo:"; h.getCell("G5").value = d.dias;
  h.getCell("F6").value = "Personal:"; h.getCell("G6").value = d.personal;
  h.getCell("A7").value = "Vendedor:"; h.getCell("B7").value = d.vendedor;
  h.getCell("C7").value = "Fecha de emision:"; h.getCell("D7").value = new Date(`${d.fecha}T12:00:00`); h.getCell("D7").numFmt = FECHA;

  h.getCell("A9").value = "Gasto total plan"; h.getCell("F9").value = "Gasto total Real";
  [h.getCell("A9"), h.getCell("F9")].forEach((c) => { c.font = { bold: true }; c.fill = RELLENO_SUAVE; });

  const cadena = (col: "C" | "G", total: number, ref: string) => {
    const imp = total * (p.impuestosPct / 100);
    const sub1 = total + imp;
    const adm = sub1 * (p.administrativosPct / 100);
    const sub2 = sub1 + adm;
    const sub3 = sub2 + plan.INSUMOS;
    const fin = sub3 * (p.financiamientoPct / 100);
    const gasto = sub3 + fin;
    const bruta = d.precioVenta - gasto;
    const com = bruta * (p.comisionPct / 100);
    const filas: [number, Formula | number][] = [
      [10, col === "C" ? d.precioVenta : f("C10", d.precioVenta)],
      [11, d.isr],
      [12, f(ref, total)],
      [13, f(`${col}12*${p.impuestosPct / 100}`, imp)],
      [14, f(`SUM(${col}12:${col}13)`, sub1)],
      [15, f(`${col}14*${p.administrativosPct / 100}`, adm)],
      [16, f(`SUM(${col}14:${col}15)`, sub2)],
      [17, f(col === "C" ? "Insumos!C1" : "Insumos!C2", plan.INSUMOS)],
      [18, f(`SUM(${col}16:${col}17)`, sub3)],
      [19, f(`${col}18*${p.financiamientoPct / 100}`, fin)],
      [20, f(`SUM(${col}18:${col}19)`, gasto)],
      [21, f(`${col}10-${col}20`, bruta)],
      [22, f(`${col}21*${p.comisionPct / 100}`, com)],
      [23, f(`${col}21-${col}22`, bruta - com)],
    ];
    for (const [fila, valor] of filas) {
      h.getCell(`${col}${fila}`).value = valor;
      h.getCell(`${col}${fila}`).numFmt = MONEDA;
    }
  };
  const etiquetas = [
    "Costo sin Iva", "ISR", "Gasto total planeado", `Impuestos ${p.impuestosPct}%`, "Total Plan",
    "Administrativos ( 5% - 10% - 15% )", "Total Plan", "Insumos 30%", "Total Plan", "Financiamiento",
    "Gasto plan Total", "Utilidad Real", "Comisión Vendedor", "Utilidad Real",
  ];
  etiquetas.forEach((texto, i) => {
    h.getCell(`A${10 + i}`).value = texto;
    h.getCell(`F${10 + i}`).value = texto.replace("Gasto total planeado", "Gasto total real").replace("Total Plan", "Total Real");
  });
  cadena("C", totalPlan, "C35");
  cadena("G", totalReal, "+D35");
  if (d.autoriza) h.getCell("E10").value = d.autoriza;

  h.getCell("A25").value = "Concepto"; h.getCell("C25").value = "Gasto plan"; h.getCell("D25").value = "Gasto real";
  h.getCell("E25").value = "Diferencia"; h.getCell("F25").value = "Comentarios";
  ["A25", "C25", "D25", "E25", "F25"].forEach((c) => { h.getCell(c).font = { bold: true }; h.getCell(c).fill = RELLENO_SUAVE; });
  const refPlan: Record<Concepto, string> = {
    NOMINA: "Nomina!C1", IMSS: "Imss!C1", BONOS: "Bonos!C1", GASOLINA: "Gasolina!C1",
    DESGASTE: "'Desgaste de Equipo'!B1", ADMINISTRATIVO: "Administrativos!B1", INSUMOS: "",
    EPP: "Epp!B1", EQUIPO: "'Compra de Equipo'!B1",
  };
  ETIQUETAS_CONCEPTO.forEach(([concepto, texto], i) => {
    const fila = 26 + i;
    h.getCell(`A${fila}`).value = texto;
    if (concepto === "INSUMOS") return; // en la plantilla el renglón de insumos va vacío: se suma aparte
    h.getCell(`C${fila}`).value = f(refPlan[concepto], plan[concepto]);
    h.getCell(`D${fila}`).value = f(refPlan[concepto].replace("C1", "C2").replace("B1", "B2"), hayReal ? real[concepto] : plan[concepto]);
    h.getCell(`E${fila}`).value = f(`D${fila}-C${fila}`, hayReal ? real[concepto] - plan[concepto] : 0);
    ["C", "D", "E"].forEach((c) => { h.getCell(`${c}${fila}`).numFmt = MONEDA; });
  });
  h.getCell("A35").value = "Total";
  h.getCell("C35").value = f("SUM(C26:C34)", totalPlan);
  h.getCell("D35").value = f("SUM(D26:D34)", totalReal);
  ["C35", "D35"].forEach((c) => { h.getCell(c).numFmt = MONEDA; h.getCell(c).font = { bold: true }; });
}

// ── Matrices persona × día ──────────────────────────────────────────────────

function presupuestoYReal(h: Worksheet, colValor: "B" | "C", plan: number, formulaReal: string, real: number): void {
  h.getCell("A1").value = "PRESUPUESTO"; h.getCell(`${colValor}1`).value = plan; h.getCell(`${colValor}1`).numFmt = MONEDA;
  h.getCell("A2").value = "GASTO REAL"; h.getCell(`${colValor}2`).value = f(formulaReal, real); h.getCell(`${colValor}2`).numFmt = MONEDA;
  h.getCell("A3").value = "DIFERENCIA (+/-)"; h.getCell(`${colValor}3`).value = f(`${colValor}1-${colValor}2`, plan - real); h.getCell(`${colValor}3`).numFmt = MONEDA;
}

/** Nomina e Imss: ITEM · TRABAJADOR · SALARIO SEMANAL · tarifa diaria · un día por columna desde E. */
function hojaMatriz(
  libro: ExcelJS.Workbook, nombre: string, d: CosteoParaExcel, fechas: string[],
  etiquetaTarifa: string, tarifaDe: (n: CosteoParaExcel["nomina"][number]) => number, concepto: Concepto,
): void {
  const h = libro.addWorksheet(nombre);
  h.getColumn(2).width = 22;
  const colInicio = columna("E");
  const colTotal = columna("AJ");
  const filaEnc = 5;
  h.getCell(filaEnc, 1).value = "ITEM"; h.getCell(filaEnc, 2).value = "TRABAJADOR";
  h.getCell(filaEnc, 3).value = "SALARIO SEMANAL"; h.getCell(filaEnc, 4).value = etiquetaTarifa;
  fechas.forEach((fecha, i) => {
    const celda = h.getCell(filaEnc, colInicio + i);
    celda.value = new Date(`${fecha}T12:00:00`);
    celda.numFmt = FECHA;
  });
  let total = 0;
  d.nomina.forEach((n, i) => {
    const fila = filaEnc + 1 + i;
    const tarifa = tarifaDe(n);
    h.getCell(fila, 1).value = i + 1;
    h.getCell(fila, 2).value = n.nombre;
    h.getCell(fila, 3).value = tarifa * 7;
    h.getCell(fila, 4).value = tarifa;
    let suma = 0;
    for (const fecha of n.fechas) {
      const col = colInicio + fechas.indexOf(fecha);
      if (tarifa > 0) { h.getCell(fila, col).value = tarifa; suma += tarifa; }
    }
    h.getCell(fila, colTotal).value = f(`SUM(${letra(colInicio)}${fila}:${letra(colTotal - 1)}${fila})`, suma);
    total += suma;
  });
  const filaTotal = filaEnc + 1 + d.nomina.length;
  h.getCell(filaTotal, colTotal).value = f(`SUM(${letra(colTotal)}${filaEnc + 1}:${letra(colTotal)}${filaTotal - 1})`, total);
  presupuestoYReal(h, "C", d.conceptosPlan[concepto], `${letra(colTotal)}${filaTotal}`, total);
}

/** Desgaste de Equipo: TRABAJADOR en A, COSTO DIA en B, días desde C. */
function hojaDesgaste(libro: ExcelJS.Workbook, d: CosteoParaExcel, fechas: string[]): void {
  const h = libro.addWorksheet("Desgaste de Equipo");
  h.getColumn(1).width = 22;
  const colInicio = columna("C");
  const colTotal = columna("AH");
  const filaEnc = 7;
  h.getCell(filaEnc, 1).value = "TRABAJADOR"; h.getCell(filaEnc, 2).value = "COSTO DIA";
  fechas.forEach((fecha, i) => {
    const celda = h.getCell(filaEnc, colInicio + i);
    celda.value = new Date(`${fecha}T12:00:00`);
    celda.numFmt = FECHA;
  });
  let total = 0;
  d.nomina.forEach((n, i) => {
    const fila = filaEnc + 1 + i;
    h.getCell(fila, 1).value = n.nombre;
    h.getCell(fila, 2).value = n.desgasteDiario;
    let suma = 0;
    for (const fecha of n.fechas) {
      if (n.desgasteDiario > 0) { h.getCell(fila, colInicio + fechas.indexOf(fecha)).value = n.desgasteDiario; suma += n.desgasteDiario; }
    }
    h.getCell(fila, colTotal).value = f(`SUM(${letra(colInicio)}${fila}:${letra(colTotal - 1)}${fila})`, suma);
    total += suma;
  });
  const filaTotal = filaEnc + 1 + d.nomina.length;
  h.getCell(filaTotal, colTotal).value = f(`SUM(${letra(colTotal)}${filaEnc + 1}:${letra(colTotal)}${filaTotal - 1})`, total);
  presupuestoYReal(h, "B", d.conceptosPlan.DESGASTE, `${letra(colTotal)}${filaTotal}`, total);
}

// ── Listas ──────────────────────────────────────────────────────────────────

function hojaBonos(libro: ExcelJS.Workbook, d: CosteoParaExcel): void {
  const h = libro.addWorksheet("Bonos");
  h.getColumn(2).width = 26;
  h.getCell("A5").value = "BONOS";
  ["NO", "CONCEPTO", "UNIDADES", "COSTO", "FECHA", "COMENTARIOS"].forEach((t, i) => { h.getCell(6, i + 1).value = t; });
  const conBono = d.nomina.filter((n) => n.bono > 0);
  let total = 0;
  conBono.forEach((n, i) => {
    h.getCell(7 + i, 1).value = i + 1; h.getCell(7 + i, 2).value = n.nombre; h.getCell(7 + i, 3).value = 1;
    h.getCell(7 + i, 4).value = n.bono; h.getCell(7 + i, 4).numFmt = MONEDA; total += n.bono;
  });
  const filaTotal = 7 + Math.max(conBono.length, 1);
  h.getCell(filaTotal, 4).value = f(`SUM(D7:D${filaTotal - 1})`, total);
  presupuestoYReal(h, "C", d.conceptosPlan.BONOS, `D${filaTotal}`, total);
}

function hojaInsumos(libro: ExcelJS.Workbook, d: CosteoParaExcel): void {
  const h = libro.addWorksheet("Insumos");
  h.getColumn(2).width = 60;
  h.getCell("A5").value = "INSUMOS";
  ["NO", "CONCEPTO", "UNIDADES", "COSTO PLAN", "COSTO REAL", "FECHA", "COMENTARIOS"].forEach((t, i) => { h.getCell(6, i + 1).value = t; });
  let plan = 0;
  let real = 0;
  d.insumos.forEach((ins, i) => {
    const fila = 7 + i;
    h.getCell(fila, 1).value = i + 1; h.getCell(fila, 2).value = ins.descripcion; h.getCell(fila, 3).value = ins.unidades;
    if (ins.comentario !== "NO APLICAR") {
      h.getCell(fila, 4).value = ins.costoPlan; h.getCell(fila, 5).value = ins.costoReal;
      h.getCell(fila, 4).numFmt = MONEDA; h.getCell(fila, 5).numFmt = MONEDA;
      plan += ins.costoPlan; real += ins.costoReal;
    }
    if (ins.comentario) h.getCell(fila, 7).value = ins.comentario;
  });
  const filaTotal = 7 + Math.max(d.insumos.length, 1);
  h.getCell(filaTotal, 4).value = f(`SUM(D7:D${filaTotal - 1})`, plan);
  h.getCell(filaTotal, 5).value = f(`SUM(E7:E${filaTotal - 1})`, real);
  h.getCell("A1").value = "PRESUPUESTO"; h.getCell("C1").value = f(`D${filaTotal}`, plan); h.getCell("C1").numFmt = MONEDA;
  h.getCell("A2").value = "GASTO REAL"; h.getCell("C2").value = f(`E${filaTotal}`, real); h.getCell("C2").numFmt = MONEDA;
  h.getCell("A3").value = "DIFERENCIA (+/-)";
}

function hojaGasolina(libro: ExcelJS.Workbook, d: CosteoParaExcel): void {
  const h = libro.addWorksheet("Gasolina");
  h.getColumn(4).width = 40;
  h.getCell("A5").value = "GASOLINA";
  ["NO", "FECHA", "CANTIDAD", "RUTAS"].forEach((t, i) => { h.getCell(6, i + 1).value = t; });
  const lista = d.gastos.filter((g) => g.concepto === "GASOLINA");
  let total = 0;
  lista.forEach((g, i) => {
    const fila = 7 + i;
    h.getCell(fila, 1).value = i + 1;
    if (g.fecha) { h.getCell(fila, 2).value = new Date(`${g.fecha}T12:00:00`); h.getCell(fila, 2).numFmt = FECHA; }
    h.getCell(fila, 3).value = g.cantidad; h.getCell(fila, 3).numFmt = MONEDA;
    h.getCell(fila, 4).value = g.descripcion ?? "";
    total += g.cantidad;
  });
  const filaTotal = 7 + Math.max(lista.length, 1);
  h.getCell(filaTotal, 3).value = f(`SUM(C7:C${filaTotal - 1})`, total);
  presupuestoYReal(h, "C", d.conceptosPlan.GASOLINA, `C${filaTotal}`, total);
}

function hojaGastoSimple(libro: ExcelJS.Workbook, nombre: string, d: CosteoParaExcel, concepto: "ADMINISTRATIVO" | "EPP" | "EQUIPO"): void {
  const h = libro.addWorksheet(nombre);
  h.getColumn(1).width = 16; h.getColumn(2).width = 16;
  h.getCell("A5").value = "GASTOS ADMINISTRATIVOS";
  h.getCell("A6").value = "FECHA"; h.getCell("B6").value = "CANTIDAD";
  const lista = d.gastos.filter((g) => g.concepto === concepto);
  let total = 0;
  lista.forEach((g, i) => {
    const fila = 7 + i;
    if (g.fecha) { h.getCell(fila, 1).value = new Date(`${g.fecha}T12:00:00`); h.getCell(fila, 1).numFmt = FECHA; }
    h.getCell(fila, 2).value = g.cantidad; h.getCell(fila, 2).numFmt = MONEDA;
    total += g.cantidad;
  });
  const filaTotal = Math.max(14, 7 + lista.length);
  h.getCell(filaTotal, 1).value = "TOTAL";
  h.getCell(filaTotal, 2).value = f(`SUM(B7:B${filaTotal - 1})`, total);
  const clave: Concepto = concepto === "ADMINISTRATIVO" ? "ADMINISTRATIVO" : concepto;
  presupuestoYReal(h, "B", d.conceptosPlan[clave], `B${filaTotal}`, total);
}

function hojaTablaMontos(libro: ExcelJS.Workbook, d: CosteoParaExcel): void {
  const h = libro.addWorksheet("Tabla de montos");
  const escribir = (fila: number, titulo: string, tabla: { montoHasta: number; costo: number }[]) => {
    h.getCell(fila, 1).value = titulo;
    h.getCell(fila + 1, 1).value = "MONTOS"; h.getCell(fila + 2, 1).value = "COSTO";
    tabla.forEach((t, i) => {
      h.getCell(fila + 1, 2 + i).value = t.montoHasta;
      h.getCell(fila + 2, 2 + i).value = t.costo;
    });
  };
  escribir(1, "EPP", d.tarifasEpp);
  escribir(5, "COMPRA DE EQUIPOS", d.tarifasEquipo);
}

function letra(col: number): string {
  let s = "";
  let n = col;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
