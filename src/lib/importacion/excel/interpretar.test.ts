import { readdirSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { calcularCosteo } from "@/lib/costeo/motor";
import { interpretarCosteo } from "./interpretar";
import type { CosteoExtraido } from "./tipos";

/** Los Excel reales viven en la raíz del proyecto con nombres largos y acentos. */
function rutaExcel(noCotizacion: number): string | null {
  const archivo = readdirSync(process.cwd()).find(
    (f) => f.startsWith(`NoC. ${noCotizacion}`) && f.endsWith(".xlsx"),
  );
  return archivo ? path.resolve(process.cwd(), archivo) : null;
}

const RUTA_6744 = rutaExcel(6744);
const RUTA_6745 = rutaExcel(6745);
const hayExcels = RUTA_6744 !== null && RUTA_6745 !== null;

async function leer(ruta: string): Promise<CosteoExtraido> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  return interpretarCosteo(libro);
}

/** Lo que el motor calcula con lo extraído; debe cuadrar con lo que el Excel dice. */
function recalcular(d: CosteoExtraido) {
  return calcularCosteo({
    nomina: d.nomina.map((p) => ({
      nombre: p.nombre, idPuesto: 1, salarioDiario: p.salarioDiario, imssDiario: p.imssDiario,
      desgasteDiario: p.desgasteDiario, bono: p.bono, diasLaborados: p.dias,
    })),
    insumos: d.insumos.map((i) => ({ descripcion: i.descripcion, unidades: i.unidades, costo: i.costoPlan, aplica: i.aplica })),
    gastos: {
      gasolina: suma(d, "GASOLINA"), administrativo: suma(d, "ADMINISTRATIVO"),
      epp: suma(d, "EPP"), equipo: suma(d, "EQUIPO"),
    },
    porcentajes: d.porcentajes,
    precioVenta: d.precioVenta,
  });
}

function suma(d: CosteoExtraido, concepto: string): number {
  return d.gastos.filter((g) => g.concepto === concepto).reduce((s, g) => s + g.cantidad, 0);
}

describe.skipIf(!hayExcels)("Excel 6744 — silicón Duretán, archivo real", () => {
  let d: CosteoExtraido;
  beforeAll(async () => {
    d = await leer(RUTA_6744!);
  });

  it("lee el encabezado de «Gastos proyecto»", () => {
    expect(d.noCotizacion).toBe(6744);
    expect(d.folio).toBe(3434);
    expect(d.descripcion).toMatch(/^SERVICIO POR LIMPIEZA Y APLICACIÓN DE SILICÓN DURETAN/);
    expect(d.descripcion).not.toMatch(/^6744/);
    expect(d.usuario).toBe("JAVIER LOZANO");
    expect(d.planta).toBe("IGLESIA SAN JUAN DE LOS LAGOS");
    expect(d.vendedor).toBe("JUAN GAYTAN");
    expect(d.fecha).toBe("2026-08-26");
    expect(d.dias).toBe(5);
    expect(d.personal).toBe(6);
  });

  it("lee precio, ISR, autorización y deriva los porcentajes de las fórmulas", () => {
    expect(d.precioVenta).toBe(130800);
    expect(d.isr).toBe(1000);
    expect(d.autoriza).toBe("AUTORIZA RODOLFO");
    expect(d.porcentajes).toEqual({ impuestosPct: 10, administrativosPct: 5, financiamientoPct: 5, comisionPct: 4 });
    expect(d.gastoTotalExcel).toBeCloseTo(54423.12, 2);
    expect(d.utilidadNetaExcel).toBeCloseTo(73321.8, 1);
  });

  it("lee los nueve conceptos plan y real", () => {
    expect(d.conceptosPlan).toEqual({
      NOMINA: 21000, IMSS: 1539, BONOS: 4800, GASOLINA: 1500, DESGASTE: 2000,
      ADMINISTRATIVO: 400, INSUMOS: 0, EPP: 350, EQUIPO: 350,
    });
    expect(d.conceptosReal).toEqual(d.conceptosPlan);
  });

  it("funde Nomina, Imss, Desgaste y Bonos en una sola matriz de 6 personas", () => {
    expect(d.nomina).toHaveLength(6);
    expect(d.nomina[0]).toEqual({ nombre: "TECNICO 1", dias: 5, salarioDiario: 700, imssDiario: 51.3, desgasteDiario: 100, bono: 800 });
    // El Excel sólo cargó desgaste a los técnicos 1-4.
    expect(d.nomina[4]).toEqual({ nombre: "TECNICO 5", dias: 5, salarioDiario: 700, imssDiario: 51.3, desgasteDiario: 0, bono: 800 });
    expect(d.nomina.map((p) => p.nombre)).not.toContain("TECNICO 7");
  });

  it("lee 11 insumos y los gastos sueltos con su hoja de origen", () => {
    expect(d.insumos).toHaveLength(11);
    expect(d.insumos[0]).toMatchObject({ descripcion: "CARTUCHOS DE SILICON DURETAN BASE DE POLIURETANO NEGRO", unidades: 70, costoPlan: 10150, costoReal: 10150, aplica: true });
    expect(d.insumos[10]).toMatchObject({ descripcion: "JABON LIQUIDO", unidades: 1, costoPlan: 100 });
    expect(d.gastos).toEqual([
      { concepto: "GASOLINA", fecha: null, descripcion: "", cantidad: 1500 },
      { concepto: "ADMINISTRATIVO", fecha: null, descripcion: "", cantidad: 400 },
      { concepto: "EPP", fecha: null, descripcion: "", cantidad: 350 },
      { concepto: "EQUIPO", fecha: null, descripcion: "", cantidad: 350 },
    ]);
  });

  it("el motor reproduce al centavo lo que dice el Excel", () => {
    const r = recalcular(d);
    expect(r.gastoDirecto).toBe(31939);
    expect(r.insumos).toBe(14942);
    expect(r.gastoTotal).toBeCloseTo(d.gastoTotalExcel, 2);
    expect(r.utilidadNeta).toBeCloseTo(d.utilidadNetaExcel, 2);
    expect(r.margenPct).toBeCloseTo(56.06, 1);
  });

  it("no deja avisos", () => {
    expect(d.avisos).toEqual([]);
  });
});

