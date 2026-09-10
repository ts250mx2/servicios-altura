"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/Basicos";

export function BotonDescartar({ idImportacion }: { idImportacion: number }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descartar() {
    const seguro = window.confirm(
      "¿Descartar esta importación? Se borran el PDF y las fotos extraídas; no se toca ningún levantamiento.",
    );
    if (!seguro) return;
    setOcupado(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/importar/${idImportacion}`, { method: "DELETE" });
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}));
        setError(datos.mensaje ?? "No se pudo descartar.");
        return;
      }
      router.push("/dashboard/importar");
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-critico">{error}</span>}
      <Boton variante="fantasma" onClick={descartar} disabled={ocupado}>
        <Trash2 size={14} /> Descartar
      </Boton>
    </div>
  );
}
