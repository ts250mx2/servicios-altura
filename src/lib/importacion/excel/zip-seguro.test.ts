import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ErrorDeImportacion } from "../errores";
import { LIMITES_ZIP, verificarZipSeguro } from "./zip-seguro";

/** Arma un ZIP mínimo (encabezados locales + directorio central + fin) con las entradas dadas. */
function armarZip(entradas: { nombre: string; datos: Uint8Array; declarar?: number }[]): Uint8Array {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;
  for (const e of entradas) {
    const nombre = Buffer.from(e.nombre, "utf8");
    const comprimido = deflateRawSync(e.datos);
    const declarado = e.declarar ?? e.datos.byteLength;
    const local = Buffer.alloc(30 + nombre.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(declarado, 22);
    local.writeUInt16LE(nombre.length, 26);
    nombre.copy(local, 30);
    const central = Buffer.alloc(46 + nombre.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(declarado, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    nombre.copy(central, 46);
    locales.push(local, comprimido);
    centrales.push(central);
    desplazamiento += local.length + comprimido.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return new Uint8Array(Buffer.concat([...locales, directorio, fin]));
}

const RUTA_REAL = readdirSync(process.cwd()).find((f) => f.startsWith("NoC. 6744") && f.endsWith(".xlsx"));

describe("verificarZipSeguro", () => {
  it.skipIf(!RUTA_REAL)("acepta el Excel real de costeo", () => {
    const bytes = new Uint8Array(readFileSync(path.resolve(process.cwd(), RUTA_REAL!)));
    expect(() => verificarZipSeguro(bytes)).not.toThrow();
  });

  it("acepta un ZIP chico armado a mano", () => {
    const zip = armarZip([{ nombre: "xl/workbook.xml", datos: Buffer.from("<workbook/>") }]);
    expect(() => verificarZipSeguro(zip)).not.toThrow();
  });

  it("rechaza una entrada que declara más de lo permitido", () => {
    const zip = armarZip([{ nombre: "a.xml", datos: Buffer.alloc(1024), declarar: LIMITES_ZIP.maxPorEntrada + 1 }]);
    expect(() => verificarZipSeguro(zip)).toThrow(ErrorDeImportacion);
    expect(() => verificarZipSeguro(zip)).toThrow(/demasiado grande/);
  });

  it("rechaza una entrada que se infla más de lo que declara (bomba con tamaño mentido)", () => {
    const zip = armarZip([{ nombre: "a.xml", datos: Buffer.alloc(4 * 1024 * 1024), declarar: 100 }]);
    expect(() => verificarZipSeguro(zip)).toThrow(/se expande más de lo que declara/);
  });

  it("rechaza cuando el total inflado pasa el tope aunque cada entrada quepa", () => {
    const zip = armarZip([
      { nombre: "a.xml", datos: Buffer.alloc(3 * 1024 * 1024) },
      { nombre: "b.xml", datos: Buffer.alloc(3 * 1024 * 1024) },
    ]);
    expect(() => verificarZipSeguro(zip, { maxEntradas: 10, maxPorEntrada: 4 * 1024 * 1024, maxTotal: 5 * 1024 * 1024 }))
      .toThrow(/se expande demasiado/);
  });

  it("rechaza lo que no es un ZIP", () => {
    expect(() => verificarZipSeguro(new Uint8Array(Buffer.from("%PDF-1.4 no soy zip")))).toThrow(/directorio del ZIP/);
  });
});
