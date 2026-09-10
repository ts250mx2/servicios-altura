import { formatoFecha, formatoMoneda, formatoNumero } from "@/lib/formato";
import type { DatosCotizacionDoc } from "./datos";
import { ANCHO_UTIL, GRIS, NAVY, PAGINA, crearDocumento, cuadricula, limpiar, parrafo, seccion, tabla, terminar } from "./pdf-base";

/** La cotización para el cliente: partidas, totales, condiciones y firma. Sin datos de costo. */
export async function pdfCotizacion(d: DatosCotizacionDoc): Promise<Uint8Array> {
  const { ficha } = d;
  const base = Number(ficha.Subtotal) - Number(ficha.Descuento);
  const { doc, y: inicio } = await crearDocumento({
    titulo: "Cotización",
    subtitulo: "Trabajos verticales · fachadas, cristales, impermeabilización y sellados",
    referencia: [`COTIZACIÓN ${ficha.NoCotizacion}`, `FECHA ${formatoFecha(ficha.Fecha)}`, `VIGENCIA ${ficha.Vigencia} DÍAS`],
  });

  let y = cuadricula(doc, inicio, [
    ["Cliente", ficha.Cliente], ["Atención", ficha.Contacto],
    ["Correo", ficha.Correo], ["Folio de levantamiento", ficha.Folio ?? "-"],
    ["Vendedor", ficha.Vendedor], ["Estatus", etiquetaStatus(ficha.Status)],
  ]);

  y = seccion(doc, y, "Proyecto");
  y = parrafo(doc, y, ficha.Descripcion, { tamano: 9.5 });

  y = seccion(doc, y, "Partidas");
  y = tabla(doc, y, {
    encabezados: ["#", "Concepto", "Unidad", "Cant.", "Precio unitario", "Importe"],
    filas: d.partidas.map((p) => [
      p.Orden, p.Concepto, p.Unidad, formatoNumero(p.Cantidad), formatoMoneda(p.PrecioUnitario), formatoMoneda(p.Importe),
    ]),
    anchos: { 0: 24, 2: 50, 3: 46, 4: 86, 5: 86 }, derecha: [3, 4, 5],
  });

  const totales: [string, string][] = [
    ["Subtotal", formatoMoneda(ficha.Subtotal)],
    ...(Number(ficha.Descuento) > 0 ? [[`Descuento ${formatoNumero(ficha.DescuentoPct)} %`, `-${formatoMoneda(ficha.Descuento)}`] as [string, string]] : []),
    [`IVA ${formatoNumero(ficha.IvaPct, 0)} %`, formatoMoneda(ficha.Iva)],
    ["Total", formatoMoneda(ficha.Total)],
  ];
  if (Number(ficha.Descuento) > 0) totales.splice(2, 0, ["Base", formatoMoneda(base)]);
  y = tabla(doc, y, {
    filas: totales.map(([e, v], i) => [
      { content: e, styles: { fontStyle: i === totales.length - 1 ? "bold" : "normal", halign: "right" } },
      { content: v, styles: { fontStyle: i === totales.length - 1 ? "bold" : "normal" } },
    ]),
    sinEncabezado: true, theme: "plain", tamano: 9.5,
    anchos: { 0: ANCHO_UTIL - 110, 1: 110 }, derecha: [1],
  });

  y = seccion(doc, y, "Condiciones");
  y = parrafo(
    doc, y,
    ficha.Condiciones ||
      `Precios en pesos mexicanos, más IVA. Vigencia de ${ficha.Vigencia} días a partir de la fecha de emisión. Incluye personal certificado para trabajos en altura, equipo de protección y líneas de vida. No incluye materiales marcados como "lo pone el cliente".`,
    { color: GRIS },
  );

  if (y > PAGINA.alto - 130) {
    doc.addPage();
    y = PAGINA.margen;
  }
  y += 30;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(PAGINA.margen, y, PAGINA.margen + 200, y);
  doc.line(PAGINA.ancho - PAGINA.margen - 200, y, PAGINA.ancho - PAGINA.margen, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text(limpiar(ficha.Vendedor ? `${ficha.Vendedor} · Servicios de Altura` : "Servicios de Altura"), PAGINA.margen, y + 12);
  doc.text(limpiar(ficha.AutorizadoPor ? `Autoriza: ${ficha.AutorizadoPor}` : "Autoriza el cliente"), PAGINA.ancho - PAGINA.margen, y + 12, { align: "right" });

  return terminar(doc, `Servicios de Altura · cotización ${ficha.NoCotizacion} · ${ficha.Cliente}`);
}

function etiquetaStatus(status: string): string {
  return { BORRADOR: "Borrador", ENVIADA: "Enviada", AUTORIZADA: "Autorizada", RECHAZADA: "Rechazada", CANCELADA: "Cancelada" }[status] ?? status;
}
