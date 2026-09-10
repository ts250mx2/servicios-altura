"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/Basicos";
import type { ClaveColumna } from "@/lib/tablero/columnas";

export interface AccionEstado {
  destino: ClaveColumna;
  texto: string;
  /** Pide confirmación antes (rechazar, cancelar). */
  confirmar?: string;
  primaria?: boolean;
}

/** Botones de cambio de estatus; usan el mismo mover del tablero, así las reglas viven en un solo lugar. */
export function AccionesEstado({ clave, acciones }: { clave: string; acciones: AccionEstado[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mover(accion: AccionEstado) {
    if (accion.confirmar && !window.confirm(accion.confirmar)) return;
    setOcupado(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/tablero/mover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, destino: accion.destino }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setError(datos.mensaje ?? "No se pudo cambiar el estatus.");
        return;
      }
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setOcupado(false);
    }
  }

  if (acciones.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {acciones.map((a) => (
        <Boton key={a.destino} variante={a.primaria ? "primario" : "secundario"} disabled={ocupado} onClick={() => mover(a)}>
          {a.texto}
        </Boton>
      ))}
      {error && <span className="text-xs text-critico">{error}</span>}
    </div>
  );
}
