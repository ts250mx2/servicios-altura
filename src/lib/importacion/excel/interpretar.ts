import type { Workbook, Worksheet } from "exceljs";
import { CONCEPTOS, PORCENTAJES_DEFAULT, type Concepto } from "@/lib/costeo/tipos";
import { normalizar } from "../lineas";
import {
  columna, comoNumero, comoTexto, fechaIso, filaConEtiqueta, hojaPorNombre,
  numero, texto, ultimaFilaConEtiqueta, valorJuntoA,
} from "./celdas";
import { leerBonos, leerGastosConFecha, leerGasolina, leerInsumos, leerMatrizDias } from "./hojas";
import type { CosteoExtraido, PersonaExtraida } from "./tipos";

type Porcentajes = CosteoExtraido["porcentajes"];
type Conceptos = CosteoExtraido["conceptosPlan"];

/** Etiquetas de la columna A del resumen de conceptos, ya normalizadas. */
const ETIQUETA_CONCEPTO: Record<string, Concepto> = {
  NOMINA: "NOMINA",
  IMSS: "IMSS",
  BONOS: "BONOS",
  GASOLINA: "GASOLINA",
  "DESGASTE DE EQUIPO": "DESGASTE",
  ADMINISTRATIVO: "ADMINISTRATIVO",
  INSUMOS: "INSUMOS",
  EPP: "EPP",
  EQUIPO: "EQUIPO",
};

const COL_A = 1;
const COL_C = 3;
const COL_D = 4;
const COL_E = 5;

/** Un porcentaje derivado del Excel se acepta si queda entre 0 y 100 y con dos decimales. */
function porcentaje(numerador: number, denominador: number, defecto: number): number {
  if (denominador === 0 || !Number.isFinite(numerador / denominador)) return defecto;
  const pct = Math.round((numerador / denominador) * 10000) / 100;
  return pct >= 0 && pct <= 100 ? pct : defecto;
}

/**
 * Convierte el libro de costeo en datos. Es una función pura sobre el libro ya
 * cargado: no toca base de datos ni archivos, y se prueba contra los dos reales.
 */
export function interpretarCosteo(libro: Workbook): CosteoExtraido {
  const resumen = hojaPorNombre(libro, "Gastos proyecto");
  if (!resumen) {
    return costeoVacio(["El libro no tiene la hoja «Gastos proyecto»; no es un Excel de costeo."]);
  }

  const avisos: string[] = [];
  const encabezado = leerEncabezado(resumen);
  const cadena = leerCadena(resumen, avisos);
  const [conceptosPlan, conceptosReal] = leerConceptos(resumen, avisos);

  const nomina = leerNomina(libro, avisos);
  const insumos = conHoja(libro, "Insumos", avisos, leerInsumos) ?? [];
  const gastos = [
    ...(conHoja(libro, "Gasolina", avisos, leerGasolina) ?? []),
    ...(conHoja(libro, "Administrativos", avisos, (h) => leerGastosConFecha(h, "ADMINISTRATIVO")) ?? []),
    ...(conHoja(libro, "Epp", avisos, (h) => leerGastosConFecha(h, "EPP")) ?? []),
    ...(conHoja(libro, "Compra de Equipo", avisos, (h) => leerGastosConFecha(h, "EQUIPO")) ?? []),
  ];

  const datos: Omit<CosteoExtraido, "avisos"> = {
    ...encabezado,
    ...cadena,
    conceptosPlan,
    conceptosReal,
    nomina,
    insumos,
    gastos,
  };

  return { ...datos, avisos: [...avisos, ...avisosGenerales(datos)] };
}

function conHoja<T>(
  libro: Workbook,
  nombre: string,
  avisos: string[],
  leer: (hoja: Worksheet) => [T, string[]],
): T | null {
  const hoja = hojaPorNombre(libro, nombre);
  if (!hoja) {
    avisos.push(`No se encontró la hoja «${nombre}».`);
    return null;
  }
  const [valor, avisosHoja] = leer(hoja);
  avisos.push(...avisosHoja);
  return valor;
}

// ── Encabezado (Gastos proyecto, filas 1-7) ─────────────────────────────────

