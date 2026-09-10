import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Kpi({
  etiqueta, valor, anterior, actual, sufijo, invertir,
}: {
  etiqueta: string;
  valor: string;
  /** Para calcular la variación contra el periodo anterior. */
  anterior?: number;
  actual?: number;
  sufijo?: string;
  /** true cuando bajar es bueno (por ejemplo, gasto). */
  invertir?: boolean;
}) {
  let variacion: number | null = null;
  if (anterior !== undefined && actual !== undefined && anterior !== 0) {
    variacion = ((actual - anterior) / Math.abs(anterior)) * 100;
  }
  const sube = variacion !== null && variacion > 0.5;
  const baja = variacion !== null && variacion < -0.5;
  const bueno = invertir ? baja : sube;

  return (
    <div className="rounded-lg border border-borde bg-superficie px-4 py-3.5">
      <p className="etiqueta">{etiqueta}</p>
      <p className="display mt-1.5 text-2xl leading-none text-tinta">
        {valor}
        {sufijo && <span className="ml-1 text-base text-tinta-2">{sufijo}</span>}
      </p>
      {variacion !== null && (
        <p className={cn(
          "mt-2 flex items-center gap-1 text-xs",
          !sube && !baja ? "text-tinta-3" : bueno ? "text-bueno" : "text-critico",
        )}>
          {sube ? <ArrowUpRight size={13} /> : baja ? <ArrowDownRight size={13} /> : <Minus size={13} />}
          {Math.abs(variacion).toFixed(1)} % vs. periodo anterior
        </p>
      )}
    </div>
  );
}
