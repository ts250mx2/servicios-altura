import { describe, expect, it } from "vitest";
import type { Cliente, Insumo, Puesto } from "@/lib/consultas/catalogos";
import { indiceUltimosCostos } from "@/lib/costeo/ultimos-costos";
import { levantamientoVacio } from "./interpretar";
import { buscarCliente, buscarPuesto, prepararRevision } from "./preparar";
import type { LevantamientoExtraido } from "./tipos";

/** La semilla de sql/esquema.sql. */
const PUESTOS: Puesto[] = [
  { IdPuesto: 1, Puesto: "TÉCNICO EN ALTURA", Abreviatura: "TÉCNICO", SalarioDiario: 700, ImssDiario: 51.3, DesgasteDiario: 100, BonoDefault: 800, TarifaVentaDia: 4200, Orden: 1 },
  { IdPuesto: 2, Puesto: "SUPERVISOR", Abreviatura: "SUPERV.", SalarioDiario: 900, ImssDiario: 51.3, DesgasteDiario: 100, BonoDefault: 800, TarifaVentaDia: 4800, Orden: 2 },
  { IdPuesto: 3, Puesto: "AYUDANTE", Abreviatura: "AYUD.", SalarioDiario: 500, ImssDiario: 51.3, DesgasteDiario: 0, BonoDefault: 0, TarifaVentaDia: 2500, Orden: 3 },
  { IdPuesto: 4, Puesto: "SUPERVISOR DE SEGURIDAD", Abreviatura: "SUP SEG", SalarioDiario: 800, ImssDiario: 51.3, DesgasteDiario: 100, BonoDefault: 800, TarifaVentaDia: 4200, Orden: 4 },
  { IdPuesto: 5, Puesto: "VIGÍA", Abreviatura: "VIGÍA", SalarioDiario: 600, ImssDiario: 51.3, DesgasteDiario: 0, BonoDefault: 800, TarifaVentaDia: 3000, Orden: 5 },
];

const CLIENTES: Cliente[] = [
  { IdCliente: 7, Cliente: "Iglesia San Juan de los Lagos", Planta: null, Contacto: null, Correo: null, Telefono: null, Ciudad: null },
];

const INSUMOS: Insumo[] = [
  { IdInsumo: 3, Insumo: "Cartuchos de silicón Duretán base de poliuretano negro", Unidad: "PZA", CostoUnitario: 145, EsHerramental: 0 },
  { IdInsumo: 9, Insumo: "EXACTOS", Unidad: "PZA", CostoUnitario: 30, EsHerramental: 1 },
];

function extraido(cambios: Partial<LevantamientoExtraido>): LevantamientoExtraido {
  return { ...levantamientoVacio([]), ...cambios };
}

describe("buscarPuesto", () => {
  it("empata las etiquetas de columna del PDF con la semilla de puestos", () => {
    expect(buscarPuesto("TÉCNICO", PUESTOS)?.IdPuesto).toBe(1);
    expect(buscarPuesto("SUPERVISOR", PUESTOS)?.IdPuesto).toBe(2);
    expect(buscarPuesto("AYUDANTE", PUESTOS)?.IdPuesto).toBe(3);
    expect(buscarPuesto("SUP SEG", PUESTOS)?.IdPuesto).toBe(4);
    expect(buscarPuesto("VIGÍA", PUESTOS)?.IdPuesto).toBe(5);
  });

  it("no inventa un puesto que no existe", () => {
    expect(buscarPuesto("GERENTE", PUESTOS)).toBeUndefined();
    expect(buscarPuesto("", PUESTOS)).toBeUndefined();
  });
});

describe("buscarCliente", () => {
  it("ignora mayúsculas y acentos", () => {
    expect(buscarCliente("IGLESIA SAN JUAN DE LOS LAGOS", CLIENTES)?.IdCliente).toBe(7);
    expect(buscarCliente("Otro cliente", CLIENTES)).toBeUndefined();
  });
});

