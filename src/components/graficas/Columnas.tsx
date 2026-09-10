"use client";

import { useId, useState } from "react";
import { formatoMonedaCorta } from "@/lib/formato";

export interface SerieColumnas {
  nombre: string;
  color: string;
  valores: number[];
}

/**
 * Gráfica de columnas agrupadas en SVG propio, sin librerías.
 * Barras ≤ 24 px con punta redondeada, cuadrícula hairline, un solo eje.
 */
export function Columnas({
  etiquetas, series, alto = 220, formato = formatoMonedaCorta,
}: {
  etiquetas: string[];
  series: SerieColumnas[];
  alto?: number;
  formato?: (n: number) => string;
}) {
  const id = useId();
  const [activo, setActivo] = useState<number | null>(null);

  const ancho = 720;
  const margen = { arriba: 12, derecha: 8, abajo: 26, izquierda: 56 };
  const areaAncho = ancho - margen.izquierda - margen.derecha;
  const areaAlto = alto - margen.arriba - margen.abajo;

  const maximo = Math.max(1, ...series.flatMap((s) => s.valores));
  const paso = Math.pow(10, Math.floor(Math.log10(maximo)));
  const tope = Math.ceil(maximo / paso) * paso;
  const marcas = [0, tope / 2, tope];

  const anchoGrupo = areaAncho / Math.max(1, etiquetas.length);
  const anchoBarra = Math.min(24, (anchoGrupo * 0.62) / series.length);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full" role="img" aria-label="Gráfica de columnas">
        {marcas.map((m) => {
          const y = margen.arriba + areaAlto - (m / tope) * areaAlto;
          return (
            <g key={m}>
              <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={y} y2={y}
                stroke="var(--color-borde)" strokeWidth={1} />
              <text x={margen.izquierda - 8} y={y + 4} textAnchor="end"
                className="num-tab" fontSize={10} fill="var(--color-tinta-3)">
                {formato(m)}
              </text>
            </g>
          );
        })}

        {etiquetas.map((etiqueta, i) => {
          const centro = margen.izquierda + anchoGrupo * i + anchoGrupo / 2;
          const inicio = centro - (anchoBarra * series.length) / 2;
          return (
            <g key={`${id}-${etiqueta}`}
              onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)}>
              <rect x={margen.izquierda + anchoGrupo * i} y={margen.arriba}
                width={anchoGrupo} height={areaAlto}
                fill={activo === i ? "var(--color-superficie-2)" : "transparent"} />
              {series.map((s, j) => {
                const valor = s.valores[i] ?? 0;
                const h = Math.max(0, (valor / tope) * areaAlto);
                return (
                  <rect key={s.nombre} x={inicio + anchoBarra * j}
                    y={margen.arriba + areaAlto - h} width={anchoBarra - 2} height={h}
                    rx={4} fill={s.color} />
                );
              })}
              <text x={centro} y={alto - 8} textAnchor="middle" fontSize={10}
                fill="var(--color-tinta-3)">
                {etiqueta}
              </text>
            </g>
          );
        })}
      </svg>

      {activo !== null && (
        <div className="pointer-events-none absolute top-2 right-2 rounded border border-borde-fuerte bg-fondo px-3 py-2 text-xs shadow-lg">
          <p className="mb-1 font-semibold text-tinta">{etiquetas[activo]}</p>
          {series.map((s) => (
            <p key={s.nombre} className="flex items-center gap-2 text-tinta-2">
              <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} />
              {s.nombre}
              <span className="num-tab ml-auto text-tinta">{formato(s.valores[activo] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4 pl-14">
          {series.map((s) => (
            <span key={s.nombre} className="flex items-center gap-1.5 text-xs text-tinta-2">
              <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} />
              {s.nombre}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
