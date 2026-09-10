import type { Fragmento, PaginaTexto } from "./tipos";

/** Fragmentos que comparten renglón, ordenados de izquierda a derecha. */
export interface Linea {
  pagina: number;
  /** Vertical dentro de la página. */
  y: number;
  /** Vertical acumulada a lo largo del documento, para comparar entre páginas. */
  yAbs: number;
  fragmentos: Fragmento[];
  texto: string;
}

/** Dos fragmentos a menos de esta distancia vertical están en el mismo renglón. */
const TOLERANCIA_RENGLON = 2;

/** Agrupa los fragmentos de todas las páginas en renglones, de arriba abajo. */
export function agruparLineas(paginas: PaginaTexto[]): Linea[] {
  let desplazamiento = 0;
  return paginas.flatMap((pagina) => {
    const lineas = agruparPagina(pagina, desplazamiento);
    desplazamiento += pagina.alto;
    return lineas;
  });
}

function agruparPagina(pagina: PaginaTexto, desplazamiento: number): Linea[] {
  const ordenados = [...pagina.fragmentos].sort((a, b) => a.y - b.y || a.x - b.x);
  const grupos = ordenados.reduce<Fragmento[][]>((acumulado, fragmento) => {
    const ultimo = acumulado[acumulado.length - 1];
    if (ultimo && Math.abs(ultimo[0].y - fragmento.y) <= TOLERANCIA_RENGLON) {
      return [...acumulado.slice(0, -1), [...ultimo, fragmento]];
    }
    return [...acumulado, [fragmento]];
  }, []);

  return grupos.map((grupo) => {
    const fragmentos = [...grupo].sort((a, b) => a.x - b.x);
    return {
      pagina: pagina.numero,
      y: grupo[0].y,
      yAbs: grupo[0].y + desplazamiento,
      fragmentos,
      texto: fragmentos.map((f) => f.texto).join(" "),
    };
  });
}

/** Mayúsculas sin acentos ni espacios repetidos: para comparar etiquetas, no para guardar. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function centro(fragmento: Fragmento): number {
  return fragmento.x + fragmento.ancho / 2;
}

/** Un valor centrado en su celda queda a unas unidades de su columna; más lejos no es de ninguna. */
export const HOLGURA_ASIGNACION = 30;

/** Índice de la columna cuyo centro queda más cerca del fragmento, o -1 si ninguna está a su alcance. */
export function columnaMasCercana(
  fragmento: Fragmento,
  centros: number[],
  holgura = HOLGURA_ASIGNACION,
): number {
  if (centros.length === 0) return -1;
  const c = centro(fragmento);
  const mejor = centros.reduce(
    (indice, actual, i) => (Math.abs(actual - c) < Math.abs(centros[indice] - c) ? i : indice),
    0,
  );
  return Math.abs(centros[mejor] - c) <= holgura ? mejor : -1;
}

/** "1,250.50" → 1250.5; lo que no sea número → 0. */
export function numero(texto: string | undefined): number {
  const valor = Number.parseFloat((texto ?? "").replace(/,/g, ""));
  return Number.isFinite(valor) ? valor : 0;
}

/** "4" → 4; "-" o vacío → 0. */
export function entero(texto: string | undefined): number {
  const valor = Number.parseInt((texto ?? "").replace(/,/g, ""), 10);
  return Number.isFinite(valor) ? valor : 0;
}

/** "SÍ", "Sí", "SI" → true; lo demás → false. */
export function esSi(texto: string | undefined): boolean {
  return normalizar(texto ?? "") === "SI";
}
