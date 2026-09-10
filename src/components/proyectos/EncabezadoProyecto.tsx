import Link from "next/link";
import { ClipboardList, FileText, Wallet, type LucideIcon } from "lucide-react";
import { ChipMargen, ChipStatus } from "@/components/ui/Chip";
import type { CadenaProyecto } from "@/lib/consultas/proyectos";
import { formatoMoneda } from "@/lib/formato";
import { cn } from "@/lib/utils";

type Cara = "levantamiento" | "cotizacion" | "costeo";

/**
 * Las tres caras del proyecto en una sola tira: dónde estás, qué ya existe y a
 * dónde ir. Se pinta arriba de las tres fichas para que nadie se pierda.
 */
export function EncabezadoProyecto({ cadena, actual }: { cadena: CadenaProyecto; actual: Cara }) {
  const { levantamiento: lev, cotizacion: cot, costeo } = cadena;
  return (
    <div className="mb-4 rounded-lg border border-borde bg-superficie p-3">
      <p className="etiqueta mb-2">Un proyecto, tres caras: qué se hace → qué se cobra → qué deja</p>
      <ol className="grid gap-2 md:grid-cols-3">
        <Paso
          icono={ClipboardList}
          activo={actual === "levantamiento"}
          titulo="Levantamiento"
          subtitulo={lev ? `Folio ${lev.folio}` : "Sin hoja de levantamiento"}
          href={lev ? `/dashboard/levantamientos/${lev.id}` : null}
          detalle={lev ? <ChipStatus status={lev.status} /> : <span className="text-xs text-tinta-3">Se puede importar el PDF después</span>}
        />
        <Paso
          icono={FileText}
          activo={actual === "cotizacion"}
          titulo="Cotización"
          subtitulo={cot ? `No. ${cot.no} · ${formatoMoneda(cot.subtotal)}` : "Todavía sin precio"}
          href={cot ? `/dashboard/cotizaciones/${cot.id}` : lev ? `/dashboard/levantamientos/${lev.id}/editar?paso=3` : null}
          detalle={cot ? <ChipStatus status={cot.status} /> : <span className="text-xs text-acento">Generar cotización →</span>}
        />
        <Paso
          icono={Wallet}
          activo={actual === "costeo"}
          titulo="Costeo"
          subtitulo={costeo ? "Plan contra real" : "Se genera junto con la cotización"}
          href={costeo ? `/dashboard/costeos/${costeo.id}` : null}
          detalle={
            costeo ? (
              <span className="flex items-center gap-2">
                <ChipStatus status={costeo.status} />
                <ChipMargen margen={costeo.margenPlan} />
              </span>
            ) : null
          }
        />
      </ol>
    </div>
  );
}

function Paso({
  icono: Icono, activo, titulo, subtitulo, href, detalle,
}: {
  icono: LucideIcon; activo: boolean; titulo: string; subtitulo: string; href: string | null; detalle: React.ReactNode;
}) {
  const contenido = (
    <div className={cn(
      "flex h-full items-start gap-3 rounded border px-3 py-2.5 transition-colors duration-150",
      activo ? "border-acento bg-superficie-2" : href ? "border-borde hover:border-borde-fuerte hover:bg-superficie-2" : "border-borde/60 opacity-70",
    )}>
      <Icono size={18} className={activo ? "mt-0.5 text-acento" : "mt-0.5 text-tinta-3"} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs font-semibold tracking-wide uppercase", activo ? "text-acento" : "text-tinta-2")}>{titulo}</p>
        <p className="truncate text-sm text-tinta">{subtitulo}</p>
        {detalle && <div className="mt-1.5">{detalle}</div>}
      </div>
    </div>
  );
  return <li>{href && !activo ? <Link href={href} className="block h-full">{contenido}</Link> : contenido}</li>;
}
