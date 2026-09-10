import type { Worksheet } from "exceljs";
import { normalizar } from "../lineas";
import { MAX_FILAS_BUSQUEDA, columna, fecha, filaConEtiqueta, numero, texto } from "./celdas";
import type { GastoExtraido, InsumoExtraido } from "./tipos";

/** Un renglón de una matriz persona × día (hojas Nomina, Imss, Desgaste de Equipo). */
export interface FilaMatriz {
  nombre: string;
  /** Tarifa diaria escrita en la hoja (columna "SALARIO DIARIO", "IMSS DIARIO" o "COSTO DIA"). */
  tarifa: number;
  /** Días con importe capturado. */
  dias: number;
  total: number;
}

export interface ConfigMatriz {
  colNombre: number;
  colTarifa: number;
  colDiaInicio: number;
  colDiaFin: number;
}

/** Cuántas filas seguidas sin nombre cierran una tabla. */
const FILAS_VACIAS_PARA_CERRAR = 2;

/**
 * Lee la matriz: encabezado en la fila con "TRABAJADOR", y debajo una fila por
 * persona con su importe en cada día trabajado. Las plazas de plantilla sin
 * días ("TECNICO 7") salen con `dias: 0`; quien llama decide si las ignora.
 */
export function leerMatrizDias(hoja: Worksheet, cfg: ConfigMatriz): [FilaMatriz[], string[]] {
  const encabezado = filaConEtiqueta(hoja, cfg.colNombre, "TRABAJADOR", 1, 15);
  if (encabezado < 0) return [[], [`La hoja «${hoja.name}» no tiene la columna TRABAJADOR.`]];

  const filas: FilaMatriz[] = [];
  let vacias = 0;
  for (let fila = encabezado + 1; fila <= MAX_FILAS_BUSQUEDA && vacias < FILAS_VACIAS_PARA_CERRAR; fila++) {
    const nombre = texto(hoja, fila, cfg.colNombre);
    if (!nombre || normalizar(nombre) === "TOTAL") {
      vacias += 1;
      continue;
    }
    vacias = 0;
    let dias = 0;
    let total = 0;
    for (let col = cfg.colDiaInicio; col <= cfg.colDiaFin; col++) {
      const importe = numero(hoja, fila, col);
      if (importe !== null && importe > 0) {
        dias += 1;
        total += importe;
      }
    }
    filas.push({ nombre, tarifa: numero(hoja, fila, cfg.colTarifa) ?? 0, dias, total });
  }
  return [filas, []];
}

/** Hoja Bonos: NO · CONCEPTO (persona) · UNIDADES · COSTO. */
export function leerBonos(hoja: Worksheet): [{ nombre: string; costo: number }[], string[]] {
  const encabezado = filaConEtiqueta(hoja, columna("B"), "CONCEPTO", 1, 15);
  if (encabezado < 0) return [[], ["La hoja «Bonos» no tiene la columna CONCEPTO."]];
  const bonos: { nombre: string; costo: number }[] = [];
  for (let fila = encabezado + 1; fila <= MAX_FILAS_BUSQUEDA; fila++) {
    if (numero(hoja, fila, columna("A")) === null) break; // se acabó la numeración
    const nombre = texto(hoja, fila, columna("B"));
    const costo = numero(hoja, fila, columna("D")) ?? 0;
    if (nombre && costo > 0) bonos.push({ nombre, costo });
  }
  return [bonos, []];
}

