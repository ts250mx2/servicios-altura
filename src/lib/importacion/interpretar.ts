import { agruparLineas, normalizar, numero, type Linea } from "./lineas";
import { BANDA_ENCABEZADO_DIAS, leerDias, leerFirmas, leerPartidas, leerPersonal } from "./tablas";
import type { Fragmento, LevantamientoExtraido, PaginaTexto } from "./tipos";

type Actividad = LevantamientoExtraido["actividades"][number];

/** Títulos de sección de la plantilla, ya normalizados. */
const TITULOS = {
  trabajo: "TRABAJO A REALIZAR",
  observaciones: "OBSERVACIONES DEL TRABAJO",
  personal: "CANTIDAD DE PERSONAL",
  insumos: "INSUMOS",
  herramental: "HERRAMENTAL",
} as const;
type Seccion = keyof typeof TITULOS;

/** Los títulos van centrados; nada del cuerpo de las tablas empieza tan a la derecha. */
const X_MINIMO_TITULO = 200;
/** La celda "DÍAS" abre la tabla final y va pegada al margen izquierdo. */
const X_MAXIMO_DIAS = 120;
/** Holgura para decidir si un fragmento cae en una columna. */
const HOLGURA_COLUMNA = 5;
/** Media línea: cuánto puede alejarse el centro de una fila de su celda de metros. */
const HOLGURA_FILA = 6;
/** Si falta el encabezado "METROS", la columna se asume aquí (hoja carta). */
const X_METROS_DEFAULT = 480;

interface Secciones {
  titulos: Record<Seccion, number>;
  /** Renglón con la celda "DÍAS". */
  dias: number;
  /** Primer renglón del encabezado de días ("TRABAJO TIEMPO" va un poco más arriba que "DÍAS"). */
  inicioDias: number;
  firmas: number;
}

type CampoEncabezado =
  | "noCotizacion" | "folio" | "fecha" | "proyecto" | "areaTrabajo"
  | "cliente" | "correoUsuario" | "usuarioContacto" | "responsable";

/** Etiquetas del encabezado; "CORREO USUARIO" va antes que "USUARIO" a propósito. */
const ETIQUETAS: [CampoEncabezado, RegExp][] = [
  ["noCotizacion", /^NO\.? ?COTIZACION\b/],
  ["folio", /^FOLIO\b/],
  ["fecha", /^FECHA\b/],
  ["proyecto", /^PROYECTO\b/],
  ["areaTrabajo", /^AREA DE TRABAJO\b/],
  ["cliente", /^CLIENTE\b/],
  ["correoUsuario", /^CORREO USUARIO\b/],
  ["usuarioContacto", /^USUARIO\b/],
  ["responsable", /^RESPONSABLE\b/],
];

/**
 * Convierte el texto posicionado de la hoja de levantamiento en datos.
 * Es una función pura: no toca base de datos ni archivos.
 */
export function interpretarLevantamiento(paginas: PaginaTexto[]): LevantamientoExtraido {
  const lineas = agruparLineas(paginas);
  if (lineas.length === 0) {
    return levantamientoVacio(["El PDF no tiene texto legible; puede ser un escaneo."]);
  }

  const secciones = ubicarSecciones(lineas);
  const encabezado = leerEncabezado(fragmentosEncabezado(lineas, secciones.titulos.trabajo));
  const [actividades, avisosActividades] = leerActividades(seccion(lineas, secciones, "trabajo"));
  const observaciones = seccion(lineas, secciones, "observaciones").map((l) => l.texto).join("\n");
  const [{ personal, nivelRiesgo }, avisosPersonal] = leerPersonal(seccion(lineas, secciones, "personal"));
  const [insumos, avisosInsumos] = leerPartidas(seccion(lineas, secciones, "insumos"), "insumos");
  const [herramental, avisosHerramental] = leerPartidas(seccion(lineas, secciones, "herramental"), "herramental");
  const [dias, avisosDias] = leerDias(lineas, secciones.dias, secciones.firmas);
  const [firmas, avisosFirmas] = leerFirmas(lineas, secciones.firmas);

  const datos = {
    noCotizacion: enteroONulo(encabezado.noCotizacion),
    folio: enteroONulo(encabezado.folio),
    fecha: fechaIso(encabezado.fecha),
    proyecto: encabezado.proyecto ?? "",
    areaTrabajo: encabezado.areaTrabajo ?? "",
    cliente: encabezado.cliente ?? "",
    usuarioContacto: encabezado.usuarioContacto ?? "",
    correoUsuario: encabezado.correoUsuario ?? "",
    responsable: encabezado.responsable ?? "",
    actividades,
    observaciones,
    personal,
    nivelRiesgo,
    insumos,
    herramental,
    ...dias,
    ...firmas,
  };

  return {
    ...datos,
    avisos: [
      ...avisosSecciones(secciones),
      ...avisosEncabezado(datos),
      ...avisosActividades,
      ...avisosPersonal,
      ...avisosInsumos,
      ...avisosHerramental,
      ...avisosDias,
      ...avisosFirmas,
    ],
  };
}

