import { cn } from "@/lib/utils";

type Tono = "neutro" | "bueno" | "alerta" | "serio" | "critico" | "acento";

const TONOS: Record<Tono, string> = {
  neutro: "border-borde-fuerte text-tinta-2",
  bueno: "border-bueno/40 text-bueno",
  alerta: "border-alerta/40 text-alerta",
  serio: "border-serio/40 text-serio",
  critico: "border-critico/40 text-critico",
  acento: "border-acento bg-acento text-sobre-acento",
};

export function Chip({ children, tono = "neutro", className }: {
  children: React.ReactNode; tono?: Tono; className?: string;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
      TONOS[tono], className,
    )}>
      {children}
    </span>
  );
}

const TONO_STATUS: Record<string, Tono> = {
  BORRADOR: "neutro", CERRADO: "acento", COTIZADO: "bueno", CANCELADO: "critico",
  ENVIADA: "alerta", AUTORIZADA: "bueno", RECHAZADA: "critico", CANCELADA: "critico",
  PLANEADO: "neutro", EN_PROCESO: "alerta",
  PENDIENTE: "neutro", REVISION: "alerta", APLICADA: "bueno", ERROR: "critico",
};

const ETIQUETA_STATUS: Record<string, string> = {
  EN_PROCESO: "En proceso",
  REVISION: "En revisión",
};

export function ChipStatus({ status }: { status: string }) {
  const texto = ETIQUETA_STATUS[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  return <Chip tono={TONO_STATUS[status] ?? "neutro"}>{texto}</Chip>;
}

export function ChipRiesgo({ nivel }: { nivel: string }) {
  const tono: Tono = nivel === "ALTO" ? "critico" : nivel === "MEDIO" ? "serio" : "neutro";
  return <Chip tono={tono}>Riesgo {nivel.toLowerCase()}</Chip>;
}

/** El semáforo de margen: verde ≥ 45 %, ámbar 30-45 %, rojo < 30 %. */
export function ChipMargen({ margen }: { margen: number | null | undefined }) {
  if (margen === null || margen === undefined) return <span className="text-tinta-3">—</span>;
  const n = Number(margen);
  const tono: Tono = n >= 45 ? "bueno" : n >= 30 ? "alerta" : "critico";
  return <Chip tono={tono}>{n.toFixed(1)} %</Chip>;
}
