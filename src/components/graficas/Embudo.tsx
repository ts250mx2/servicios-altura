import { formatoNumero } from "@/lib/formato";

/** Embudo horizontal: cada etapa como barra proporcional a la primera. */
export function Embudo({ etapas }: { etapas: { etapa: string; valor: number }[] }) {
  const base = Math.max(1, etapas[0]?.valor ?? 1);
  return (
    <ul className="space-y-2.5">
      {etapas.map((e, i) => {
        const ancho = e.valor === 0 ? 0 : Math.max(2, (e.valor / base) * 100);
        const conversion = i === 0 ? 100 : ((e.valor / base) * 100);
        return (
          <li key={e.etapa}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-tinta-2">{e.etapa}</span>
              <span className="num-tab text-tinta">
                {formatoNumero(e.valor, 0)}
                <span className="ml-2 text-tinta-3">{conversion.toFixed(0)} %</span>
              </span>
            </div>
            <div className="h-2 rounded-sm bg-superficie-2">
              <div className="h-full rounded-sm bg-acento" style={{ width: `${ancho}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
