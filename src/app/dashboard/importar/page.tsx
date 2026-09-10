import Link from "next/link";
import { TituloPagina } from "@/components/layout/Cascaron";
import { BotonDescartar } from "@/components/importacion/BotonDescartar";
import { ZonaCarga } from "@/components/importacion/ZonaCarga";
import { Carta, Vacio } from "@/components/ui/Basicos";
import { ChipStatus } from "@/components/ui/Chip";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import { listaImportaciones, type ImportacionLista } from "@/lib/consultas/importaciones";
import { formatoFechaHora } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Importar() {
  const filas = await listaImportaciones();

  return (
    <>
      <TituloPagina
        titulo="Importar"
        descripcion="Sube la hoja de levantamiento (PDF) o el Excel de costeo, revisa lo extraído y hasta entonces se guarda."
      />

      <Carta titulo="Hoja de levantamiento o Excel de costeo" etiqueta="PDF de la plantilla · libro «NoC. NNNN …».xlsx">
        <ZonaCarga />
      </Carta>

      <Carta titulo="Historial" etiqueta={`${filas.length} importaciones`} className="mt-4">
        {filas.length === 0 ? (
          <Vacio mensaje="Todavía no se ha importado nada." />
        ) : (
          <Tabla>
            <Encabezados columnas={[
              { texto: "Fecha", ancho: "150px" },
              { texto: "Archivo" },
              { texto: "Resultado" },
              { texto: "Usuario" },
              { texto: "Estado", derecha: true },
              { texto: "", derecha: true, ancho: "90px" },
            ]} />
            <tbody>
              {filas.map((fila) => (
                <Fila key={fila.IdImportacion}>
                  <Celda mono apagada>{formatoFechaHora(fila.FechaAlta)}</Celda>
                  <Celda>
                    <p className="text-tinta">{fila.Archivo}</p>
                    <p className="text-xs text-tinta-3">{fila.Tipo}</p>
                  </Celda>
                  <Celda className="max-w-md text-xs text-tinta-2">{fila.Mensaje ?? "—"}</Celda>
                  <Celda apagada>{fila.Usuario ?? "—"}</Celda>
                  <Celda derecha><ChipStatus status={fila.Estado} /></Celda>
                  <Celda derecha><Accion fila={fila} /></Celda>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}
      </Carta>
    </>
  );
}

function Accion({ fila }: { fila: ImportacionLista }) {
  if (fila.Estado === "REVISION") {
    return (
      <Link href={`/dashboard/importar/${fila.IdImportacion}`} className="text-acento hover:underline">
        Revisar
      </Link>
    );
  }
  if (fila.Estado === "APLICADA" && fila.Tipo === "EXCEL" && fila.IdCosteo) {
    return (
      <Link href={`/dashboard/costeos/${fila.IdCosteo}`} className="text-acento hover:underline">
        Cotización {fila.NoCotizacion}
      </Link>
    );
  }
  if (fila.Estado === "APLICADA" && fila.IdLevantamiento) {
    return (
      <Link href={`/dashboard/levantamientos/${fila.IdLevantamiento}`} className="text-acento hover:underline">
        Folio {fila.Folio}
      </Link>
    );
  }
  if (fila.Estado === "ERROR" || fila.Estado === "PENDIENTE") {
    return <BotonDescartar idImportacion={fila.IdImportacion} />;
  }
  return <span className="text-tinta-3">—</span>;
}
