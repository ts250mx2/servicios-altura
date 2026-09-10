"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { Boton } from "@/components/ui/Basicos";
import { cn } from "@/lib/utils";

type Solo = "pdf" | "excel";

/** A qué ruta va cada tipo de archivo; null cuando no se acepta. */
function rutaPara(nombre: string, solo?: Solo): { url: string; etiqueta: string } | null {
  const minusculas = nombre.toLowerCase();
  if (minusculas.endsWith(".pdf") && solo !== "excel") return { url: "/api/importar/pdf", etiqueta: "la hoja de levantamiento" };
  if (minusculas.endsWith(".xlsx") && solo !== "pdf") return { url: "/api/importar/excel", etiqueta: "el Excel de costeo" };
  return null;
}

const TEXTOS: Record<Solo | "ambos", { arrastra: string; ayuda: string; acepta: string }> = {
  pdf: {
    arrastra: "Arrastra aquí la hoja de levantamiento en PDF",
    ayuda: "Se extraen datos, actividades, personal, insumos y fotos. Nada se guarda hasta que lo revises.",
    acepta: ".pdf,application/pdf",
  },
  excel: {
    arrastra: "Arrastra aquí el Excel de costeo (.xlsx)",
    ayuda: "Se leen la cotización y el costeo completo: nómina, insumos, gastos y utilidad. Nada se guarda hasta que lo revises.",
    acepta: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  ambos: {
    arrastra: "Arrastra aquí la hoja de levantamiento (PDF) o el Excel de costeo (.xlsx)",
    ayuda: "Del PDF salen datos, actividades, personal, insumos y fotos. Del Excel, la cotización y el costeo completo: nómina, insumos, gastos y utilidad. Nada se guarda hasta que lo revises.",
    acepta: ".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

/**
 * Zona de arrastre para el PDF de levantamiento o el Excel de costeo; al
 * terminar manda a revisar. `solo` la limita a un tipo; `compacta` la hace
 * una franja chica para ponerla arriba de una lista.
 */
export function ZonaCarga({ solo, compacta = false }: { solo?: Solo; compacta?: boolean } = {}) {
  const textos = TEXTOS[solo ?? "ambos"];
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [leyendo, setLeyendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    setError(null);
    const ruta = rutaPara(archivo.name, solo);
    if (!ruta) {
      setError(
        archivo.name.toLowerCase().endsWith(".xls")
          ? "Es un Excel de formato viejo (.xls). Ábrelo y guárdalo como .xlsx para importarlo."
          : solo === "pdf"
            ? "Aquí sólo se acepta la hoja de levantamiento en PDF."
            : solo === "excel"
              ? "Aquí sólo se acepta el Excel de costeo (.xlsx)."
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
        "flex items-center gap-3 rounded border border-dashed transition-colors duration-150",
        compacta ? "flex-row flex-wrap px-4 py-3 text-left" : "flex-col px-4 py-12 text-center",
        arrastrando ? "border-acento bg-superficie-2" : "border-borde-fuerte",
      )}
    >
      {leyendo ? (
        <Loader2 size={compacta ? 20 : 28} className="shrink-0 animate-spin text-acento" />
      ) : (
        <FileUp size={compacta ? 20 : 28} className="shrink-0 text-tinta-3" />
      )}
      <div className={compacta ? "min-w-0 flex-1" : "contents"}>
        <p className="text-sm text-tinta">{leyendo ? `Leyendo ${leyendo}…` : textos.arrastra}</p>
        {!compacta && <p className="max-w-md text-xs text-tinta-3">{textos.ayuda}</p>}
      </div>
      <Boton variante="secundario" onClick={() => entrada.current?.click()} disabled={leyendo !== null}>
        {solo === "pdf" ? "Importar PDF" : solo === "excel" ? "Importar Excel" : "Elegir archivo"}
      </Boton>
      <input
        ref={entrada}
        type="file"
        accept={textos.acepta}
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