/** Hoja Insumos: NO · CONCEPTO · UNIDADES · COSTO PLAN · COSTO REAL · FECHA · COMENTARIOS. */
export function leerInsumos(hoja: Worksheet): [InsumoExtraido[], string[]] {
  const encabezado = filaConEtiqueta(hoja, columna("B"), "CONCEPTO", 1, 15);
  if (encabezado < 0) return [[], ["La hoja «Insumos» no tiene la columna CONCEPTO."]];
  const insumos: InsumoExtraido[] = [];
  for (let fila = encabezado + 1; fila <= MAX_FILAS_BUSQUEDA; fila++) {
    if (numero(hoja, fila, columna("A")) === null) break;
    const descripcion = texto(hoja, fila, columna("B"));
    if (!descripcion) continue;
    const comentario = texto(hoja, fila, columna("G"));
    insumos.push({
      descripcion,
      unidades: numero(hoja, fila, columna("C")) ?? 0,
      costoPlan: numero(hoja, fila, columna("D")) ?? 0,
      costoReal: numero(hoja, fila, columna("E")) ?? 0,
      fecha: fecha(hoja, fila, columna("F")),
      comentario,
      aplica: !normalizar(comentario).includes("NO APLICA"),
    });
  }
  return [insumos, []];
}

/** Hoja Gasolina: NO · FECHA · CANTIDAD · RUTAS. */
export function leerGasolina(hoja: Worksheet): [GastoExtraido[], string[]] {
  const encabezado = filaConEtiqueta(hoja, columna("C"), "CANTIDAD", 1, 15);
  if (encabezado < 0) return [[], ["La hoja «Gasolina» no tiene la columna CANTIDAD."]];
  const gastos: GastoExtraido[] = [];
  for (let fila = encabezado + 1; fila <= MAX_FILAS_BUSQUEDA; fila++) {
    if (numero(hoja, fila, columna("A")) === null) break;
    const cantidad = numero(hoja, fila, columna("C")) ?? 0;
    if (cantidad <= 0) continue;
    gastos.push({
      concepto: "GASOLINA",
      fecha: fecha(hoja, fila, columna("B")),
      descripcion: texto(hoja, fila, columna("D")),
      cantidad,
    });
  }
  return [gastos, avisoContraPresupuesto(hoja, "Gasolina", columna("C"), gastos)];
}

/**
 * Hojas Administrativos, Epp y Compra de Equipo: FECHA · CANTIDAD hasta la fila TOTAL.
 * Si no hay renglones pero sí PRESUPUESTO, ese presupuesto se toma como el único renglón.
 */
export function leerGastosConFecha(
  hoja: Worksheet,
  concepto: GastoExtraido["concepto"],
): [GastoExtraido[], string[]] {
  const encabezado = filaConEtiqueta(hoja, columna("A"), "FECHA", 1, 15);
  if (encabezado < 0) return [[], [`La hoja «${hoja.name}» no tiene la columna FECHA.`]];
  const gastos: GastoExtraido[] = [];
  for (let fila = encabezado + 1; fila <= MAX_FILAS_BUSQUEDA; fila++) {
    if (normalizar(texto(hoja, fila, columna("A"))) === "TOTAL") break;
    const cantidad = numero(hoja, fila, columna("B")) ?? 0;
    if (cantidad <= 0) continue;
    gastos.push({ concepto, fecha: fecha(hoja, fila, columna("A")), descripcion: "", cantidad });
  }
  const presupuesto = presupuestoDe(hoja, columna("B"));
  if (gastos.length === 0 && presupuesto > 0) {
    return [[{ concepto, fecha: null, descripcion: "Presupuesto", cantidad: presupuesto }], []];
  }
  return [gastos, avisoContraPresupuesto(hoja, hoja.name, columna("B"), gastos)];
}

/** La celda junto a "PRESUPUESTO" en las primeras filas. */
function presupuestoDe(hoja: Worksheet, col: number): number {
  const fila = filaConEtiqueta(hoja, columna("A"), "PRESUPUESTO", 1, 5);
  return fila < 0 ? 0 : (numero(hoja, fila, col) ?? 0);
}

function avisoContraPresupuesto(hoja: Worksheet, nombre: string, col: number, gastos: GastoExtraido[]): string[] {
  const presupuesto = presupuestoDe(hoja, col);
  const suma = gastos.reduce((s, g) => s + g.cantidad, 0);
  if (presupuesto > 0 && Math.abs(presupuesto - suma) > 0.5) {
    return [`${nombre}: el presupuesto dice ${presupuesto} pero los renglones suman ${suma}; se usan los renglones.`];
  }
  return [];
}
