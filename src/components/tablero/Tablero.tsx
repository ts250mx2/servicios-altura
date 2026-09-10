"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, FileText, Wallet } from "lucide-react";
import { Chip, ChipMargen, ChipRiesgo } from "@/components/ui/Chip";
import { Entrada, Selector } from "@/components/ui/Basicos";
import type { TarjetaProyecto } from "@/lib/consultas/proyectos";
import { formatoFecha, formatoMonedaCorta } from "@/lib/formato";
import { COLUMNAS, columnaDe, type ClaveColumna } from "@/lib/tablero/columnas";
import { cn } from "@/lib/utils";

/** Kanban de proyectos con arrastre nativo del navegador, sin librerías. */
export function Tablero({ tarjetas }: { tarjetas: TarjetaProyecto[] }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [cliente, setCliente] = useState("");
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<ClaveColumna | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /**
   * Columna forzada mientras el servidor confirma el movimiento (optimista).
   * Va amarrada a la lista de tarjetas con la que se hizo: cuando llegan tarjetas
   * frescas del servidor, lo que diga la base manda otra vez.
   */
  const [optimista, setOptimista] = useState<{ base: TarjetaProyecto[]; mapa: Record<string, ClaveColumna> }>({ base: tarjetas, mapa: {} });
  const movidas = useMemo(() => (optimista.base === tarjetas ? optimista.mapa : {}), [optimista, tarjetas]);
  const setMovidas = (cambio: (m: Record<string, ClaveColumna>) => Record<string, ClaveColumna>) =>
    setOptimista((o) => ({ base: tarjetas, mapa: cambio(o.base === tarjetas ? o.mapa : {}) }));

  const clientes = useMemo(() => [...new Set(tarjetas.map((t) => t.cliente))].sort(), [tarjetas]);
  const visibles = useMemo(() => {
    const buscado = texto.trim().toLowerCase();
    return tarjetas.filter((t) => {
      if (cliente && t.cliente !== cliente) return false;
      if (!buscado) return true;
      return [t.cliente, t.proyecto, t.levantamiento?.folio, t.cotizacion?.no]
        .some((v) => String(v ?? "").toLowerCase().includes(buscado));
    });
  }, [tarjetas, texto, cliente]);

  const porColumna = useMemo(() => {
    const grupos = Object.fromEntries(COLUMNAS.map((c) => [c.clave, [] as TarjetaProyecto[]])) as Record<ClaveColumna, TarjetaProyecto[]>;
    for (const t of visibles) grupos[movidas[t.clave] ?? columnaDe(t)].push(t);
    return grupos;
  }, [visibles, movidas]);

  async function soltar(destino: ClaveColumna) {
    const clave = arrastrando;
    setArrastrando(null);
    setSobre(null);
    if (!clave) return;
    const tarjeta = tarjetas.find((t) => t.clave === clave);
    if (!tarjeta || (movidas[clave] ?? columnaDe(tarjeta)) === destino) return;
    const anterior = movidas[clave] ?? columnaDe(tarjeta);
    setMovidas((m) => ({ ...m, [clave]: destino }));
    setAviso(null);
    try {
      const respuesta = await fetch("/api/tablero/mover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, destino }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setMovidas((m) => ({ ...m, [clave]: anterior }));
        setAviso(datos.mensaje ?? "No se pudo mover la tarjeta.");
        return;
      }
      router.refresh();
    } catch {
      setMovidas((m) => ({ ...m, [clave]: anterior }));
      setAviso("No hay conexión con el servidor.");
    }
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-96 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por folio, cotización, cliente o proyecto…"
          className="max-w-sm" />
        <Selector value={cliente} onChange={(e) => setCliente(e.target.value)} className="w-56">
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
        </Selector>
        <span className="text-xs text-tinta-3">{visibles.length} proyectos</span>
        {aviso && (
          <span className="rounded border border-critico/40 bg-critico/10 px-3 py-1.5 text-xs text-critico">{aviso}</span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
        {COLUMNAS.map((columna) => {
          const lista = porColumna[columna.clave];
          const monto = lista.reduce((s, t) => s + (t.cotizacion?.subtotal ?? 0), 0);
          const activa = sobre === columna.clave && arrastrando !== null;
          return (
            <section
              key={columna.clave}
              onDragOver={(e) => { e.preventDefault(); if (sobre !== columna.clave) setSobre(columna.clave); }}
              onDragLeave={() => setSobre((s) => (s === columna.clave ? null : s))}
              onDrop={(e) => { e.preventDefault(); void soltar(columna.clave); }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-lg border bg-superficie transition-colors duration-150",
                activa ? "border-acento bg-superficie-2" : "border-borde",
                columna.clave === "PERDIDO" && "opacity-80",
              )}
            >
              <header className="border-b border-borde px-3 py-2.5" title={columna.ayuda}>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="display text-base text-tinta">{columna.titulo}</h2>
                  <span className="num-tab rounded bg-fondo px-1.5 py-0.5 text-xs text-tinta-2">{lista.length}</span>
                </div>
                <p className="mt-0.5 flex justify-between text-[0.68rem] text-tinta-3">
                  <span className="truncate">{columna.ayuda}</span>
                  {monto > 0 && <span className="num-tab ml-2 shrink-0 text-tinta-2">{formatoMonedaCorta(monto)}</span>}
                </p>
              </header>
              <ul className="flex-1 space-y-2 overflow-y-auto p-2">
                {lista.length === 0 && (
                  <li className="rounded border border-dashed border-borde px-3 py-6 text-center text-xs text-tinta-3">
                    {activa ? "Suelta aquí" : "Nada por aquí"}
                  </li>
                )}
                {lista.map((t) => (
                  <Tarjeta key={t.clave} t={t} arrastrando={arrastrando === t.clave}
                    onDragStart={() => setArrastrando(t.clave)} onDragEnd={() => { setArrastrando(null); setSobre(null); }} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Tarjeta({
  t, arrastrando, onDragStart, onDragEnd,
}: {
  t: TarjetaProyecto; arrastrando: boolean; onDragStart: () => void; onDragEnd: () => void;
}) {
  const href = t.costeo
    ? `/dashboard/costeos/${t.costeo.id}`
    : t.cotizacion
      ? `/dashboard/cotizaciones/${t.cotizacion.id}`
      : `/dashboard/levantamientos/${t.levantamiento?.id}`;
  const vencida = t.cotizacion?.status === "ENVIADA" && t.cotizacion.diasAbierta > t.cotizacion.vigencia;
  return (
    <li
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.clave); onDragStart(); }}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-grab rounded border border-borde bg-fondo p-3 transition-all duration-150 hover:border-borde-fuerte active:cursor-grabbing",
        arrastrando && "opacity-40",
      )}
    >
      <Link href={href} className="block">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-tinta">{t.cliente}</p>
          {t.nivelRiesgo && <ChipRiesgo nivel={t.nivelRiesgo} />}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-tinta-2">{t.proyecto}</p>

        <div className="mt-2 flex items-center gap-1.5 text-[0.68rem] text-tinta-3">
          <Paso icono={ClipboardList} hecho={t.levantamiento !== null} texto={t.levantamiento ? `F ${t.levantamiento.folio}` : "sin hoja"} />
          <span className="text-borde-fuerte">›</span>
          <Paso icono={FileText} hecho={t.cotizacion !== null} texto={t.cotizacion ? `C ${t.cotizacion.no}` : "sin precio"} />
          <span className="text-borde-fuerte">›</span>
          <Paso icono={Wallet} hecho={t.costeo !== null} texto={t.costeo ? "costeo" : "—"} />
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="num-tab text-sm text-tinta">
            {t.cotizacion ? formatoMonedaCorta(t.cotizacion.subtotal) : <span className="text-tinta-3">sin precio</span>}
          </span>
          {t.costeo ? <ChipMargen margen={t.costeo.status === "CERRADO" && t.costeo.margenReal > 0 ? t.costeo.margenReal : t.costeo.margenPlan} /> : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] text-tinta-3">
          <span>{formatoFecha(t.fecha)}</span>
          {t.personas > 0 && <span>· {t.personas} pers.</span>}
          {t.dias > 0 && <span>· {t.dias} días</span>}
          {vencida && <Chip tono="serio">vencida</Chip>}
        </div>
      </Link>
    </li>
  );
}

function Paso({ icono: Icono, hecho, texto }: { icono: typeof ClipboardList; hecho: boolean; texto: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", hecho ? "text-tinta-2" : "text-tinta-3/70")}>
      <Icono size={11} className={hecho ? "text-acento" : undefined} />
      <span className="num-tab">{texto}</span>
    </span>
  );
}
