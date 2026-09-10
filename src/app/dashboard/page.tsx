import Link from "next/link";
import { TituloPagina } from "@/components/layout/Cascaron";
import { Columnas } from "@/components/graficas/Columnas";
import { Embudo } from "@/components/graficas/Embudo";
import { Carta, Vacio } from "@/components/ui/Basicos";
import { ChipMargen, ChipRiesgo, ChipStatus } from "@/components/ui/Chip";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import { Kpi } from "@/components/ui/Kpi";
import {
  embudo, margenPorCliente, porMes, resumen, ultimosLevantamientos,
} from "@/lib/consultas/tablero";
import { rangoPeriodo, type Periodo } from "@/lib/fechas";
import { formatoFecha, formatoMonedaCorta, formatoNumero, formatoPorcentaje } from "@/lib/formato";

export const dynamic = "force-dynamic";

const PERIODOS: { valor: Periodo; texto: string }[] = [
  { valor: "mes", texto: "Mes" },
  { valor: "trimestre", texto: "Trimestre" },
  { valor: "anio", texto: "Año" },
  { valor: "12meses", texto: "12 meses" },
];

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function Panel(props: { searchParams: Promise<{ periodo?: string }> }) {
  const parametros = await props.searchParams;
  const periodo = (parametros.periodo as Periodo) || "trimestre";
  const rango = rangoPeriodo(periodo);

  const [{ actual, anterior }, etapas, meses, clientes, recientes] = await Promise.all([
    resumen(rango),
    embudo(rango),
    porMes(12),
    margenPorCliente(rango),
    ultimosLevantamientos(8),
  ]);

  const etiquetasMes = meses.map((m) => {
    const [, mes] = m.Mes.split("-");
    return MESES_CORTOS[Number(mes) - 1];
  });

  return (
    <>
      <TituloPagina
        titulo="Panel"
        descripcion={`${rango.etiqueta} · del ${formatoFecha(rango.desde)} al ${formatoFecha(rango.hasta)}`}
        accion={
          <nav className="flex rounded border border-borde">
            {PERIODOS.map((p) => (
              <Link
                key={p.valor}
                href={`/dashboard?periodo=${p.valor}`}
                className={
                  p.valor === periodo
                    ? "bg-acento px-3 py-1.5 text-xs font-semibold text-sobre-acento"
                    : "px-3 py-1.5 text-xs text-tinta-2 hover:bg-superficie-2"
                }
              >
                {p.texto}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi etiqueta="Levantamientos" valor={formatoNumero(actual?.Levantamientos ?? 0, 0)}
          actual={actual?.Levantamientos} anterior={anterior?.Levantamientos} />
        <Kpi etiqueta="Cotizado" valor={formatoMonedaCorta(actual?.MontoCotizado ?? 0)}
          actual={actual?.MontoCotizado} anterior={anterior?.MontoCotizado} />
        <Kpi etiqueta="Autorizado" valor={formatoMonedaCorta(actual?.MontoAutorizado ?? 0)}
          actual={actual?.MontoAutorizado} anterior={anterior?.MontoAutorizado} />
        <Kpi etiqueta="Utilidad planeada" valor={formatoMonedaCorta(actual?.UtilidadPlan ?? 0)}
          actual={actual?.UtilidadPlan} anterior={anterior?.UtilidadPlan} />
        <Kpi etiqueta="Margen promedio" valor={formatoPorcentaje(actual?.MargenPromedio ?? 0)}
          actual={actual?.MargenPromedio} anterior={anterior?.MargenPromedio} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Carta titulo="Cotizado y autorizado" etiqueta="Últimos 12 meses" className="lg:col-span-2">
          {meses.length === 0 ? (
            <Vacio mensaje="Todavía no hay cotizaciones registradas." />
          ) : (
            <Columnas
              etiquetas={etiquetasMes}
              series={[
                { nombre: "Cotizado", color: "var(--color-series-2)", valores: meses.map((m) => Number(m.Cotizado)) },
                { nombre: "Autorizado", color: "var(--color-series-1)", valores: meses.map((m) => Number(m.Autorizado)) },
              ]}
            />
          )}
        </Carta>

        <Carta titulo="Embudo" etiqueta={rango.etiqueta}>
          <Embudo etapas={etapas} />
        </Carta>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Carta titulo="Margen por cliente" etiqueta="Cotizaciones autorizadas">
          {clientes.length === 0 ? (
            <Vacio mensaje="Sin cotizaciones autorizadas en el periodo." />
          ) : (
            <Tabla>
              <Encabezados columnas={[
                { texto: "Cliente" },
                { texto: "Autorizado", derecha: true },
                { texto: "Utilidad", derecha: true },
                { texto: "Margen", derecha: true },
              ]} />
              <tbody>
                {clientes.map((c) => (
                  <Fila key={c.Cliente}>
                    <Celda>{c.Cliente}</Celda>
                    <Celda derecha mono>{formatoMonedaCorta(c.Autorizado)}</Celda>
                    <Celda derecha mono>{formatoMonedaCorta(c.Utilidad)}</Celda>
                    <Celda derecha><ChipMargen margen={c.Margen} /></Celda>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
        </Carta>

        <Carta titulo="Últimos levantamientos" etiqueta="Actividad reciente">
          {recientes.length === 0 ? (
            <Vacio mensaje="Aún no se captura ningún levantamiento." />
          ) : (
            <Tabla>
              <Encabezados columnas={[
                { texto: "Folio", ancho: "72px" },
                { texto: "Cliente / proyecto" },
                { texto: "Fecha", derecha: true },
                { texto: "Estatus", derecha: true },
              ]} />
              <tbody>
                {recientes.map((l) => (
                  <Fila key={l.IdLevantamiento}>
                    <Celda mono>
                      <Link href={`/dashboard/levantamientos/${l.IdLevantamiento}`}
                        className="text-acento hover:underline">
                        {l.Folio}
                      </Link>
                    </Celda>
                    <Celda>
                      <p className="text-tinta">{l.Cliente}</p>
                      <p className="line-clamp-1 text-xs text-tinta-3">{l.Proyecto}</p>
                      <div className="mt-1"><ChipRiesgo nivel={l.NivelRiesgo} /></div>
                    </Celda>
                    <Celda derecha mono apagada>{formatoFecha(l.Fecha)}</Celda>
                    <Celda derecha><ChipStatus status={l.Status} /></Celda>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
        </Carta>
      </div>
    </>
  );
}
