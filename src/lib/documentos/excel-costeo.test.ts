import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { calcularCosteo } from "@/lib/costeo/motor";
import { interpretarCosteo } from "@/lib/importacion/excel/interpretar";
import { excelCosteo, type CosteoParaExcel } from "./excel-costeo";

/** El 6744 tal como quedó guardado: 6 técnicos × 5 días, desgaste sólo en 4, bono 800. */
function datos6744(): CosteoParaExcel {
  const fechas = ["2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"];
  return {
    noCotizacion: 6744, folio: 3434,
    descripcion: "SERVICIO POR LIMPIEZA Y APLICACIÓN DE SILICÓN DURETAN",
    usuario: "JAVIER LOZANO", planta: "IGLESIA SAN JUAN DE LOS LAGOS", vendedor: "JUAN GAYTAN",
    fecha: "2026-08-26", dias: 5, personal: 6, precioVenta: 130800, isr: 1000, autoriza: "AUTORIZA RODOLFO",
    porcentajes: { impuestosPct: 10, administrativosPct: 5, financiamientoPct: 5, comisionPct: 4 },
    conceptosPlan: { NOMINA: 21000, IMSS: 1539, BONOS: 4800, GASOLINA: 1500, DESGASTE: 2000, ADMINISTRATIVO: 400, INSUMOS: 14942, EPP: 350, EQUIPO: 350 },
    conceptosReal: { NOMINA: 0, IMSS: 0, BONOS: 0, GASOLINA: 0, DESGASTE: 0, ADMINISTRATIVO: 0, INSUMOS: 0, EPP: 0, EQUIPO: 0 },
    nomina: Array.from({ length: 6 }, (_, i) => ({
      nombre: `TECNICO ${i + 1}`, salarioDiario: 700, imssDiario: 51.3, desgasteDiario: i < 4 ? 100 : 0, bono: 800, fechas,
    })),
    insumos: [
      { descripcion: "CARTUCHOS DE SILICON DURETAN", unidades: 70, costoPlan: 10150, costoReal: 10150, comentario: null },
      { descripcion: "ROLLOS DE MASKINGTAPE", unidades: 30, costoPlan: 2550, costoReal: 2550, comentario: null },
      { descripcion: "PACA DE TRAPO", unidades: 1, costoPlan: 800, costoReal: 800, comentario: null },
      { descripcion: "COSTALES", unidades: 8, costoPlan: 112, costoReal: 112, comentario: null },
      { descripcion: "THINNER", unidades: 2, costoPlan: 480, costoReal: 480, comentario: null },
      { descripcion: "NAVAJAS", unidades: 2, costoPlan: 150, costoReal: 150, comentario: null },
      { descripcion: "PISTOLAS", unidades: 4, costoPlan: 250, costoReal: 250, comentario: null },
      { descripcion: "CUBETAS", unidades: 5, costoPlan: 100, costoReal: 100, comentario: null },
      { descripcion: "EXACTOS", unidades: 5, costoPlan: 150, costoReal: 150, comentario: null },
      { descripcion: "ATOMIZADORES", unidades: 5, costoPlan: 100, costoReal: 100, comentario: null },
      { descripcion: "JABON", unidades: 1, costoPlan: 100, costoReal: 100, comentario: null },
      { descripcion: "SELLADOR", unidades: 3, costoPlan: 0, costoReal: 0, comentario: "NO APLICAR" },
    ],
    gastos: [
      { concepto: "GASOLINA", fecha: "2026-08-26", descripcion: "Monterrey - San Juan", cantidad: 1500 },
      { concepto: "ADMINISTRATIVO", fecha: null, descripcion: null, cantidad: 400 },
      { concepto: "EPP", fecha: null, descripcion: null, cantidad: 350 },
      { concepto: "EQUIPO", fecha: null, descripcion: null, cantidad: 350 },
    ],
    tarifasEpp: [{ montoHasta: 25000, costo: 1000 }, { montoHasta: 50000, costo: 2000 }],
    tarifasEquipo: [{ montoHasta: 25000, costo: 1000 }, { montoHasta: 50000, costo: 2000 }],
  };
}

describe("excelCosteo", () => {
  it("genera las 12 hojas de la plantilla y el importador lo vuelve a leer sin avisos", async () => {
    const bytes = await excelCosteo(datos6744());
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof libro.xlsx.load>[0]);
    expect(libro.worksheets.map((h) => h.name)).toEqual([
      "Gastos proyecto", "Nomina", "Imss", "Desgaste de Equipo", "Bonos", "Insumos", "Gasolina",
      "Administrativos", "Epp", "Compra de Equipo", "Tabla de montos",
    ]);

    const leido = interpretarCosteo(libro);
    expect(leido.avisos).toEqual([]);
    expect(leido.noCotizacion).toBe(6744);
    expect(leido.folio).toBe(3434);
    expect(leido.fecha).toBe("2026-08-26");
    expect(leido.precioVenta).toBe(130800);
    expect(leido.autoriza).toBe("AUTORIZA RODOLFO");
    expect(leido.porcentajes).toEqual({ impuestosPct: 10, administrativosPct: 5, financiamientoPct: 5, comisionPct: 4 });
    expect(leido.nomina).toHaveLength(6);
    expect(leido.nomina[0]).toMatchObject({ nombre: "TECNICO 1", dias: 5, salarioDiario: 700, imssDiario: 51.3, desgasteDiario: 100, bono: 800 });
    expect(leido.nomina[5]).toMatchObject({ desgasteDiario: 0 });
    expect(leido.insumos).toHaveLength(12);
    expect(leido.insumos[11]).toMatchObject({ aplica: false });
    expect(leido.gastos.map((g) => [g.concepto, g.cantidad])).toEqual([
      ["GASOLINA", 1500], ["ADMINISTRATIVO", 400], ["EPP", 350], ["EQUIPO", 350],
    ]);
  });

  it("lo que dice la hoja Gastos proyecto cuadra con el motor", async () => {
    const bytes = await excelCosteo(datos6744());
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof libro.xlsx.load>[0]);
    const leido = interpretarCosteo(libro);
    const r = calcularCosteo({
      nomina: leido.nomina.map((p) => ({ ...p, idPuesto: 1, diasLaborados: p.dias })),
      insumos: leido.insumos.map((i) => ({ descripcion: i.descripcion, unidades: i.unidades, costo: i.costoPlan, aplica: i.aplica })),
      gastos: { gasolina: 1500, administrativo: 400, epp: 350, equipo: 350 },
      porcentajes: leido.porcentajes,
      precioVenta: leido.precioVenta,
    });
    expect(r.gastoTotal).toBeCloseTo(leido.gastoTotalExcel, 2);
    expect(r.utilidadNeta).toBeCloseTo(leido.utilidadNetaExcel, 2);
    expect(r.utilidadNeta).toBeCloseTo(73321.8, 1);
  });
});
