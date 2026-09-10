"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Pencil, Printer, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type TipoDocumento = "levantamiento" | "cotizacion" | "costeo";

const RUTA_API: Record<TipoDocumento, string> = {
  levantamiento: "/api/levantamientos",
  cotizacion: "/api/cotizaciones",
  costeo: "/api/costeos",
};

interface Props {
  tipo: TipoDocumento;
  id: number;
  /** Lápiz: a dónde lleva editar. */
  hrefEditar?: string;
  /** Bote: qué se pregunta antes de borrar y a dónde ir después (en las listas, se refresca). */
  borrar?: { mensaje: string; regresarA?: string };
  /** Hojita de Excel además de la impresora. */
  conExcel?: boolean;
  /** Iconos chicos, para renglones de tabla. */
  compacto?: boolean;
}

/**
 * Los iconos de siempre: lápiz para editar, impresora para el PDF, hojita para
 * el Excel y bote para borrar. Iguales en las listas y en las fichas.
 */
export function BotonesDocumento({ tipo, id, hrefEditar, borrar, conExcel = true, compacto = false }: Props) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tamano = compacto ? 15 : 17;
  const clase = cn(
    "inline-flex items-center justify-center rounded border border-transparent text-tinta-2 transition-colors duration-150",
    "hover:border-borde-fuerte hover:bg-superficie-2 hover:text-tinta disabled:cursor-not-allowed disabled:opacity-40",
    compacto ? "size-7" : "size-9",
  );

  async function eliminar() {
    if (!borrar || !window.confirm(borrar.mensaje)) return;
    setBorrando(true);
    setError(null);
    try {
      const respuesta = await fetch(`${RUTA_API[tipo]}/${id}`, { method: "DELETE" });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setError(datos.mensaje ?? "No se pudo borrar.");
        window.alert(datos.mensaje ?? "No se pudo borrar.");
        return;
      }
      if (borrar.regresarA) router.push(borrar.regresarA);
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setBorrando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {hrefEditar && (
        <Link href={hrefEditar} className={clase} title="Editar" aria-label="Editar">
          <Pencil size={tamano} />
        </Link>
      )}
      <a href={`/api/documentos/${tipo}/${id}/pdf`} target="_blank" rel="noopener noreferrer" className={clase}
        title="Imprimir (PDF)" aria-label="Imprimir en PDF">
        <Printer size={tamano} />
      </a>
      {conExcel && (
        <a href={`/api/documentos/${tipo}/${id}/excel`} className={clase} title="Descargar Excel" aria-label="Descargar Excel">
          <FileSpreadsheet size={tamano} />
        </a>
      )}
      {borrar && (
        <button type="button" onClick={eliminar} disabled={borrando} className={cn(clase, "hover:border-critico/50 hover:text-critico")}
          title="Borrar" aria-label="Borrar">
          <Trash2 size={tamano} />
        </button>
      )}
      {error && <span className="ml-1 text-xs text-critico">{error}</span>}
    </span>
  );
}
