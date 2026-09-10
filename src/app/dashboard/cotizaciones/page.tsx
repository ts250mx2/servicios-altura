import Link from "next/link";
import { TituloPagina } from "@/components/layout/Cascaron";
import { ZonaCarga } from "@/components/importacion/ZonaCarga";
import { BotonesDocumento } from "@/components/proyectos/BotonesDocumento";
import { Boton, Carta, Selector, Vacio } from "@/components/ui/Basicos";
import { Chip, ChipMargen, ChipStatus } from "@/components/ui/Chip";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import { listaCotizaciones } from "@/lib/consultas/cotizaciones";
import { formatoFecha, formatoMoneda } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Cotizaciones(props: {
  searchParams: Promise<{ texto?: string; status?: string }>;
}) {
  const filtros = await props.searchParams;
  const filas = await listaCotizaciones(filtros);
  const cotizado = filas.reduce((s, f) => s + Number(f.Subtotal), 0);
  const autorizado = filas
    .filter((f) => f.Status === "AUTORIZADA")
    .reduce((s, f) => s + Number(f.Subtotal), 0);

  return (
    <>
      <TituloPagina
        titulo="Cotizaciones"
        descripcion={`${filas.length} cotizaciones · ${formatoMoneda(cotizado)} cotizado · ${formatoMoneda(autorizado)} autorizado`}
      />

      <div className="mb-4"><ZonaCarga solo="excel" compacta /></div>

      <Carta>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="texto" defaultValue={filtros.texto ?? ""}
            placeholder="Buscar por número, cliente o descripción…"
            className="min-w-48 flex-1 rounded border border-borde bg-fondo px-3 py-2 text-sm text-tinta placeholder:text-tinta-3 focus:border-acento focus:outline-none" />
          <Selector name="status" defaultValue={filtros.status ?? ""} className="w-44">
            <option value="">Todos los estatus</option>
            <option value="BORRADOR">Borrador</option>
            <option value="ENVIADA">Enviada</option>
            <option value="AUTORIZADA">Autorizada</option>
            <option value="RECHAZADA">Rechazada</option>
          </Selector>
          <Boton tipo="submit" variante="secundario">Filtrar</Boton>
        </form>

        {filas.length === 0 ? (
          <Vacio mensaje="No hay cotizaciones. Se generan al cerrar un levantamiento." />
        ) : (
          <Tabla>
            <Encabezados columnas={[
              { texto: "No.", ancho: "70px" },
              { texto: "Cliente / descripción" },
              { texto: "Fecha", derecha: true },
              { texto: "Días", derecha: true },
              { texto: "Subtotal", derecha: true },
              { texto: "Margen", derecha: true },
              { texto: "Estatus", derecha: true },
              { texto: "", derecha: true, ancho: "150px" },
            ]} />
            <tbody>
              {filas.map((c) => (
                <Fila key={c.IdCotizacion}>
                  <Celda mono>
                    <Link href={`/dashboard/cotizaciones/${c.IdCotizacion}`} className="text-acento hover:underline">
                      {c.NoCotizacion}
                    </Link>
                  </Celda>
                  <Celda>
                    <p className="text-tinta">{c.Cliente}</p>
                    <p className="line-clamp-1 max-w-md text-xs text-tinta-3">{c.Descripcion}</p>
                  </Celda>
                  <Celda derecha mono apagada>{formatoFecha(c.Fecha)}</Celda>
                  <Celda derecha>
                    {c.Status === "ENVIADA" && c.DiasAbierta > c.Vigencia ? (
                      <Chip tono="serio">{c.DiasAbierta} d</Chip>
                    ) : (
                      <span className="num-tab text-tinta-3">{c.DiasAbierta}</span>
                    )}
                  </Celda>
                  <Celda derecha mono>{formatoMoneda(c.Subtotal)}</Celda>
                  <Celda derecha><ChipMargen margen={c.MargenPlanPct} /></Celda>
                  <Celda derecha><ChipStatus status={c.Status} /></Celda>
                  <Celda derecha>
                    <BotonesDocumento compacto tipo="cotizacion" id={c.IdCotizacion}
                      hrefEditar={`/dashboard/cotizaciones/${c.IdCotizacion}/editar`}
                      borrar={{ mensaje: `¿Borrar la cotización ${c.NoCotizacion}? Se borra también su costeo. No se puede deshacer.` }} />
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