function leerEncabezado(hoja: Worksheet) {
  const titulo = texto(hoja, 1, COL_A);
  const numeroEnTitulo = titulo.match(/^\s*(\d{3,6})\s+(.*)$/s);
  const noCotizacion = comoNumero(valorJuntoA(hoja, "Cotización:")) ?? (numeroEnTitulo ? Number(numeroEnTitulo[1]) : null);
  return {
    noCotizacion: noCotizacion === null ? null : Math.trunc(noCotizacion),
    folio: entero(comoNumero(valorJuntoA(hoja, "Hoja de levantamiento:"))),
    descripcion: (numeroEnTitulo ? numeroEnTitulo[2] : titulo).trim(),
    usuario: comoTexto(valorJuntoA(hoja, "Usuario:")),
    planta: comoTexto(valorJuntoA(hoja, "Planta:")),
    vendedor: comoTexto(valorJuntoA(hoja, "Vendedor:")),
    fecha: fechaIso(valorJuntoA(hoja, "Fecha de emision:")),
    dias: entero(comoNumero(valorJuntoA(hoja, "Dias de trabajo:"))),
    personal: entero(comoNumero(valorJuntoA(hoja, "Personal:"))),
  };
}

function entero(valor: number | null): number | null {
  return valor === null ? null : Math.trunc(valor);
}

// ── Cadena de costeo (columna C, plan) ──────────────────────────────────────

function leerCadena(hoja: Worksheet, avisos: string[]): {
  precioVenta: number;
  isr: number;
  autoriza: string;
  porcentajes: Porcentajes;
  gastoTotalExcel: number;
  utilidadNetaExcel: number;
} {
  const valorEn = (etiqueta: string): number | null => {
    const fila = filaConEtiqueta(hoja, COL_A, etiqueta);
    return fila < 0 ? null : numero(hoja, fila, COL_C);
  };
  const filaPrecio = filaConEtiqueta(hoja, COL_A, "Costo sin Iva");
  const precioVenta = filaPrecio < 0 ? null : numero(hoja, filaPrecio, COL_C);
  if (precioVenta === null) avisos.push("No se encontró el «Costo sin Iva» (precio de venta).");

  const gastoDirecto = valorEn("Gasto total planeado") ?? 0;
  const impuestos = valorEn("Impuestos") ?? 0;
  const administrativos = valorEn("Administrativos") ?? 0;
  const insumos = valorEn("Insumos") ?? 0;
  const financiamiento = valorEn("Financiamiento") ?? 0;
  const gastoTotal = valorEn("Gasto plan Total") ?? 0;
  const comision = valorEn("Comisión Vendedor") ?? valorEn("Comision Vendedor") ?? 0;
  const filaUtilidadNeta = ultimaFilaConEtiqueta(hoja, COL_A, "Utilidad");
  const utilidadNeta = filaUtilidadNeta < 0 ? 0 : (numero(hoja, filaUtilidadNeta, COL_C) ?? 0);
  const utilidadBruta = (precioVenta ?? 0) - gastoTotal;

  return {
    precioVenta: precioVenta ?? 0,
    isr: valorEn("ISR") ?? 0,
    autoriza: filaPrecio < 0 ? "" : texto(hoja, filaPrecio, COL_E),
    porcentajes: {
      impuestosPct: porcentaje(impuestos, gastoDirecto, PORCENTAJES_DEFAULT.impuestosPct),
      administrativosPct: porcentaje(administrativos, gastoDirecto + impuestos, PORCENTAJES_DEFAULT.administrativosPct),
      financiamientoPct: porcentaje(
        financiamiento, gastoDirecto + impuestos + administrativos + insumos, PORCENTAJES_DEFAULT.financiamientoPct,
      ),
      comisionPct: porcentaje(comision, utilidadBruta, PORCENTAJES_DEFAULT.comisionPct),
    },
    gastoTotalExcel: gastoTotal,
    utilidadNetaExcel: utilidadNeta,
  };
}

// ── Resumen de conceptos (Concepto / Gasto plan / Gasto real) ───────────────

