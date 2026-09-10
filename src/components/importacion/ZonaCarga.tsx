"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { Boton } from "@/components/ui/Basicos";
import { cn } from "@/lib/utils";

/** A qué ruta va cada tipo de archivo; null cuando no se acepta. */
function rutaPara(nombre: string): { url: string; etiqueta: string } | null {
  const minusculas = nombre.toLowerCase();
  if (minusculas.endsWith(".pdf")) return { url: "/api/importar/pdf", etiqueta: "la hoja de levantamiento" };
  if (minusculas.endsWith(".xlsx")) return { url: "/api/importar/excel", etiqueta: "el Excel de costeo" };
  return null;
}

/** Zona de arrastre para el PDF de levantamiento o el Excel de costeo; al terminar manda a revisar. */
export function ZonaCarga() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [leyendo, setLeyendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    setError(null);
    const ruta = rutaPara(archivo.name);
    if (!ruta) {
      setError(
        archivo.name.toLowerCase().endsWith(".xls")
          ? "Es un Excel de formato viejo (.xls). Ábrelo y guárdalo como .xlsx para importarlo."
          : "Sólo se aceptan la hoja de levantamiento en PDF o el Excel de costeo (.xlsx).",
      );
      return;
    }
    setLeyendo(`${ruta.etiqueta} ${archivo.name}`);
    try {
      const cuerpo = new FormData();
      cuerpo.append("archivo", archivo);
      const respuesta = await fetch(ruta.url, { method: "POST", body: cuerpo });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setError(datos.mensaje ?? "No se pudo importar el archivo.");
        setLeyendo(null);
        router.refresh();
        return;
      }
      router.push(`/dashboard/importar/${datos.idImportacion}`);
    } catch {
      setError("No hay conexión con el servidor.");
      setLeyendo(null);
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        const archivo = e.dataTransfer.files[0];
        if (archivo && !leyendo) void subir(archivo);
      }}
      className={cn(
        "flex flex-col items-center gap-3 rounded border border-dashed px-4 py-12 text-center transition-colors duration-150",
        arrastrando ? "border-acento bg-superficie-2" : "border-borde-fuerte",
      )}
    >
      {leyendo ? (
        <Loader2 size={28} className="animate-spin text-acento" />
      ) : (
        <FileUp size={28} className="text-tinta-3" />
      )}
      <p className="text-sm text-tinta">
        {leyendo ? `Leyendo ${leyendo}…` : "Arrastra aquí la hoja de levantamiento (PDF) o el Excel de costeo (.xlsx)"}
      </p>
      <p className="max-w-md text-xs text-tinta-3">
        Del PDF salen datos, actividades, personal, insumos y fotos. Del Excel, la cotización y
        el costeo completo: nómina, insumos, gastos y utilidad. Nada se guarda hasta que lo revises.
      </p>
      <Boton variante="secundario" onClick={() => entrada.current?.click()} disabled={leyendo !== null}>
        Elegir archivo
      </Boton>
      <input
        ref={entrada}
        type="file"
        accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) void subir(archivo);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="rounded border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">
          {error}
        </p>
      )}
    </div>
  );
}
