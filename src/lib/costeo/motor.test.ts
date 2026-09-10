import { describe, expect, it } from "vitest";
import {
  calcularCosteo,
  costoPorMonto,
  precioPorMargen,
  precioPorTarifa,
  semaforoMargen,
} from "./motor";
import type { RenglonNomina } from "./tipos";

/** 6 técnicos, 5 días: $700 nómina, $51.30 IMSS, $100 desgaste, $800 bono. */
function nomina6744(): RenglonNomina[] {
  return Array.from({ length: 6 }, (_, i) => ({
    nombre: `TECNICO ${i + 1}`,
    idPuesto: 1,
    salarioDiario: 700,
    imssDiario: 51.3,
    desgasteDiario: i < 4 ? 100 : 0, // el Excel sólo cargó desgaste a 4 de los 6
    bono: 800,
    diasLaborados: 5,
  }));
}

describe("costeo del proyecto 6744 — silicón Duretán, Iglesia San Juan de los Lagos", () => {
  const resultado = calcularCosteo({
    nomina: nomina6744(),
    insumos: [
      { descripcion: "CARTUCHOS DE SILICON DURETAN", unidades: 70, costo: 10150 },
      { descripcion: "ROLLOS DE MASKINGTAPE 3/4", unidades: 30, costo: 2550 },
      { descripcion: "PACA DE TRAPO INDUSTRIAL 25 KG", unidades: 1, costo: 800 },
      { descripcion: "COSTALES GRANDES PARA BASURA", unidades: 8, costo: 112 },
      { descripcion: "GALONES DE THINNER", unidades: 2, costo: 480 },
      { descripcion: "PAQUETES DE REPUESTOS DE NAVAJA", unidades: 2, costo: 150 },
      { descripcion: "PISTOLAS CALAFATEADORAS", unidades: 4, costo: 250 },
      { descripcion: "CUBETAS VACIAS DE 19 LITROS", unidades: 5, costo: 100 },
      { descripcion: "EXACTOS", unidades: 5, costo: 150 },
      { descripcion: "ATOMIZADORES", unidades: 5, costo: 100 },
      { descripcion: "JABON LIQUIDO", unidades: 1, costo: 100 },
    ],
    gastos: { gasolina: 1500, administrativo: 400, epp: 350, equipo: 350 },
    precioVenta: 130800,
  });

  it("reproduce los renglones del resumen de gasto", () => {
    expect(resultado.conceptos.NOMINA).toBe(21000);
    expect(resultado.conceptos.IMSS).toBe(1539);
    expect(resultado.conceptos.BONOS).toBe(4800);
    expect(resultado.conceptos.DESGASTE).toBe(2000);
    expect(resultado.conceptos.INSUMOS).toBe(14942);
  });

  it("reproduce la cadena de cálculo del Excel", () => {
    expect(resultado.gastoDirecto).toBe(31939);
    expect(resultado.impuestos).toBe(3193.9);
    expect(resultado.subtotal1).toBe(35132.9);
    expect(resultado.administrativos).toBe(1756.65);
    expect(resultado.subtotal3).toBeCloseTo(51831.55, 1);
    expect(resultado.gastoTotal).toBeCloseTo(54423.12, 2);
  });

  it("reproduce utilidad, comisión y margen", () => {
    expect(resultado.utilidadBruta).toBeCloseTo(76376.88, 2);
    expect(resultado.comision).toBeCloseTo(3055.08, 2);
    expect(resultado.utilidadNeta).toBeCloseTo(73321.8, 1);
    expect(resultado.margenPct).toBeCloseTo(56.06, 1);
  });
});

