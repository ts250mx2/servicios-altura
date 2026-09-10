const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MXN_CORTO = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export function formatoMoneda(valor: number | null | undefined): string {
  return MXN.format(Number(valor ?? 0));
}

/** Para KPIs y ejes: $130,800 sin centavos. */
export function formatoMonedaCorta(valor: number | null | undefined): string {
  const n = Number(valor ?? 0);
  if (Math.abs(n) >= 1_000_000) return `$${NUM.format(n / 1_000_000)} M`;
  if (Math.abs(n) >= 10_000) return `$${NUM.format(Math.round(n / 1000))} k`;
  return MXN_CORTO.format(n);
}

export function formatoNumero(valor: number | null | undefined, decimales = 2): string {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  }).format(Number(valor ?? 0));
}

export function formatoPorcentaje(valor: number | null | undefined, decimales = 1): string {
  return `${formatoNumero(valor, decimales)} %`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** dd mmm yyyy — el formato de fecha de toda la aplicación. */
export function formatoFecha(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const f = typeof valor === "string" ? new Date(`${valor.slice(0, 10)}T12:00:00`) : valor;
  if (Number.isNaN(f.getTime())) return "—";
  return `${String(f.getDate()).padStart(2, "0")} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
}

export function formatoFechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const f = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(f.getTime())) return "—";
  const hh = String(f.getHours()).padStart(2, "0");
  const mm = String(f.getMinutes()).padStart(2, "0");
  return `${formatoFecha(f)} ${hh}:${mm}`;
}

/** Redondeo a centavos, para que la cadena de costeo no arrastre flotantes. */
export function centavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