// ── Secciones ───────────────────────────────────────────────────────────────

function ubicarSecciones(lineas: Linea[]): Secciones {
  const titulos: Record<Seccion, number> = {
    trabajo: -1, observaciones: -1, personal: -1, insumos: -1, herramental: -1,
  };
  let dias = -1;
  let firmas = -1;

  lineas.forEach((linea, i) => {
    for (const clave of Object.keys(TITULOS) as Seccion[]) {
      if (titulos[clave] === -1 && esTitulo(linea, TITULOS[clave])) titulos[clave] = i;
    }
    if (dias === -1 && esEncabezadoDias(linea)) dias = i;
    if (firmas === -1 && normalizar(linea.texto).startsWith("ELABORO")) firmas = i;
  });

  return { titulos, dias, inicioDias: inicioBanda(lineas, dias), firmas };
}

/** Retrocede desde la celda "DÍAS" hasta el primer renglón de su misma banda. */
function inicioBanda(lineas: Linea[], indice: number): number {
  if (indice < 0) return -1;
  let inicio = indice;
  while (inicio > 0 && lineas[indice].yAbs - lineas[inicio - 1].yAbs <= BANDA_ENCABEZADO_DIAS) {
    inicio -= 1;
  }
  return inicio;
}

function esTitulo(linea: Linea, titulo: string): boolean {
  return (
    linea.fragmentos.length === 1 &&
    linea.fragmentos[0].x >= X_MINIMO_TITULO &&
    normalizar(linea.texto) === titulo
  );
}

function esEncabezadoDias(linea: Linea): boolean {
  const primero = linea.fragmentos[0];
  return (
    primero.x <= X_MAXIMO_DIAS &&
    normalizar(primero.texto) === "DIAS" &&
    normalizar(linea.texto).includes("APLICA")
  );
}

/** Renglones entre el título de una sección y el siguiente límite conocido. */
function seccion(lineas: Linea[], secciones: Secciones, clave: Seccion): Linea[] {
  const inicio = secciones.titulos[clave];
  if (inicio < 0) return [];
  const limites = [...Object.values(secciones.titulos), secciones.inicioDias, secciones.firmas]
    .filter((i) => i > inicio);
  const fin = limites.length > 0 ? Math.min(...limites) : lineas.length;
  return lineas.slice(inicio + 1, fin);
}

function avisosSecciones(secciones: Secciones): string[] {
  const faltantes = (Object.keys(TITULOS) as Seccion[])
    .filter((clave) => secciones.titulos[clave] < 0)
    .map((clave) => `No se encontró la sección «${TITULOS[clave]}».`);
  return [
    ...faltantes,
    ...(secciones.dias < 0 ? ["No se encontró la tabla de días de trabajo."] : []),
    ...(secciones.firmas < 0 ? ["No se encontró el renglón ELABORÓ / RECIBIÓ / REVISÓ."] : []),
  ];
}

