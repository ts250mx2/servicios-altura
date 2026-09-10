import { centro, columnaMasCercana, entero, esSi, normalizar, numero, type Linea } from "./lineas";
import type { LevantamientoExtraido } from "./tipos";

type Personal = LevantamientoExtraido["personal"][number];
type Partida = LevantamientoExtraido["insumos"][number];
type NivelRiesgo = LevantamientoExtraido["nivelRiesgo"];

/** Holgura para decidir si un fragmento cae en una columna. */
const HOLGURA_COLUMNA = 5;
/** Si falta el encabezado "DESCRIPCIÓN", la columna de cantidad termina aquí. */
const X_DESCRIPCION_DEFAULT = 140;
/** Alto de la banda del encabezado de la tabla de días (tres renglones apretados). */
export const BANDA_ENCABEZADO_DIAS = 8;

// ── Cantidad de personal ────────────────────────────────────────────────────

type FilaPersonal = "CANTIDAD" | "TEXTRA" | "BONO";

/**
 * Tabla con un puesto por columna y tres filas (CANTIDAD, T.EXTRA, BONO). La
 * última columna, NIVEL RIESGO, es una celda que abarca las tres filas y va
 * centrada, por eso se decide por columna y no por orden de lectura.
 */
export function leerPersonal(
  lineas: Linea[],
): [{ personal: Personal[]; nivelRiesgo: NivelRiesgo }, string[]] {
  const encabezado = lineas.find(
    (l) => normalizar(l.fragmentos[0].texto) === "DESCRIPCION" && l.fragmentos.length > 2,
  );
  if (!encabezado) {
    const avisos = lineas.length > 0 ? ["No se reconoció la tabla de personal."] : [];
    return [{ personal: [], nivelRiesgo: null }, avisos];
  }

  const columnas = encabezado.fragmentos.slice(1).map((f) => ({
    etiqueta: f.texto,
    centro: centro(f),
    esRiesgo: normalizar(f.texto).startsWith("NIVEL"),
  }));
  const centros = columnas.map((c) => c.centro);
  const celdas: Record<FilaPersonal, (string | undefined)[]> = { CANTIDAD: [], TEXTRA: [], BONO: [] };
  const fueraDeColumna: string[] = [];
  let riesgo: string | null = null;

  for (const linea of lineas) {
    if (linea === encabezado) continue;
    const fila = claveFila(linea.fragmentos[0].texto);
    const valores = fila ? linea.fragmentos.slice(1) : linea.fragmentos;
    for (const f of valores) {
      const indice = columnaMasCercana(f, centros);
      if (indice < 0) fueraDeColumna.push(f.texto);
      else if (columnas[indice].esRiesgo) riesgo = normalizar(f.texto);
      else if (fila) celdas[fila][indice] = f.texto;
    }
  }

  const personal = columnas.flatMap((c, i): Personal[] =>
    c.esRiesgo
      ? []
      : [{
          puesto: c.etiqueta,
          cantidad: entero(celdas.CANTIDAD[i]),
          tiempoExtra: esSi(celdas.TEXTRA[i]),
          bono: esSi(celdas.BONO[i]),
        }],
  );
  const nivelRiesgo = riesgo === "ALTO" || riesgo === "MEDIO" || riesgo === "BAJO" ? riesgo : null;
  return [
    { personal, nivelRiesgo },
    [
      ...(nivelRiesgo ? [] : ["No se encontró el nivel de riesgo; se asume ALTO."]),
      ...fueraDeColumna.map((texto) => `En la tabla de personal hay un dato fuera de columna: «${texto}».`),
    ],
  ];
}

function claveFila(texto: string): FilaPersonal | null {
  const t = normalizar(texto);
  if (t.startsWith("CANTIDAD")) return "CANTIDAD";
  if (/^T\.? ?EXTRA/.test(t)) return "TEXTRA";
  if (t.startsWith("BONO")) return "BONO";
  return null;
}

// ── Insumos y herramental ───────────────────────────────────────────────────

/**
 * Tabla CANTIDAD / DESCRIPCIÓN. Una descripción larga se parte en renglones
 * sin cantidad, que se pegan al renglón anterior. Puede continuar en la página
 * siguiente, con o sin encabezado repetido.
 */
export function leerPartidas(lineas: Linea[], nombre: string): [Partida[], string[]] {
  if (lineas.length === 0) return [[], []];
  const encabezado = lineas.find(esEncabezadoPartidas);
  const xDescripcion =
    encabezado?.fragmentos.find((f) => normalizar(f.texto) === "DESCRIPCION")?.x ?? X_DESCRIPCION_DEFAULT;

  const partidas: Partida[] = [];
  const sueltos: string[] = [];
  for (const linea of lineas) {
    if (esEncabezadoPartidas(linea)) continue;
    const cantidad = linea.fragmentos
      .filter((f) => f.x < xDescripcion - HOLGURA_COLUMNA)
      .map((f) => f.texto)
      .join("");
    const descripcion = linea.fragmentos
      .filter((f) => f.x >= xDescripcion - HOLGURA_COLUMNA)
      .map((f) => f.texto)
      .join(" ");
    const ultima = partidas[partidas.length - 1];
    if (cantidad) partidas.push({ cantidad: numero(cantidad), descripcion });
    else if (ultima) partidas[partidas.length - 1] = { ...ultima, descripcion: `${ultima.descripcion} ${descripcion}`.trim() };
    else sueltos.push(descripcion);
  }

  return [
    partidas.filter((p) => p.descripcion),
    [
      ...(encabezado ? [] : [`No se encontró el encabezado CANTIDAD / DESCRIPCIÓN en ${nombre}.`]),
      ...sueltos.map((texto) => `Renglón suelto en ${nombre}: «${texto}».`),
    ],
  ];
}

