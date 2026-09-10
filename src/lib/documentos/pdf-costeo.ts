import { CONCEPTOS, ETIQUETA_CONCEPTO, type Concepto } from "@/lib/costeo/tipos";
import { formatoFecha, formatoMoneda, formatoNumero, formatoPorcentaje } from "@/lib/formato";
import type { DatosCosteoDoc } from "./datos";
import { ANCHO_UTIL, crearDocumento, cuadricula, seccion, tabla, terminar } from "./pdf-base";

/** El costeo interno: la cadena, los nueve conceptos plan/real, nómina, insumos y gastos. */
export async function pdfCosteo(d: DatosCosteoDoc): Promise<Uint8Array> {
  const { ficha } = d;
  const { doc, y: inicio } = await crearDocumento({
    titulo: "Costeo del proyecto",
    subtitulo: `${ficha.Cliente} · uso interno`,
    referencia: [`COTIZACIÓN ${ficha.NoCotizacion}`, ficha.Folio ? `FOLIO ${ficha.Folio}` : "SIN LEVANTAMIENTO", `FECHA ${formatoFecha(ficha.Fecha)}`],
  });

  let y = cuadricula(doc, inicio, [
    ["Proyecto", ficha.Descripcion], ["Usuario", d.usuarioContacto],
    ["Vendedor", d.vendedor], ["Estatus", etiquetaStatus(ficha.Status)],
    ["Días de trabajo", ficha.Dias], ["Personal", ficha.Personal],
  ]);

  const gastoDirecto = Number(ficha.GastoDirectoPlan);
  const impuestos = gastoDirecto * (Number(ficha.ImpuestosPct) / 100);
  const subtotal1 = gastoDirecto + impuestos;
  const administrativos = subtotal1 * (Number(ficha.AdministrativosPct) / 100);
  const subtotal3 = subtotal1 + administrativos + Number(ficha.InsumosPlan);
  const financiamiento = subtotal3 * (Number(ficha.FinanciamientoPct) / 100);
  const utilidadBruta = Number(ficha.PrecioVenta) - Number(ficha.GastoTotalPlan);

  y = seccion(doc, y, "Resumen");
  y = tabla(doc, y, {
    encabezados: ["Precio de venta", "Gasto total plan", "Utilidad neta plan", "Margen plan", "Gasto real", "Margen real"],
    filas: [[
      formatoMoneda(ficha.PrecioVenta), formatoMoneda(ficha.GastoTotalPlan), formatoMoneda(ficha.UtilidadNetaPlan),
      formatoPorcentaje(ficha.MargenPlanPct),
      Number(ficha.GastoTotalReal) > 0 ? formatoMoneda(ficha.GastoTotalReal) : "Sin capturar",
      Number(ficha.GastoTotalReal) > 0 ? formatoPorcentaje(ficha.MargenRealPct) : "-",
    ]],
    derecha: [0, 1, 2, 3, 4, 5], tamano: 9,
  });

  y = seccion(doc, y, "Cadena de costeo (plan)");
  const cadena: [string, number][] = [
    ["Costo sin IVA (precio de venta)", Number(ficha.PrecioVenta)],
    ["ISR", Number(ficha.Isr)],
    ["Gasto directo", gastoDirecto],
    [`Impuestos ${formatoNumero(ficha.ImpuestosPct, 0)} %`, impuestos],
    ["Subtotal", subtotal1],
    [`Administrativos ${formatoNumero(ficha.AdministrativosPct, 0)} %`, administrativos],
    ["Insumos", Number(ficha.InsumosPlan)],
    ["Subtotal", subtotal3],
    [`Financiamiento ${formatoNumero(ficha.FinanciamientoPct, 0)} %`, financiamiento],
    ["Gasto total", Number(ficha.GastoTotalPlan)],
    ["Utilidad bruta", utilidadBruta],
    [`Comisión vendedor ${formatoNumero(ficha.ComisionPct, 0)} %`, utilidadBruta * (Number(ficha.ComisionPct) / 100)],
    ["Utilidad neta", Number(ficha.UtilidadNetaPlan)],
  ];
  const fuertes = new Set(["Gasto directo", "Gasto total", "Utilidad neta"]);
  y = tabla(doc, y, {
    filas: cadena.map(([e, v]) => [
      { content: e, styles: { fontStyle: fuertes.has(e) ? "bold" : "normal" } },
      { content: formatoMoneda(v), styles: { fontStyle: fuertes.has(e) ? "bold" : "normal" } },
    ]),
    sinEncabezado: true, theme: "striped", anchos: { 0: ANCHO_UTIL - 120, 1: 120 }, derecha: [1],
  });

  y = seccion(doc, y, "Conceptos: plan contra real");
  const porConcepto = new Map(d.conceptos.map((c) => [c.Concepto, c]));
  y = tabla(doc, y, {
    encabezados: ["Concepto", "Gasto plan", "Gasto real", "Diferencia", "Comentario"],
    filas: CONCEPTOS.map((c: Concepto) => {
      const fila = porConcepto.get(c);
      const plan = Number(fila?.GastoPlan ?? 0);
      const real = Number(fila?.GastoReal ?? 0);
      return [ETIQUETA_CONCEPTO[c], formatoMoneda(plan), real > 0 ? formatoMoneda(real) : "-", real > 0 ? formatoMoneda(real - plan) : "-", fila?.Comentario ?? ""];
    }),
    anchos: { 1: 90, 2: 90, 3: 90 }, derecha: [1, 2, 3],
  });

  y = seccion(doc, y, "Nómina del proyecto");
  y = tabla(doc, y, {
    encabezados: ["Persona", "Puesto", "Días", "Nómina/día", "IMSS/día", "Desgaste/día", "Bono", "Total"],
    filas: d.nomina.map((n) => [
      n.Nombre, n.Puesto, n.DiasPlan, formatoMoneda(n.SalarioDiario), formatoMoneda(n.ImssDiario), formatoMoneda(n.DesgasteDiario),
      formatoMoneda(n.Bono), formatoMoneda((Number(n.SalarioDiario) + Number(n.ImssDiario) + Number(n.DesgasteDiario)) * Number(n.DiasPlan) + Number(n.Bono)),
    ]),
    derecha: [2, 3, 4, 5, 6, 7], tamano: 8,
  });

  y = seccion(doc, y, "Insumos");
  y = tabla(doc, y, {
    encabezados: ["Cant.", "Concepto", "Costo plan", "Costo real", "Comentario"],
    filas: d.insumos.length > 0
      ? d.insumos.map((i) => [formatoNumero(i.Unidades, 0), i.Descripcion, formatoMoneda(i.CostoPlan), Number(i.CostoReal) > 0 ? formatoMoneda(i.CostoReal) : "-", i.Comentario ?? ""])
      : [["-", "Sin insumos: el material lo pone el cliente", "", "", ""]],
    anchos: { 0: 40, 2: 80, 3: 80, 4: 80 }, derecha: [0, 2, 3],
  });

  if (d.gastos.length > 0) {
    y = seccion(doc, y, "Gastos sueltos");
    tabla(doc, y, {
      encabezados: ["Concepto", "Fecha", "Detalle", "Importe", "Real"],
      filas: d.gastos.map((g) => [ETIQUETA_CONCEPTO[g.Concepto as Concepto] ?? g.Concepto, formatoFecha(g.Fecha), g.Descripcion ?? "", formatoMoneda(g.Cantidad), g.EsReal === 1 ? "Sí" : "Plan"]),
      anchos: { 1: 80, 3: 90, 4: 40 }, derecha: [3],
    });
  }

  return terminar(doc, `Servicios de Altura · costeo de la cotización ${ficha.NoCotizacion} · uso interno`);
}

function etiquetaStatus(status: string): string {
  return { PLANEADO: "Planeado", EN_PROCESO: "En obra", CERRADO: "Cerrado" }[status] ?? status;
}