function leerConceptos(hoja: Worksheet, avisos: string[]): [Conceptos, Conceptos] {
  const vacio = Object.fromEntries(CONCEPTOS.map((c) => [c, 0])) as Conceptos;
  const plan = { ...vacio };
  const real = { ...vacio };
  const inicio = filaConEtiqueta(hoja, COL_A, "Concepto");
  if (inicio < 0) {
    avisos.push("No se encontró la tabla de conceptos (Nómina, IMSS, Bonos…).");
    return [plan, real];
  }
  for (let fila = inicio + 1; fila <= inicio + 12; fila++) {
    const etiqueta = normalizar(texto(hoja, fila, COL_A));
    if (etiqueta.startsWith("TOTAL")) break;
    const concepto = ETIQUETA_CONCEPTO[etiqueta];
    if (!concepto) continue;
    plan[concepto] = numero(hoja, fila, COL_C) ?? 0;
    real[concepto] = numero(hoja, fila, COL_D) ?? 0;
  }
  return [plan, real];
}

// ── Nómina: las tres matrices y los bonos fundidos por nombre ───────────────

/** Columnas de cada hoja-matriz de la plantilla. */
const MATRIZ_NOMINA = { colNombre: columna("B"), colTarifa: columna("D"), colDiaInicio: columna("E"), colDiaFin: columna("AI") };
const MATRIZ_IMSS = MATRIZ_NOMINA;
const MATRIZ_DESGASTE = { colNombre: columna("A"), colTarifa: columna("B"), colDiaInicio: columna("C"), colDiaFin: columna("AG") };

function leerNomina(libro: Workbook, avisos: string[]): PersonaExtraida[] {
  const salarios = conHoja(libro, "Nomina", avisos, (h) => leerMatrizDias(h, MATRIZ_NOMINA)) ?? [];
  const imss = conHoja(libro, "Imss", avisos, (h) => leerMatrizDias(h, MATRIZ_IMSS)) ?? [];
  const desgaste = conHoja(libro, "Desgaste de Equipo", avisos, (h) => leerMatrizDias(h, MATRIZ_DESGASTE)) ?? [];
  const bonos = conHoja(libro, "Bonos", avisos, leerBonos) ?? [];

  const porNombre = <T extends { nombre: string }>(lista: T[]) =>
    new Map(lista.map((r) => [normalizar(r.nombre), r]));
  const mapaImss = porNombre(imss);
  const mapaDesgaste = porNombre(desgaste);
  const mapaBonos = new Map<string, number>();
  for (const b of bonos) {
    const clave = normalizar(b.nombre);
    mapaBonos.set(clave, (mapaBonos.get(clave) ?? 0) + b.costo);
  }

  const personas = salarios
    .filter((r) => r.dias > 0)
    .map((r): PersonaExtraida => {
      const clave = normalizar(r.nombre);
      const filaImss = mapaImss.get(clave);
      const filaDesgaste = mapaDesgaste.get(clave);
      if (filaImss && filaImss.dias > 0 && filaImss.dias !== r.dias) {
        avisos.push(`${r.nombre}: ${r.dias} días de nómina pero ${filaImss.dias} de IMSS; se prorrateó el IMSS.`);
      }
      if (filaDesgaste && filaDesgaste.dias > 0 && filaDesgaste.dias !== r.dias) {
        avisos.push(`${r.nombre}: ${r.dias} días de nómina pero ${filaDesgaste.dias} de desgaste; se prorrateó.`);
      }
      const bono = mapaBonos.get(clave) ?? 0;
      mapaBonos.delete(clave);
      // Las tarifas no se redondean: la cadena se calcula con precisión completa y
      // sólo se redondea al presentar (regla del motor).
      return {
        nombre: r.nombre,
        dias: r.dias,
        salarioDiario: r.total / r.dias,
        imssDiario: filaImss && filaImss.dias > 0 ? filaImss.total / r.dias : 0,
        desgasteDiario: filaDesgaste && filaDesgaste.dias > 0 ? filaDesgaste.total / r.dias : 0,
        bono,
      };
    });

  // Quien tiene días de IMSS o desgaste pero no de nómina: su dinero no se pierde,
  // queda como renglón aparte (sin salario) para que el revisor decida.
  const nombres = new Set(personas.map((p) => normalizar(p.nombre)));
  const huerfanos = new Map<string, PersonaExtraida>();
  for (const [origen, filas] of [["IMSS", imss], ["desgaste", desgaste]] as const) {
    for (const fila of filas) {
      const clave = normalizar(fila.nombre);
      if (fila.dias === 0 || nombres.has(clave)) continue;
      const actual = huerfanos.get(clave) ?? {
        nombre: fila.nombre, dias: fila.dias, salarioDiario: 0, imssDiario: 0, desgasteDiario: 0,
        bono: mapaBonos.get(clave) ?? 0,
      };
      mapaBonos.delete(clave);
      const dias = Math.max(actual.dias, fila.dias);
      huerfanos.set(clave, {
        ...actual,
        dias,
        imssDiario: origen === "IMSS" ? fila.total / dias : (actual.imssDiario * actual.dias) / dias,
        desgasteDiario: origen === "desgaste" ? fila.total / dias : (actual.desgasteDiario * actual.dias) / dias,
      });
      avisos.push(`${fila.nombre} tiene ${fila.dias} días de ${origen} pero no de nómina; quedó como renglón aparte sin salario.`);
    }
  }

  // Bonos a nombres que no están en la nómina: se conservan como renglón sin días.
  const sueltos = [...mapaBonos.entries()]
    .filter(([, monto]) => monto > 0)
    .map(([clave, monto]): PersonaExtraida => {
      const original = bonos.find((b) => normalizar(b.nombre) === clave)?.nombre ?? clave;
      avisos.push(`El bono de «${original}» no coincide con nadie en la nómina; quedó como renglón aparte.`);
      return { nombre: original, dias: 0, salarioDiario: 0, imssDiario: 0, desgasteDiario: 0, bono: monto };
    });

  return [...personas, ...huerfanos.values(), ...sueltos];
}

