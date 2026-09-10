export type Periodo = "mes" | "trimestre" | "anio" | "12meses" | "todo";

export interface RangoFechas {
  desde: string;
  hasta: string;
  desdeAnterior: string;
  hastaAnterior: string;
  etiqueta: string;
}

function iso(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

/** Rango del periodo y su comparable inmediato anterior. */
export function rangoPeriodo(periodo: Periodo, hoy = new Date()): RangoFechas {
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let inicio: Date;
  let etiqueta: string;

  switch (periodo) {
    case "mes":
      inicio = new Date(fin.getFullYear(), fin.getMonth(), 1);
      etiqueta = "Este mes";
      break;
    case "trimestre":
      inicio = new Date(fin.getFullYear(), fin.getMonth() - 2, 1);
      etiqueta = "Últimos 3 meses";
      break;
    case "anio":
      inicio = new Date(fin.getFullYear(), 0, 1);
      etiqueta = "Este año";
      break;
    case "12meses":
      inicio = new Date(fin.getFullYear() - 1, fin.getMonth() + 1, 1);
      etiqueta = "Últimos 12 meses";
      break;
    default:
      inicio = new Date(2000, 0, 1);
      etiqueta = "Histórico";
  }

  const dias = Math.round((fin.getTime() - inicio.getTime()) / 86_400_000) + 1;
  const finAnterior = new Date(inicio.getTime() - 86_400_000);
  const inicioAnterior = new Date(finAnterior.getTime() - (dias - 1) * 86_400_000);

  return {
    desde: iso(inicio),
    hasta: iso(fin),
    desdeAnterior: iso(inicioAnterior),
    hastaAnterior: iso(finAnterior),
    etiqueta,
  };
}

/** Los N días consecutivos de un proyecto a partir de una fecha. */
export function diasDelProyecto(fechaInicio: string, dias: number): string[] {
  const base = new Date(`${fechaInicio.slice(0, 10)}T12:00:00`);
  return Array.from({ length: Math.max(0, dias) }, (_, i) => {
    const f = new Date(base);
    f.setDate(base.getDate() + i);
    return iso(f);
  });
}

export function hoyIso(): string {
  return iso(new Date());
}