// ── Encabezado ──────────────────────────────────────────────────────────────

/** Todo lo que está antes de "TRABAJO A REALIZAR"; si no hay título, la primera página. */
function fragmentosEncabezado(lineas: Linea[], finTrabajo: number): Fragmento[] {
  const cabecera = finTrabajo >= 0 ? lineas.slice(0, finTrabajo) : lineas.filter((l) => l.pagina === 1);
  return cabecera.flatMap((l) => l.fragmentos);
}

/**
 * El encabezado es una cuadrícula de tres columnas con celdas "ETIQUETA: valor"
 * cuyo valor se parte en varios renglones. Cada etiqueta abre un campo en su
 * columna (misma x) y los renglones siguientes de esa columna lo continúan.
 */
function leerEncabezado(fragmentos: Fragmento[]): Partial<Record<CampoEncabezado, string>> {
  const ordenados = [...fragmentos].sort((a, b) => a.y - b.y || a.x - b.x);
  const partes: Partial<Record<CampoEncabezado, string[]>> = {};
  let abiertos: { x: number; campo: CampoEncabezado }[] = [];

  for (const f of ordenados) {
    const etiqueta = ETIQUETAS.find(([, patron]) => patron.test(normalizar(f.texto)));
    if (etiqueta) {
      const [campo] = etiqueta;
      const dosPuntos = f.texto.indexOf(":");
      const valor = dosPuntos >= 0 ? f.texto.slice(dosPuntos + 1).trim() : "";
      partes[campo] = valor ? [valor] : [];
      abiertos = [
        ...abiertos.filter((a) => Math.abs(a.x - f.x) > HOLGURA_COLUMNA),
        { x: f.x, campo },
      ];
      continue;
    }
    const abierto = abiertos.find((a) => Math.abs(a.x - f.x) <= HOLGURA_COLUMNA);
    if (abierto) partes[abierto.campo] = [...(partes[abierto.campo] ?? []), f.texto];
  }

  // El correo se parte a media palabra; lo demás, entre palabras.
  return Object.fromEntries(
    Object.entries(partes).map(([campo, lista]) => [
      campo,
      lista.join(campo === "correoUsuario" ? "" : " "),
    ]),
  );
}

function enteroONulo(texto: string | undefined): number | null {
  const coincidencia = (texto ?? "").match(/\d+/);
  return coincidencia ? Number.parseInt(coincidencia[0], 10) : null;
}

/** "2026-08-26" o "26/08/2026" → "2026-08-26". */
function fechaIso(texto: string | undefined): string | null {
  if (!texto) return null;
  const iso = texto.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dma = texto.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dma) return `${dma[3]}-${dma[2].padStart(2, "0")}-${dma[1].padStart(2, "0")}`;
  return null;
}

function avisosEncabezado(datos: {
  folio: number | null; noCotizacion: number | null; fecha: string | null;
  cliente: string; proyecto: string; actividades: Actividad[];
  personal: { cantidad: number }[];
}): string[] {
  return [
    ...(datos.folio === null ? ["No se encontró el folio."] : []),
    ...(datos.noCotizacion === null ? ["No se encontró el número de cotización."] : []),
    ...(datos.fecha === null ? ["No se encontró la fecha; se usará la de hoy."] : []),
    ...(datos.cliente ? [] : ["No se encontró el cliente."]),
    ...(datos.proyecto ? [] : ["No se encontró la descripción del proyecto."]),
    ...(datos.actividades.length === 0 ? ["No se encontraron actividades."] : []),
    ...(datos.personal.every((p) => p.cantidad === 0) ? ["No se encontró personal asignado."] : []),
  ];
}

// ── Trabajo a realizar ──────────────────────────────────────────────────────

interface Renglon { y: number; texto: string }
interface CeldaMetros { y: number; valor: number }