describe("prepararRevision", () => {
  it("deja al cliente como nuevo y avisa cuando no está en el catálogo", () => {
    const { inicial, avisos } = prepararRevision(extraido({ cliente: "PARROQUIA NUEVA" }), {
      clientes: CLIENTES, puestos: PUESTOS, insumos: INSUMOS,
    });
    expect(inicial.idCliente).toBe("nuevo");
    expect(inicial.clienteNuevo).toBe("PARROQUIA NUEVA");
    expect(avisos).toContain("El cliente «PARROQUIA NUEVA» no está en el catálogo; se dará de alta al guardar.");
  });

  it("usa el cliente del catálogo cuando empata", () => {
    const { inicial } = prepararRevision(extraido({ cliente: "IGLESIA SAN JUAN DE LOS LAGOS" }), {
      clientes: CLIENTES, puestos: PUESTOS, insumos: INSUMOS,
    });
    expect(inicial.idCliente).toBe(7);
    expect(inicial.clienteNuevo).toBe("");
  });

  it("convierte el personal a puestos del catálogo y avisa del que no reconoce", () => {
    const { inicial, avisos } = prepararRevision(
      extraido({
        personal: [
          { puesto: "TÉCNICO", cantidad: 4, tiempoExtra: false, bono: true },
          { puesto: "SUPERVISOR", cantidad: 0, tiempoExtra: false, bono: false },
          { puesto: "SUP SEG", cantidad: 1, tiempoExtra: true, bono: true },
          { puesto: "BUZO", cantidad: 2, tiempoExtra: false, bono: false },
        ],
      }),
      { clientes: CLIENTES, puestos: PUESTOS, insumos: INSUMOS },
    );
    expect(inicial.personal).toEqual([
      { idPuesto: 1, cantidad: 4, tiempoExtra: false, bono: true },
      { idPuesto: 4, cantidad: 1, tiempoExtra: true, bono: true },
    ]);
    expect(avisos).toContain("No se reconoció el puesto «BUZO» (2); asígnalo a mano en Recursos.");
  });

  it("costea los insumos del catálogo y deja libres los demás", () => {
    const { inicial, avisos } = prepararRevision(
      extraido({
        insumos: [
          { cantidad: 70, descripcion: "CARTUCHOS DE SILICON DURETAN BASE DE POLIURETANO NEGRO" },
          { cantidad: 30, descripcion: "ROLLOS DE MASKINGTAPE" },
          { cantidad: 3, descripcion: "CUBETAS DE IMPERMEABILIZANTE (NO APLICAR)" },
        ],
        herramental: [{ cantidad: 5, descripcion: "Exactos" }],
      }),
      { clientes: CLIENTES, puestos: PUESTOS, insumos: INSUMOS },
    );
    expect(inicial.insumos[0]).toMatchObject({ idInsumo: 3, cantidad: 70, costo: 70 * 145, esHerramental: false, aplica: true });
    expect(inicial.insumos[1]).toMatchObject({ idInsumo: null, costo: 0, esHerramental: false, aplica: true });
    expect(inicial.insumos[2]).toMatchObject({ idInsumo: null, aplica: false });
    expect(inicial.insumos[3]).toMatchObject({ idInsumo: 9, costo: 150, esHerramental: true });
    expect(avisos).toContain("2 partidas no están en el catálogo de insumos; captura su costo en Recursos.");
  });

  it("usa el último costo de costeos anteriores antes que el catálogo", () => {
    const ultimosCostos = indiceUltimosCostos([
      { IdInsumo: 3, Descripcion: "Cartuchos de silicón Duretán base de poliuretano negro", Unidades: 10, CostoPlan: 1600 },
      { IdInsumo: null, Descripcion: "Rollos de maskingtape", Unidades: 30, CostoPlan: 1050 },
    ]);
    const { inicial, avisos } = prepararRevision(
      extraido({
        insumos: [
          { cantidad: 70, descripcion: "CARTUCHOS DE SILICON DURETAN BASE DE POLIURETANO NEGRO" },
          { cantidad: 4, descripcion: "ROLLOS DE MASKINGTAPE" },
        ],
        herramental: [{ cantidad: 5, descripcion: "Exactos" }],
      }),
      { clientes: CLIENTES, puestos: PUESTOS, insumos: INSUMOS, ultimosCostos },
    );
    expect(inicial.insumos[0]).toMatchObject({ idInsumo: 3, costo: 70 * 160 });
    expect(inicial.insumos[1]).toMatchObject({ idInsumo: null, costo: 4 * 35 });
    expect(inicial.insumos[2]).toMatchObject({ idInsumo: 9, costo: 150 });
    expect(avisos.some((a) => a.includes("no están en el catálogo"))).toBe(false);
  });

  it("rellena lo que el PDF no trajo con valores seguros", () => {
    const { inicial } = prepararRevision(
      extraido({
        fecha: null, dias: null, nivelRiesgo: null, elaboro: "", responsable: "JUAN", trabajoNormal: false,
      }),
      { clientes: CLIENTES, puestos: PUESTOS, insumos: INSUMOS },
    );
    expect(inicial.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(inicial.dias).toBe(1);
    expect(inicial.nivelRiesgo).toBe("ALTO");
    expect(inicial.elaboro).toBe("JUAN");
    expect(inicial.trabajoNormal).toBe(false);
    expect(inicial.actividades).toEqual([{ descripcion: "", metros: 0 }]);
  });
});