// ── Avisos de cierre ────────────────────────────────────────────────────────

function avisosGenerales(d: Omit<CosteoExtraido, "avisos">): string[] {
  const avisos: string[] = [];
  if (d.noCotizacion === null) avisos.push("No se encontró el número de cotización.");
  if (d.folio === null) avisos.push("No se encontró el folio de la hoja de levantamiento.");
  if (d.fecha === null) avisos.push("No se encontró la fecha de emisión; se usará la de hoy.");
  if (!d.planta) avisos.push("No se encontró el cliente (Planta).");
  if (!d.descripcion) avisos.push("No se encontró la descripción del proyecto.");
  if (d.precioVenta <= 0) avisos.push("El precio de venta es cero; captúralo antes de guardar.");
  if (d.nomina.length === 0) avisos.push("No hay nadie en la nómina del proyecto.");
  if (d.personal !== null && d.personal !== d.nomina.filter((p) => p.dias > 0).length) {
    avisos.push(`El encabezado dice ${d.personal} personas y la nómina trae ${d.nomina.filter((p) => p.dias > 0).length}.`);
  }
  const diasNomina = new Set(d.nomina.filter((p) => p.dias > 0).map((p) => p.dias));
  if (d.dias !== null && diasNomina.size === 1 && !diasNomina.has(d.dias)) {
    avisos.push(`El encabezado dice ${d.dias} días y la nómina trae ${[...diasNomina][0]}.`);
  }
  return avisos;
}

export function costeoVacio(avisos: string[]): CosteoExtraido {
  const conceptos = Object.fromEntries(CONCEPTOS.map((c) => [c, 0])) as Conceptos;
  return {
    noCotizacion: null, folio: null, descripcion: "", usuario: "", planta: "", vendedor: "",
    fecha: null, dias: null, personal: null, precioVenta: 0, isr: 0, autoriza: "",
    porcentajes: { ...PORCENTAJES_DEFAULT },
    conceptosPlan: { ...conceptos }, conceptosReal: { ...conceptos },
    gastoTotalExcel: 0, utilidadNetaExcel: 0,
    nomina: [], insumos: [], gastos: [], avisos,
  };
}