function leerActividades(lineas: Linea[]): [Actividad[], string[]] {
  if (lineas.length === 0) return [[], []];
  const encabezado = lineas.find(esEncabezadoTrabajo);
  const xMetros =
    encabezado?.fragmentos.find((f) => normalizar(f.texto) === "METROS")?.x ?? X_METROS_DEFAULT;
  const avisos = encabezado
    ? []
    : ["No se encontró el encabezado DESCRIPCIÓN / METROS; revisa los metros de cada actividad."];

  const cuerpo = lineas.filter((l) => !esEncabezadoTrabajo(l));
  const renglones = cuerpo.flatMap((l): Renglon[] => {
    const texto = l.fragmentos
      .filter((f) => f.x < xMetros - HOLGURA_COLUMNA)
      .map((f) => f.texto)
      .join(" ");
    return texto ? [{ y: l.yAbs, texto }] : [];
  });
  const celdas = cuerpo.flatMap((l): CeldaMetros[] =>
    l.fragmentos
      .filter((f) => f.x >= xMetros - HOLGURA_COLUMNA)
      .map((f) => ({ y: l.yAbs, valor: numero(f.texto) })),
  );

  const { filas, sobrantes } = repartirFilas(renglones, celdas);
  const actividades = filas.map((fila) => ({ descripcion: fila.lineas.join(" "), metros: fila.metros }));
  if (sobrantes.length === 0) return [actividades, avisos];
  return [
    [...actividades, { descripcion: sobrantes.join(" "), metros: 0 }],
    [...avisos, "Hay texto de actividades sin celda de metros; revisa la última actividad."],
  ];
}

function esEncabezadoTrabajo(linea: Linea): boolean {
  const texto = normalizar(linea.texto);
  return texto.startsWith("DESCRIPCION") && texto.endsWith("METROS");
}

/**
 * Reparte los renglones de descripción entre las celdas de metros. mPDF centra
 * la celda verticalmente en su fila, así que la fila de una celda es el tramo
 * de renglones cuyo centro queda más cerca de ella. Con esto no importa que un
 * renglón termine en número ("…DE 1.10"): sólo cuenta lo que cae en la columna.
 */
function repartirFilas(
  renglones: Renglon[],
  celdas: CeldaMetros[],
): { filas: { lineas: string[]; metros: number }[]; sobrantes: string[] } {
  let inicio = 0;
  const filas = celdas
    .map((celda) => {
      const fin = finDeFila(renglones, inicio, celda.y);
      const fila = { lineas: renglones.slice(inicio, fin + 1).map((r) => r.texto), metros: celda.valor };
      inicio = fin + 1;
      return fila;
    })
    .filter((fila) => fila.lineas.length > 0);
  return { filas, sobrantes: renglones.slice(inicio).map((r) => r.texto) };
}

/** Índice del último renglón de la fila que empieza en `inicio` y tiene su centro en `yCelda`. */
function finDeFila(renglones: Renglon[], inicio: number, yCelda: number): number {
  if (inicio >= renglones.length) return inicio - 1;
  if (renglones[inicio].y > yCelda + HOLGURA_FILA) return inicio - 1; // celda sin texto
  let mejor = inicio;
  let mejorDistancia = Number.POSITIVE_INFINITY;
  for (let j = inicio; j < renglones.length; j++) {
    const centroFila = (renglones[inicio].y + renglones[j].y) / 2;
    const distancia = Math.abs(centroFila - yCelda);
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejor = j;
    }
    if (centroFila > yCelda + HOLGURA_FILA) break;
  }
  return mejor;
}

// ── Vacío ───────────────────────────────────────────────────────────────────

export function levantamientoVacio(avisos: string[]): LevantamientoExtraido {
  return {
    noCotizacion: null, folio: null, fecha: null,
    proyecto: "", areaTrabajo: "", cliente: "", usuarioContacto: "", correoUsuario: "", responsable: "",
    actividades: [], observaciones: "", personal: [], nivelRiesgo: null,
    insumos: [], herramental: [], dias: null,
    trabajoNormal: true, trabajoExtra: false, aplicaCena: false, aplicaBono: false,
    elaboro: "", recibio: "", reviso: "",
    avisos,
  };
}