describe.skipIf(!hayExcels)("Excel 6745 — impermeabilizante, archivo real", () => {
  let d: CosteoExtraido;
  beforeAll(async () => {
    d = await leer(RUTA_6745!);
  });

  it("lee el encabezado y un precio que en el Excel es fórmula", () => {
    expect(d.noCotizacion).toBe(6745);
    expect(d.folio).toBe(3435);
    expect(d.fecha).toBe("2026-08-27");
    expect(d.dias).toBe(4);
    expect(d.personal).toBe(5);
    expect(d.precioVenta).toBeCloseTo(55440.99, 2);
    expect(d.autoriza).toBe("");
  });

  it("funde 5 personas con desgaste sólo en 3 y bono de 600", () => {
    expect(d.nomina).toHaveLength(5);
    expect(d.nomina[0]).toEqual({ nombre: "TECNICO 1", dias: 4, salarioDiario: 700, imssDiario: 51.3, desgasteDiario: 100, bono: 600 });
    expect(d.nomina[3]).toEqual({ nombre: "TECNICO 4", dias: 4, salarioDiario: 700, imssDiario: 51.3, desgasteDiario: 0, bono: 600 });
  });

  it("respeta las partidas NO APLICAR", () => {
    expect(d.insumos).toHaveLength(5);
    expect(d.insumos[0]).toMatchObject({ descripcion: "CUBETAS DE 19 LITROS DE SELLADOR PRIMARIO TAPAPORO", unidades: 3, costoPlan: 0, comentario: "NO APLICAR", aplica: false });
    expect(d.insumos[2]).toMatchObject({ unidades: 30, aplica: false });
    expect(d.insumos[1]).toMatchObject({ descripcion: "BROCHAS DE 4 PULGADAS", costoPlan: 375, aplica: true });
  });

  it("el motor reproduce al centavo lo que dice el Excel", () => {
    const r = recalcular(d);
    expect(r.gastoDirecto).toBe(21376);
    expect(r.insumos).toBe(1235);
    expect(r.gastoTotal).toBeCloseTo(27220.49, 2);
    expect(r.utilidadNeta).toBeCloseTo(27091.67, 2);
    expect(d.avisos).toEqual([]);
  });
});

