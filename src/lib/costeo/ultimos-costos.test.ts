import { describe, expect, it } from "vitest";
import { costoUnitarioDe, importePartida, indiceUltimosCostos, SIN_ULTIMOS_COSTOS } from "./ultimos-costos";

describe("indiceUltimosCostos", () => {
  it("se queda con el costo unitario más reciente de cada insumo", () => {
    const indice = indiceUltimosCostos([
      { IdInsumo: 3, Descripcion: "Cartuchos de silicón", Unidades: 10, CostoPlan: 1600 },
      { IdInsumo: 3, Descripcion: "CARTUCHOS DE SILICON", Unidades: 70, CostoPlan: 10150 },
    ]);
    expect(indice.porId[3]).toBe(160);
    expect(indice.porDescripcion["CARTUCHOS DE SILICON"]).toBe(160);
  });

  it("indexa la captura libre por descripción sin acentos ni mayúsculas", () => {
    const indice = indiceUltimosCostos([
      { IdInsumo: null, Descripcion: "Rollos de  maskingtape", Unidades: 30, CostoPlan: 1050 },
    ]);
    expect(indice.porId).toEqual({});
    expect(indice.porDescripcion["ROLLOS DE MASKINGTAPE"]).toBe(35);
  });

  it("ignora partidas sin unidades o sin costo (NO APLICAR)", () => {
    const indice = indiceUltimosCostos([
      { IdInsumo: 3, Descripcion: "Cartuchos", Unidades: 5, CostoPlan: 0 },
      { IdInsumo: 3, Descripcion: "Cartuchos", Unidades: 0, CostoPlan: 100 },
      { IdInsumo: 3, Descripcion: "Cartuchos", Unidades: 2, CostoPlan: 290 },
    ]);
    expect(indice.porId[3]).toBe(145);
  });
});

describe("costoUnitarioDe", () => {
  const ultimos = indiceUltimosCostos([
    { IdInsumo: 3, Descripcion: "Cartuchos de silicón", Unidades: 10, CostoPlan: 1600 },
    { IdInsumo: null, Descripcion: "Rollos de maskingtape", Unidades: 30, CostoPlan: 1050 },
  ]);

  it("prefiere el último costeado sobre el catálogo", () => {
    expect(costoUnitarioDe({ idInsumo: 3, descripcion: "otro texto" }, ultimos, 145)).toBe(160);
  });

  it("encuentra la captura libre por descripción", () => {
    expect(costoUnitarioDe({ idInsumo: null, descripcion: "ROLLOS DE MASKINGTAPE" }, ultimos)).toBe(35);
  });

  it("cae al catálogo y, si no hay nada, devuelve null", () => {
    expect(costoUnitarioDe({ idInsumo: 9, descripcion: "EXACTOS" }, SIN_ULTIMOS_COSTOS, 30)).toBe(30);
    expect(costoUnitarioDe({ idInsumo: null, descripcion: "NUEVO" }, ultimos)).toBeNull();
  });
});

describe("importePartida", () => {
  it("redondea a centavos", () => {
    expect(importePartida(33.333, 3)).toBe(100);
    expect(importePartida(0.336, 1)).toBe(0.34);
  });
});
