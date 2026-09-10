import Link from "next/link";
import { TituloPagina } from "@/components/layout/Cascaron";
import { ZonaCarga } from "@/components/importacion/ZonaCarga";
import { BotonesDocumento } from "@/components/proyectos/BotonesDocumento";
import { Boton, Carta, Selector, Vacio } from "@/components/ui/Basicos";
import { ChipMargen, ChipStatus } from "@/components/ui/Chip";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import { Kpi } from "@/components/ui/Kpi";
import { listaCosteos } from "@/lib/consultas/costeos";
import { formatoMoneda, formatoMonedaCorta, formatoPorcentaje } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Costeos(props: {
  searchParams: Promise<{ texto?: string; status?: string }>;
}) {
  const filtros = await props.searchParams;
  const filas = await listaCosteos(filtros);

  const venta = filas.reduce((s, f) => s + Number(f.PrecioVenta), 0);
  const gasto = filas.reduce((s, f) => s + Number(f.GastoTotalPlan), 0);
  const utilidad = filas.reduce((s, f) => s + Number(f.UtilidadNetaPlan), 0);
  const margen = venta > 0 ? (utilidad / venta) * 100 : 0;

  return (
    <>
      <TituloPagina titulo="Costeos" descripcion={`${filas.length} proyectos costeados`} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Venta" valor={formatoMonedaCorta(venta)} />
        <Kpi etiqueta="Gasto total" valor={formatoMonedaCorta(gasto)} />
        <Kpi etiqueta="Utilidad neta" valor={formatoMonedaCorta(utilidad)} />
        <Kpi etiqueta="Margen agregado" valor={formatoPorcentaje(margen)} />
      </div>

      <div className="mb-4"><ZonaCarga solo="excel" compacta /></div>

      <Carta>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="texto" defaultValue={filtros.texto ?? ""}
            placeholder="Buscar por número, cliente o descripción…"
            className="min-w-48 flex-1 rounded border border-borde bg-fondo px-3 py-2 text-sm text-tinta placeholder:text-tinta-3 focus:border-acento focus:outline-none" />
          <Selector name="status" defaultValue={filtros.status ?? ""} className="w-40">
            <option value="">Todos</option>
            <option value="PLANEADO">Planeado</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="CERRADO">Cerrado</option>
          </Selector>
          <Boton tipo="submit" variante="secundario">Filtrar</Boton>
        </form>

        {filas.length === 0 ? (
          <Vacio mensaje="Todavía no hay costeos. Se generan junto con la cotización." />
        ) : (
          <Tabla>
            <Encabezados columnas={[
              { texto: "No.", ancho: "70px" },
              { texto: "Cliente / proyecto" },
              { texto: "Venta", derecha: true },
              { texto: "Gasto plan", derecha: true },
              { texto: "Utilidad", derecha: true },
              { texto: "Margen plan", derecha: true },
              { texto: "Margen real", derecha: true },
              { texto: "Estatus", derecha: true },
              { texto: "", derecha: true, ancho: "150px" },
            ]} />
            <tbody>
              {filas.map((c) => (
                <Fila key={c.IdCosteo}>
                  <Celda mono>
                    <Link href={`/dashboard/costeos/${c.IdCosteo}`} className="text-acento hover:underline">
                      {c.NoCotizacion}
                    </Link>
                  </Celda>
                  <Celda>
                    <p className="text-tinta">{c.Cliente}</p>
                    <p className="line-clamp-1 max-w-md text-xs text-tinta-3">{c.Descripcion}</p>
                  </Celda>
                  <Celda derecha mono>{formatoMoneda(c.PrecioVenta)}</Celda>
                  <Celda derecha mono apagada>{formatoMoneda(c.GastoTotalPlan)}</Celda>
                  <Celda derecha mono>{formatoMoneda(c.UtilidadNetaPlan)}</Celda>
                  <Celda derecha><ChipMargen margen={c.MargenPlanPct} /></Celda>
                  <Celda derecha>
                    {c.Status === "PLANEADO"
                      ? <span className="text-tinta-3">—</span>
                      : <ChipMargen margen={c.MargenRealPct} />}
                  </Celda>
                  <Celda derecha><ChipStatus status={c.Status} /></Celda>
                  <Celda derecha>
                    <BotonesDocumento compacto tipo="costeo" id={c.IdCosteo}
                      hrefEditar={`/dashboard/costeos/${c.IdCosteo}/editar`}
                      borrar={{ mensaje: `¿Borrar el costeo de la cotización ${c.NoCotizacion}? La cotización se queda. No se puede deshacer.` }} />
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
