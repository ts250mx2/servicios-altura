import { notFound } from "next/navigation";
import { TituloPagina } from "@/components/layout/Cascaron";
import { AccionesEstado } from "@/components/proyectos/AccionesEstado";
import { BotonesDocumento } from "@/components/proyectos/BotonesDocumento";
import { EncabezadoProyecto } from "@/components/proyectos/EncabezadoProyecto";
import { Carta, Vacio } from "@/components/ui/Basicos";
import { ChipMargen, ChipStatus } from "@/components/ui/Chip";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import { Kpi } from "@/components/ui/Kpi";
import {
  conceptosDe, fichaCosteo, gastosDe, insumosCosteoDe, nominaDe,
} from "@/lib/consultas/costeos";
import { cadenaDeCosteo } from "@/lib/consultas/proyectos";
import { CONCEPTOS, ETIQUETA_CONCEPTO, type Concepto } from "@/lib/costeo/tipos";
import { formatoFecha, formatoMoneda, formatoNumero, formatoPorcentaje } from "@/lib/formato";
import { accionesDeCosteo, claveDe } from "@/lib/tablero/acciones";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FichaCosteo(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const idNumero = Number(id);
  if (!Number.isFinite(idNumero)) notFound();

  const ficha = await fichaCosteo(idNumero);
  if (!ficha) notFound();

  const [conceptos, nomina, insumos, gastos, proyecto] = await Promise.all([
    conceptosDe(idNumero), nominaDe(idNumero), insumosCosteoDe(idNumero), gastosDe(idNumero), cadenaDeCosteo(idNumero),
  ]);
  if (!proyecto) notFound();
  const clave = claveDe(proyecto);

  const porConcepto = new Map(conceptos.map((c) => [c.Concepto, c]));
  const gastoDirecto = Number(ficha.GastoDirectoPlan);
  const impuestos = gastoDirecto * (Number(ficha.ImpuestosPct) / 100);
  const subtotal1 = gastoDirecto + impuestos;
  const administrativos = subtotal1 * (Number(ficha.AdministrativosPct) / 100);
  const subtotal3 = subtotal1 + administrativos + Number(ficha.InsumosPlan);
  const financiamiento = subtotal3 * (Number(ficha.FinanciamientoPct) / 100);

  const cadena = [
    { etiqueta: "Gasto directo", valor: gastoDirecto, fuerte: true },
    { etiqueta: `Impuestos ${formatoNumero(ficha.ImpuestosPct, 0)} %`, valor: impuestos },
    { etiqueta: "Subtotal", valor: subtotal1 },
    { etiqueta: `Administrativos ${formatoNumero(ficha.AdministrativosPct, 0)} %`, valor: administrativos },
    { etiqueta: "Insumos", valor: Number(ficha.InsumosPlan) },
    { etiqueta: "Subtotal", valor: subtotal3 },
    { etiqueta: `Financiamiento ${formatoNumero(ficha.FinanciamientoPct, 0)} %`, valor: financiamiento },
    { etiqueta: "Gasto total", valor: Number(ficha.GastoTotalPlan), fuerte: true },
  ];

  return (
    <>
      <TituloPagina
        titulo={`Costeo · cotización ${ficha.NoCotizacion}`}
        descripcion={`${ficha.Cliente} · ${ficha.Dias} días · ${ficha.Personal} personas · lo que cuesta hacerlo y lo que deja`}
        accion={
          <BotonesDocumento
            tipo="costeo"
            id={idNumero}
            hrefEditar={`/dashboard/costeos/${idNumero}/editar`}
            borrar={{ mensaje: `¿Borrar el costeo de la cotización ${ficha.NoCotizacion}? La cotización se queda. No se puede deshacer.`, regresarA: "/dashboard/costeos" }}
          />
        }
      />
      <EncabezadoProyecto cadena={proyecto} actual="costeo" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi etiqueta="Precio de venta (lo que se cobra)" valor={formatoMoneda(ficha.PrecioVenta)} />
        <Kpi etiqueta="Gasto plan (lo que cuesta hacerlo)" valor={formatoMoneda(ficha.GastoTotalPlan)} />
        <Kpi etiqueta="Gasto real (lo que ya se gastó)"
          valor={Number(ficha.GastoTotalReal) > 0 ? formatoMoneda(ficha.GastoTotalReal) : "Sin capturar"}
          actual={Number(ficha.GastoTotalReal) > 0 ? Number(ficha.GastoTotalReal) : undefined}
          anterior={Number(ficha.GastoTotalReal) > 0 ? Number(ficha.GastoTotalPlan) : undefined}
          invertir />
        <Kpi etiqueta="Utilidad neta (lo que deja)" valor={formatoMoneda(ficha.UtilidadNetaPlan)} />
        <Kpi etiqueta="Margen (utilidad ÷ precio)" valor={formatoPorcentaje(ficha.MargenPlanPct)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Carta titulo="Cadena de costeo" etiqueta="Del gasto directo a la utilidad, paso por paso">
          <dl className="space-y-1.5 text-sm">
            {cadena.map((r, i) => (
              <div key={i}
                className={cn("flex justify-between",
                  r.fuerte ? "border-t border-borde pt-1.5 font-semibold text-tinta" : "text-tinta-2")}>
                <dt>{r.etiqueta}</dt>
                <dd className="num-tab">{formatoMoneda(r.valor)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-3 text-tinta-2">
              <dt>Utilidad bruta</dt>
              <dd className="num-tab">{formatoMoneda(ficha.PrecioVenta - ficha.GastoTotalPlan)}</dd>
            </div>
            <div className="flex justify-between text-tinta-2">
              <dt>Comisión {formatoNumero(ficha.ComisionPct, 0)} %</dt>
              <dd className="num-tab">
                −{formatoMoneda((ficha.PrecioVenta - ficha.GastoTotalPlan) * (Number(ficha.ComisionPct) / 100))}
              </dd>
            </div>
            <div className="flex justify-between border-t border-acento/40 pt-1.5">
              <dt className="font-semibold text-tinta">Utilidad neta</dt>
              <dd className="num-tab font-semibold text-acento">{formatoMoneda(ficha.UtilidadNetaPlan)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-center justify-between border-t border-borde pt-3">
            <ChipStatus status={ficha.Status} />
            <ChipMargen margen={ficha.MargenPlanPct} />
          </div>
          {clave && (
            <div className="mt-3">
              <AccionesEstado clave={clave} acciones={accionesDeCosteo(proyecto)} />
            </div>
          )}
        </Carta>

        <Carta titulo="Conceptos" etiqueta="Lo presupuestado (plan) contra lo gastado de verdad (real)" className="lg:col-span-2">
          <Tabla>
            <Encabezados columnas={[
              { texto: "Concepto" },
              { texto: "Gasto plan", derecha: true },
              { texto: "Gasto real", derecha: true },
              { texto: "Diferencia", derecha: true },
            ]} />
            <tbody>
              {CONCEPTOS.map((c) => {
                const fila = porConcepto.get(c as Concepto);
                const plan = Number(fila?.GastoPlan ?? 0);
                const real = Number(fila?.GastoReal ?? 0);
                const diferencia = real - plan;
                if (plan === 0 && real === 0) return null;
                return (
                  <Fila key={c}>
                    <Celda>{ETIQUETA_CONCEPTO[c as Concepto]}</Celda>
                    <Celda derecha mono>{formatoMoneda(plan)}</Celda>
                    <Celda derecha mono apagada={real === 0}>{formatoMoneda(real)}</Celda>
                    <Celda derecha mono
                      className={
                        real === 0 || diferencia === 0
                          ? "text-tinta-3"
                          : diferencia > 0
                            ? "text-critico"
                            : "text-bueno"
                      }>
                      {real === 0 || diferencia === 0 ? "—" : formatoMoneda(diferencia)}
                    </Celda>
                  </Fila>
                );
              })}
            </tbody>
          </Tabla>
        </Carta>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Carta titulo="Nómina del proyecto" etiqueta="Nómina, IMSS y desgaste en una sola matriz">
          {nomina.length === 0 ? (
            <Vacio mensaje="Sin personal asignado." />
          ) : (
            <Tabla>
              <Encabezados columnas={[
                { texto: "Persona" },
                { texto: "Días", derecha: true },
                { texto: "Nómina", derecha: true },
                { texto: "IMSS", derecha: true },
                { texto: "Desgaste", derecha: true },
                { texto: "Bono", derecha: true },
              ]} />
              <tbody>
                {nomina.map((n) => (
                  <Fila key={n.IdCosteoNomina}>
                    <Celda>
                      {n.Nombre}
                      <span className="ml-2 text-xs text-tinta-3">{n.Puesto}</span>
                    </Celda>
                    <Celda derecha mono>{n.DiasPlan}</Celda>
                    <Celda derecha mono>{formatoMoneda(n.SalarioDiario * n.DiasPlan)}</Celda>
                    <Celda derecha mono apagada>{formatoMoneda(n.ImssDiario * n.DiasPlan)}</Celda>
                    <Celda derecha mono apagada>{formatoMoneda(n.DesgasteDiario * n.DiasPlan)}</Celda>
                    <Celda derecha mono>{formatoMoneda(n.Bono)}</Celda>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
        </Carta>

        <Carta titulo="Insumos" etiqueta={`${insumos.length} partidas`}>
          {insumos.length === 0 ? (
            <Vacio mensaje="Sin insumos: el material lo pone el cliente." />
          ) : (
            <Tabla>
              <Encabezados columnas={[
                { texto: "Cant.", ancho: "56px", derecha: true },
                { texto: "Concepto" },
                { texto: "Plan", derecha: true },
                { texto: "Real", derecha: true },
              ]} />
              <tbody>
                {insumos.map((i) => (
                  <Fila key={i.IdCosteoInsumo}>
                    <Celda derecha mono>{formatoNumero(i.Unidades, 0)}</Celda>
                    <Celda className={i.Comentario === "NO APLICAR" ? "text-tinta-3" : undefined}>
                      {i.Descripcion}
                      {i.Comentario && <span className="ml-2 text-xs text-tinta-3">{i.Comentario}</span>}
                    </Celda>
                    <Celda derecha mono>{formatoMoneda(i.CostoPlan)}</Celda>
                    <Celda derecha mono apagada>{formatoMoneda(i.CostoReal)}</Celda>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
        </Carta>
      </div>

      {gastos.length > 0 && (
        <Carta titulo="Gastos con fecha" etiqueta="Gasolina, administrativos, EPP y equipo" className="mt-4">
          <Tabla>
            <Encabezados columnas={[
              { texto: "Concepto" },
              { texto: "Fecha" },
              { texto: "Detalle" },
              { texto: "Importe", derecha: true },
            ]} />
            <tbody>
              {gastos.map((g) => (
                <Fila key={g.IdCosteoGasto}>
                  <Celda>{ETIQUETA_CONCEPTO[g.Concepto as Concepto] ?? g.Concepto}</Celda>
                  <Celda apagada>{formatoFecha(g.Fecha)}</Celda>
                  <Celda apagada>{g.Descripcion ?? "—"}</Celda>
                  <Celda derecha mono>{formatoMoneda(g.Cantidad)}</Celda>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        </Carta>
      )}
    </>
  );
}
