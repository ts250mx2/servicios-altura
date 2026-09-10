import { describe, expect, it } from "vitest";
import { agruparLineas, columnaMasCercana, entero, esSi, normalizar, numero } from "./lineas";
import type { Fragmento } from "./tipos";

function f(x: number, y: number, texto: string, ancho = texto.length * 5): Fragmento {
  return { x, y, ancho, texto };
}

describe("columnaMasCercana", () => {
  const centros = [100, 200, 300];

  it("elige la columna cuyo centro queda más cerca del centro del fragmento", () => {
    expect(columnaMasCercana(f(195, 0, "SÍ", 10), centros)).toBe(1); // centro 200
    expect(columnaMasCercana(f(80, 0, "4", 40), centros)).toBe(0); // centro 100
  });

  it("devuelve -1 cuando el fragmento no cae cerca de ninguna columna", () => {
    expect(columnaMasCercana(f(400, 0, "PÁGINA 2", 40), centros)).toBe(-1); // centro 420
    expect(columnaMasCercana(f(150, 0, "x", 0), centros, 10)).toBe(-1); // a 50 de ambas
    expect(columnaMasCercana(f(100, 0, "x", 0), [])).toBe(-1);
  });
});

describe("agruparLineas", () => {
  it("junta en un renglón los fragmentos a menos de 2 unidades y los ordena por x", () => {
    const lineas = agruparLineas([
      { numero: 1, ancho: 612, alto: 792, fragmentos: [f(300, 101.5, "B"), f(47, 100, "A"), f(47, 120, "C")] },
      { numero: 2, ancho: 612, alto: 792, fragmentos: [f(47, 50, "D")] },
    ]);
    expect(lineas.map((l) => l.texto)).toEqual(["A B", "C", "D"]);
    expect(lineas[2].yAbs).toBe(792 + 50);
  });
});

describe("normalizar, numero, entero, esSi", () => {
  it("normaliza acentos, mayúsculas y espacios", () => {
    expect(normalizar("  Técnico   en Altura ")).toBe("TECNICO EN ALTURA");
  });

  it("convierte cifras con comas y trata el guion como cero", () => {
    expect(numero("1,250.50")).toBe(1250.5);
    expect(numero("abc")).toBe(0);
    expect(entero("4")).toBe(4);
    expect(entero("-")).toBe(0);
  });

  it("reconoce SÍ en cualquiera de sus formas", () => {
    expect(esSi("SÍ")).toBe(true);
    expect(esSi("Si")).toBe(true);
    expect(esSi("No")).toBe(false);
    expect(esSi(undefined)).toBe(false);
  });
});