describe("costeo del proyecto 6745 — impermeabilización de 3 azoteas", () => {
  const nomina: RenglonNomina[] = [
    ...Array.from({ length: 3 }, (_, i) => ({
      nombre: `TECNICO ${i + 1}`,
      idPuesto: 1,
      salarioDiario: 875,
      imssDiario: 51.3,
      desgasteDiario: 100,
      bono: 600,
      diasLaborados: 4,
    })),
    {
      nombre: "SUP. SEGURIDAD",
      idPuesto: 4,
      salarioDiario: 875,
      imssDiario: 51.3,
      desgasteDiario: 100,
      bono: 600,
      diasLaborados: 4,
    },
    {
      nombre: "VIGIA",
      idPuesto: 5,
      salarioDiario: 0,
      imssDiario: 51.3,
      desgasteDiario: 100,
      bono: 600,
      diasLaborados: 4,
    },
  ];

  it("respeta las partidas marcadas NO APLICAR", () => {
    const resultado = calcularCosteo({
      nomina: [],
      insumos: [
        { descripcion: "SELLADOR PRIMARIO TAPAPORO", unidades: 3, costo: 4500, aplica: false },
        { descripcion: "BROCHAS DE 4 PULGADAS", unidades: 3, costo: 375 },
        { descripcion: "IMPERMEABILIZANTE ELASTOMERICO", unidades: 30, costo: 60000, aplica: false },
        { descripcion: "ESCALERA DE EXTENSION DE FIBRA DE VIDRIO", unidades: 1, costo: 800 },
        { descripcion: "EXACTOS", unidades: 2, costo: 60 },
      ],
    });
    expect(resultado.insumos).toBe(1235);
  });

  it("reproduce la cadena con el gasto directo real del proyecto", () => {
    // El gasto directo del 6745 fue 21,376; lo armamos con gastos sueltos para
    // aislar la cadena de porcentajes del detalle de nómina.
    const resultado = calcularCosteo({
      nomina: [],
      insumos: [{ descripcion: "INSUMOS", unidades: 1, costo: 1235 }],
      gastos: { gasolina: 21376 },
      precioVenta: 55440.988,
    });
    expect(resultado.gastoDirecto).toBe(21376);
    expect(resultado.impuestos).toBe(2137.6);
    expect(resultado.subtotal2).toBe(24689.28);
    expect(resultado.subtotal3).toBe(25924.28);
    expect(resultado.gastoTotal).toBeCloseTo(27220.49, 2);
    expect(resultado.utilidadNeta).toBeCloseTo(27091.67, 1);
    expect(resultado.margenPct).toBeCloseTo(48.87, 1);
  });

  it("suma la nómina por persona y por día", () => {
    const resultado = calcularCosteo({ nomina, insumos: [] });
    expect(resultado.conceptos.IMSS).toBe(1026); // 5 personas × 4 días × 51.30
    expect(resultado.conceptos.BONOS).toBe(3000); // 5 × 600
  });
});

describe("precio inverso", () => {
  it("el precio por margen devuelve exactamente ese margen", () => {
    const gastoTotal = 54423.12;
    const precio = precioPorMargen(gastoTotal, 50, 4);
    const resultado = calcularCosteo({
      nomina: [],
      insumos: [],
      gastos: { gasolina: 0 },
      precioVenta: precio,
    });
    // El costeo de arriba no reconstruye el gasto; verificamos la fórmula sola.
    const utilidadBruta = precio - gastoTotal;
    const utilidadNeta = utilidadBruta * 0.96;
    expect((utilidadNeta / precio) * 100).toBeCloseTo(50, 3);
    expect(resultado.precioVenta).toBeCloseTo(precio, 2);
  });

  it("devuelve 0 cuando el margen pedido es imposible", () => {
    expect(precioPorMargen(50000, 96, 4)).toBe(0);
    expect(precioPorMargen(50000, 120, 4)).toBe(0);
  });
});

describe("precio por tarifa", () => {
  it("reproduce el precio del 6744: 6 personas × 5 días × 4,200 + 4,800 de bonos", () => {
    const precio = precioPorTarifa([{ cantidad: 6, tarifaVentaDia: 4200, bono: 800 }], 5);
    expect(precio).toBe(130800);
  });
});

describe("tabla de montos", () => {
  const tabla = [
    { montoHasta: 25000, costo: 1000 },
    { montoHasta: 50000, costo: 2000 },
    { montoHasta: 100000, costo: 5000 },
    { montoHasta: 150000, costo: 6500 },
  ];

  it("toma el primer escalón que cubre el monto", () => {
    expect(costoPorMonto(tabla, 20000)).toBe(1000);
    expect(costoPorMonto(tabla, 25000)).toBe(1000);
    expect(costoPorMonto(tabla, 25001)).toBe(2000);
    expect(costoPorMonto(tabla, 130800)).toBe(6500);
  });

  it("usa el último escalón cuando el monto se pasa de la tabla", () => {
    expect(costoPorMonto(tabla, 9_000_000)).toBe(6500);
  });
});

describe("semáforo de margen", () => {
  it("clasifica los dos proyectos reales en verde", () => {
    expect(semaforoMargen(56.06)).toBe("bueno");
    expect(semaforoMargen(48.87)).toBe("bueno");
  });

  it("marca alerta y crítico en los umbrales", () => {
    expect(semaforoMargen(44.9)).toBe("alerta");
    expect(semaforoMargen(30)).toBe("alerta");
    expect(semaforoMargen(29.9)).toBe("critico");
  });
});