describe("interpretarCosteo — nómina con hojas desparejas", () => {
  function matriz(libro: ExcelJS.Workbook, nombre: string, colNombre: string, colTarifa: string, primeraCol: string, filas: [string, number, number][]) {
    const hoja = libro.addWorksheet(nombre);
    hoja.getCell(`${colNombre}5`).value = "TRABAJADOR";
    filas.forEach(([persona, tarifa, dias], i) => {
      const fila = 6 + i;
      hoja.getCell(`${colNombre}${fila}`).value = persona;
      hoja.getCell(`${colTarifa}${fila}`).value = tarifa;
      for (let d = 0; d < dias; d++) hoja.getRow(fila).getCell(hoja.getColumn(primeraCol).number + d).value = tarifa;
    });
  }

  it("conserva como renglón aparte a quien tiene IMSS o desgaste pero no nómina", () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet("Gastos proyecto").getCell("A1").value = "7002 PRUEBA";
    matriz(libro, "Nomina", "B", "D", "E", [["TECNICO 1", 700, 3]]);
    matriz(libro, "Imss", "B", "D", "E", [["TECNICO 1", 51.3, 3], ["VIGIA", 51.3, 3]]);
    matriz(libro, "Desgaste de Equipo", "A", "B", "C", [["VIGIA", 100, 3]]);
    const d = interpretarCosteo(libro);
    expect(d.nomina).toEqual([
      { nombre: "TECNICO 1", dias: 3, salarioDiario: 700, imssDiario: expect.closeTo(51.3, 6), desgasteDiario: 0, bono: 0 },
      { nombre: "VIGIA", dias: 3, salarioDiario: 0, imssDiario: expect.closeTo(51.3, 6), desgasteDiario: 100, bono: 0 },
    ]);
    expect(d.avisos).toContain("VIGIA tiene 3 días de IMSS pero no de nómina; quedó como renglón aparte sin salario.");
    expect(d.avisos).toContain("VIGIA tiene 3 días de desgaste pero no de nómina; quedó como renglón aparte sin salario.");
  });

  it("no redondea la tarifa cuando el total no divide exacto entre los días", () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet("Gastos proyecto").getCell("A1").value = "7003 PRUEBA";
    const hoja = libro.addWorksheet("Nomina");
    hoja.getCell("B5").value = "TRABAJADOR";
    hoja.getCell("B6").value = "TECNICO 1";
    hoja.getCell("E6").value = 33.34; hoja.getCell("F6").value = 33.33; hoja.getCell("G6").value = 33.33;
    const d = interpretarCosteo(libro);
    expect(d.nomina[0].salarioDiario * d.nomina[0].dias).toBeCloseTo(100, 10);
  });
});

describe("interpretarCosteo — libro que no es de costeo", () => {
  it("avisa cuando falta la hoja principal", () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet("Hoja1").getCell("A1").value = "cualquier cosa";
    const d = interpretarCosteo(libro);
    expect(d.noCotizacion).toBeNull();
    expect(d.avisos).toEqual(["El libro no tiene la hoja «Gastos proyecto»; no es un Excel de costeo."]);
  });

  it("lee un libro mínimo armado a mano y avisa de lo que falta", () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Gastos proyecto");
    hoja.getCell("A1").value = "7001 LIMPIEZA DE CRISTALES";
    hoja.getCell("A3").value = "Usuario:"; hoja.getCell("B3").value = "PEDRO";
    hoja.getCell("A4").value = "Planta:"; hoja.getCell("B4").value = "TORRE NORTE";
    hoja.getCell("F3").value = "Cotización:"; hoja.getCell("G3").value = 7001;
    hoja.getCell("C7").value = "Fecha de emision:"; hoja.getCell("D7").value = "15/03/2026";
    hoja.getCell("A10").value = "Costo sin Iva"; hoja.getCell("C10").value = 50000;
    hoja.getCell("A12").value = "Gasto total planeado"; hoja.getCell("C12").value = 20000;
    hoja.getCell("A13").value = "Impuestos 10%"; hoja.getCell("C13").value = 2000;
    hoja.getCell("A15").value = "Administrativos"; hoja.getCell("C15").value = 2200; // 10 %
    hoja.getCell("A17").value = "Insumos"; hoja.getCell("C17").value = 0;
    hoja.getCell("A19").value = "Financiamiento"; hoja.getCell("C19").value = 1210;
    hoja.getCell("A20").value = "Gasto plan Total"; hoja.getCell("C20").value = 25410;
    hoja.getCell("A21").value = "Utilidad Real"; hoja.getCell("C21").value = 24590;
    hoja.getCell("A22").value = "Comisión Vendedor"; hoja.getCell("C22").value = 983.6;
    hoja.getCell("A23").value = "Utilidad Real"; hoja.getCell("C23").value = 23606.4;
    const d = interpretarCosteo(libro);
    expect(d.noCotizacion).toBe(7001);
    expect(d.descripcion).toBe("LIMPIEZA DE CRISTALES");
    expect(d.planta).toBe("TORRE NORTE");
    expect(d.fecha).toBe("2026-03-15");
    expect(d.porcentajes).toEqual({ impuestosPct: 10, administrativosPct: 10, financiamientoPct: 5, comisionPct: 4 });
    expect(d.utilidadNetaExcel).toBe(23606.4);
    expect(d.avisos).toEqual(expect.arrayContaining([
      "No se encontró la hoja «Nomina».",
      "No se encontró el folio de la hoja de levantamiento.",
      "No hay nadie en la nómina del proyecto.",
    ]));
  });
});
