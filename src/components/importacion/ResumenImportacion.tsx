import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Carta } from "@/components/ui/Basicos";
import { BotonDescartar } from "./BotonDescartar";

/** Encabezado de la pantalla de revisión: qué archivo es, qué quedó dudoso y las fotos que trajo. */
export function ResumenImportacion({
  idImportacion, archivo, urlOriginal, avisos, evidencias,
}: {
  idImportacion: number;
  archivo: string;
  urlOriginal: string;
  avisos: string[];
  evidencias: string[];
}) {
  return (
    <Carta
      titulo="Lo que se leyó del archivo"
      etiqueta={archivo}
      className="mb-4"
      accion={
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={urlOriginal}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-acento hover:underline"
          >
            <ExternalLink size={14} /> Ver archivo original
          </a>
          <BotonDescartar idImportacion={idImportacion} />
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          {avisos.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-bueno">
              <CheckCircle2 size={15} /> Todo cuadró con la plantilla.
            </p>
          ) : (
            <>
              <p className="mb-2 flex items-center gap-2 text-sm text-alerta">
                <AlertTriangle size={15} /> {avisos.length} {avisos.length === 1 ? "cosa" : "cosas"} que revisar antes de guardar
              </p>
              <ul className="space-y-1 text-sm text-tinta-2">
                {avisos.map((aviso) => (
                  <li key={aviso} className="flex gap-2">
                    <span className="text-tinta-3">·</span>
                    <span>{aviso}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-xs text-tinta-3">
            Los pasos de abajo ya vienen llenos con lo extraído; corrige lo que haga falta.
            Nada entra a la base hasta que oprimas «Guardar borrador» o «Generar cotización y costeo».
          </p>
        </div>

        {evidencias.length > 0 && (
          <div>
            <p className="etiqueta mb-2">{evidencias.length} fotos</p>
            <div className="flex gap-2">
              {evidencias.map((ruta) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={ruta}
                  src={ruta}
                  alt="Evidencia"
                  className="h-24 w-16 rounded border border-borde object-cover"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Carta>
  );
}
