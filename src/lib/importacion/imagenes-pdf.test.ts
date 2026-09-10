import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extraerFotos } from "./imagenes-pdf";

const RUTA_6744 = path.resolve(process.cwd(), "6744.pdf");
const RUTA_6745 = path.resolve(process.cwd(), "6745.pdf");
const hayPdfs = existsSync(RUTA_6744) && existsSync(RUTA_6745);

describe.skipIf(!hayPdfs)("extraerFotos", () => {
  it("saca las 3 fotos de evidencia del 6744 y deja fuera el logo", async () => {
    const fotos = await extraerFotos(new Uint8Array(readFileSync(RUTA_6744)));
    expect(fotos.map((f) => f.pagina)).toEqual([2, 3, 4]);
    expect(fotos.map((f) => [f.ancho, f.alto])).toEqual([[1440, 3200], [1440, 3200], [1836, 4080]]);
    for (const foto of fotos) {
      expect([foto.jpeg[0], foto.jpeg[1]]).toEqual([0xff, 0xd8]); // cabecera JPEG
    }
  });

  it("no encuentra fotos en el 6745, que sólo trae el logo", async () => {
    expect(await extraerFotos(new Uint8Array(readFileSync(RUTA_6745)))).toEqual([]);
  });
});
