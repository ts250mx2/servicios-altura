import Link from "next/link";
import { Plus, Smartphone } from "lucide-react";
import { TituloPagina } from "@/components/layout/Cascaron";
import { BotonesDocumento } from "@/components/proyectos/BotonesDocumento";
import { Boton, Carta, Selector, Vacio } from "@/components/ui/Basicos";
import { ChipMargen, ChipRiesgo, ChipStatus } from "@/components/ui/Chip";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import { listaLevantamientos } from "@/lib/consultas/levantamientos";
import { formatoFecha, formatoMonedaCorta } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Levantamientos(props: {
  searchParams: Promise<{ texto?: string; status?: string; riesgo?: string }>;
}) {
  const filtros = await props.searchParams;
  const filas = await listaLevantamientos(filtros);

  return (
    <>
      <TituloPagina
        titulo="Levantamientos"
        descripcion={`${filas.length} registros`}
        accion={
          <div className="flex gap-2">
            <Link href="/dashboard/levantamientos/nuevo?modo=campo">
              <Boton variante="secundario"><Smartphone size={15} /> Modo campo</Boton>
            </Link>
            <Link href="/dashboard/levantamientos/nuevo">
              <Boton><Plus size={15} strokeWidth={2.5} /> Nuevo</Boton>
            </Link>
          </div>
        }
      />

      <Carta>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="texto" defaultValue={filtros.texto ?? ""}
            placeholder="Buscar por folio, cliente o proyecto…"
            className="min-w-48 flex-1 rounded border border-borde bg-fondo px-3 py-2 text-sm text-tinta placeholder:text-tinta-3 focus:border-acento focus:outline-none" />
          <Selector name="status" defaultValue={filtros.status ?? ""} className="w-40">
            <option value="">Todos los estatus</option>
            <option value="BORRADOR">Borrador</option>
            <option value="CERRADO">Cerrado</option>
            <option value="COTIZADO">Cotizado</option>
            <option value="CANCELADO">Cancelado</option>
          </Selector>
          <Selector name="riesgo" defaultValue={filtros.riesgo ?? ""} className="w-36">
            <option value="">Todo riesgo</option>
            <option value="ALTO">Alto</option>
            <option value="MEDIO">Medio</option>
            <option value="BAJO">Bajo</option>
          </Selector>
          <Boton tipo="submit" variante="secundario">Filtrar</Boton>
        </form>

        {filas.length === 0 ? (
          <Vacio
            mensaje="No hay levantamientos con esos filtros."
            accion={
              <Link href="/dashboard/levantamientos/nuevo">
                <Boton>Capturar el primero</Boton>
              </Link>
            }
          />
        ) : (
          <Tabla>
            <Encabezados columnas={[
              { texto: "Folio", ancho: "70px" },
              { texto: "Cliente / proyecto" },
              { texto: "Fecha", derecha: true },
              { texto: "Personas", derecha: true },
              { texto: "Días", derecha: true },
              { texto: "Cotización", derecha: true },
              { texto: "Margen", derecha: true },
              { texto: "Estatus", derecha: true },
              { texto: "", derecha: true, ancho: "150px" },
            ]} />
            <tbody>
              {filas.map((l) => (
                <Fila key={l.IdLevantamiento}>
                  <Celda mono>
                    <Link href={`/dashboard/levantamientos/${l.IdLevantamiento}`}
                      className="text-acento hover:underline">{l.Folio}</Link>
                  </Celda>
                  <Celda>
                    <p className="text-tinta">{l.Cliente}</p>
                    <p className="line-clamp-1 max-w-md text-xs text-tinta-3">{l.Proyecto}</p>
                    <div className="mt-1 flex gap-1.5"><ChipRiesgo nivel={l.NivelRiesgo} /></div>
                  </Celda>
                  <Celda derecha mono apagada>{formatoFecha(l.Fecha)}</Celda>
                  <Celda derecha mono>{l.Personas}</Celda>
                  <Celda derecha mono>{l.Dias}</Celda>
                  <Celda derecha mono>
                    {l.NoCotizacion ? (
                      <span className="text-tinta">
                        {l.NoCotizacion}
                        <span className="ml-2 text-tinta-3">{formatoMonedaCorta(l.Total ?? 0)}</span>
                      </span>
                    ) : <span className="text-tinta-3">—</span>}
                  </Celda>
                  <Celda derecha><ChipMargen margen={l.MargenPlanPct} /></Celda>
                  <Celda derecha><ChipStatus status={l.Status} /></Celda>
                  <Celda derecha>
                    <BotonesDocumento compacto tipo="levantamiento" id={l.IdLevantamiento}
                      hrefEditar={`/dashboard/levantamientos/${l.IdLevantamiento}/editar`}
                      borrar={{ mensaje: l.NoCotizacion
                        ? `¿Borrar el levantamiento ${l.Folio}? Se borran también la cotización ${l.NoCotizacion} y su costeo. No se puede deshacer.`
                        : `¿Borrar el levantamiento ${l.Folio}? No se puede deshacer.` }} />
                  </Celda>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}
      </Carta>
    </>
  );
}