function esEncabezadoPartidas(linea: Linea): boolean {
  const texto = normalizar(linea.texto);
  return texto.startsWith("CANTIDAD") && texto.includes("DESCRIPCION");
}

// ── Días de trabajo ─────────────────────────────────────────────────────────

export interface DiasTrabajo {
  dias: number | null;
  trabajoNormal: boolean;
  trabajoExtra: boolean;
  aplicaCena: boolean;
  aplicaBono: boolean;
}

const DIAS_VACIO: DiasTrabajo = {
  dias: null, trabajoNormal: true, trabajoExtra: false, aplicaCena: false, aplicaBono: false,
};

/** Textos del encabezado que marcan una columna; "NORMAL" y "EXTRA" son segundos renglones. */
const ETIQUETAS_DIAS = new Set(["DIAS", "TRABAJO TIEMPO", "APLICA CENA", "APLICA BONO"]);
const COLUMNAS_DIAS = 5;

/**
 * Tabla de una sola fila: DÍAS · T. NORMAL · T. EXTRA · APLICA CENA · APLICA BONO.
 * El encabezado se parte en tres renglones, así que se toman los centros de las
 * cinco celdas y los valores se asignan por cercanía.
 */
export function leerDias(lineas: Linea[], inicio: number, fin: number): [DiasTrabajo, string[]] {
  if (inicio < 0) return [DIAS_VACIO, []];
  const yEncabezado = lineas[inicio].yAbs;
  const limite = fin > inicio ? fin : lineas.length;

  const centros = lineas
    .slice(0, limite)
    .filter((l) => Math.abs(l.yAbs - yEncabezado) <= BANDA_ENCABEZADO_DIAS)
    .flatMap((l) => l.fragmentos)
    .filter((f) => ETIQUETAS_DIAS.has(normalizar(f.texto)))
    .map(centro)
    .sort((a, b) => a - b);

  const valores = lineas
    .slice(inicio + 1, limite)
    .find((l) => l.yAbs > yEncabezado + BANDA_ENCABEZADO_DIAS && /^\d+$/.test(l.fragmentos[0].texto));
  if (!valores) return [DIAS_VACIO, ["No se encontraron los días de trabajo; se asume 1."]];

  const porColumna = centros.length === COLUMNAS_DIAS
    ? valores.fragmentos.reduce<(string | undefined)[]>((acumulado, f) => {
        const indice = columnaMasCercana(f, centros);
        if (indice < 0) return acumulado;
        const copia = [...acumulado];
        copia[indice] = f.texto;
        return copia;
      }, [])
    : valores.fragmentos.map((f) => f.texto);

  return [
    {
      dias: entero(porColumna[0]) || null,
      trabajoNormal: esSi(porColumna[1]),
      trabajoExtra: esSi(porColumna[2]),
      aplicaCena: esSi(porColumna[3]),
      aplicaBono: esSi(porColumna[4]),
    },
    centros.length === COLUMNAS_DIAS
      ? []
      : ["El encabezado de la tabla de días no es el esperado; revisa tiempo extra, cena y bono."],
  ];
}

// ── Firmas ──────────────────────────────────────────────────────────────────

export interface Firmas {
  elaboro: string;
  recibio: string;
  reviso: string;
}

/** Renglón ELABORÓ / RECIBIÓ / REVISÓ con los nombres centrados debajo de cada título. */
export function leerFirmas(lineas: Linea[], inicio: number): [Firmas, string[]] {
  if (inicio < 0) return [{ elaboro: "", recibio: "", reviso: "" }, []];
  const encabezado = lineas[inicio];
  const columnas = encabezado.fragmentos.map((f) => ({ campo: campoFirma(f.texto), centro: centro(f) }));
  const centros = columnas.map((c) => c.centro);

  const nombres: Record<keyof Firmas, string[]> = { elaboro: [], recibio: [], reviso: [] };
  for (const linea of lineas.slice(inicio + 1)) {
    if (linea.pagina !== encabezado.pagina) break;
    for (const f of linea.fragmentos) {
      const indice = columnaMasCercana(f, centros);
      const campo = indice < 0 ? null : columnas[indice].campo;
      if (campo) nombres[campo] = [...nombres[campo], f.texto];
    }
  }

  return [
    {
      elaboro: nombres.elaboro.join(" "),
      recibio: nombres.recibio.join(" "),
      reviso: nombres.reviso.join(" "),
    },
    [],
  ];
}

function campoFirma(texto: string): keyof Firmas | null {
  const t = normalizar(texto);
  if (t.startsWith("ELABORO")) return "elaboro";
  if (t.startsWith("RECIBIO")) return "recibio";
  if (t.startsWith("REVISO")) return "reviso";
  return null;
}
