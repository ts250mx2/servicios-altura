import { leerUpload } from "@/lib/importacion/archivos";
import { formatoFecha, formatoNumero } from "@/lib/formato";
import type { DatosLevantamientoDoc } from "./datos";
import { PAGINA, crearDocumento, cuadricula, parrafo, seccion, si, tabla, terminar } from "./pdf-base";

/** La hoja de levantamiento, con las mismas secciones que la de siempre, más las fotos al final. */
export async function pdfLevantamiento(d: DatosLevantamientoDoc): Promise<Uint8Array> {
  const { ficha, cadena } = d;
  const { doc, y: inicio } = await crearDocumento({
    titulo: "Levantamiento de proyecto",
    subtitulo: ficha.Cliente,
    referencia: [
      `FOLIO ${ficha.Folio}`,
      cadena.cotizacion ? `COTIZACIÓN ${cadena.cotizacion.no}` : "SIN COTIZACIÓN",
      `FECHA ${formatoFecha(ficha.Fecha)}`,
    ],
  });

  let y = cuadricula(doc, inicio, [
    ["Proyecto", ficha.Proyecto], ["Área de trabajo", ficha.AreaTrabajo],
    ["Cliente", ficha.Cliente], ["Usuario", ficha.UsuarioContacto],
    ["Correo usuario", ficha.CorreoUsuario], ["Responsable", ficha.Elaboro],
    ["Nivel de riesgo", ficha.NivelRiesgo], ["Días de trabajo", ficha.Dias],
  ]);

  y = seccion(doc, y, "Trabajo a realizar");
  y = tabla(doc, y, {
    encabezados: ["#", "Descripción", "Metros"],
    filas: d.actividades.map((a) => [a.Orden, a.Descripcion, Number(a.Metros) > 0 ? formatoNumero(a.Metros) : "0"]),
    anchos: { 0: 26, 2: 60 }, derecha: [2],
  });
  if (ficha.Observaciones) {
    y = seccion(doc, y, "Observaciones del trabajo");
    y = parrafo(doc, y, ficha.Observaciones);
  }

  y = seccion(doc, y, "Cantidad de personal");
  const puestos = d.puestos.map((p) => ({ p, linea: d.personal.find((l) => l.IdPuesto === p.IdPuesto) }));
  y = tabla(doc, y, {
    encabezados: ["", ...puestos.map((x) => x.p.Abreviatura), "Nivel riesgo"],
    filas: [
      ["Cantidad", ...puestos.map((x) => (x.linea ? String(x.linea.Cantidad) : "-")), ficha.NivelRiesgo],
      ["T. extra", ...puestos.map((x) => (x.linea ? si(x.linea.TiempoExtra) : "-")), ""],
      ["Bono", ...puestos.map((x) => (x.linea ? si(x.linea.Bono) : "-")), ""],
    ],
    derecha: puestos.map((_, i) => i + 1),
  });

  const consumibles = d.insumos.filter((i) => i.EsHerramental === 0);
  const herramental = d.insumos.filter((i) => i.EsHerramental === 1);
  y = seccion(doc, y, "Insumos");
  y = tabla(doc, y, {
    encabezados: ["Cantidad", "Descripción"],
    filas: consumibles.length > 0
      ? consumibles.map((i) => [formatoNumero(i.Cantidad, 0), i.Aplica === 0 ? `${i.Descripcion} (NO APLICAR)` : i.Descripcion])
      : [["-", "Sin insumos: el material lo pone el cliente"]],
    anchos: { 0: 70 }, derecha: [0],
  });
  y = seccion(doc, y, "Herramental");
  y = tabla(doc, y, {
    encabezados: ["Cantidad", "Descripción"],
    filas: herramental.length > 0 ? herramental.map((i) => [formatoNumero(i.Cantidad, 0), i.Descripcion]) : [["-", "Sin herramental"]],
    anchos: { 0: 70 }, derecha: [0],
  });

  y = seccion(doc, y, "Días y condiciones");
  y = tabla(doc, y, {
    encabezados: ["Días", "Trabajo tiempo normal", "Trabajo tiempo extra", "Aplica cena", "Aplica bono"],
    filas: [[String(ficha.Dias), si(ficha.TrabajoNormal), si(ficha.TrabajoExtra), si(ficha.AplicaCena), si(ficha.AplicaBono)]],
  });

  if (y > PAGINA.alto - 120) {
    doc.addPage();
    y = PAGINA.margen;
  }
  y = tabla(doc, y + 20, {
    encabezados: ["Elaboró", "Recibió", "Revisó"],
    filas: [[
      `\n\n${ficha.Elaboro ?? ""}`, `\n\n${ficha.Recibio ?? ""}`, `\n\n${ficha.Reviso ?? ""}`,
    ]],
    theme: "grid",
  });

  await agregarEvidencias(doc, d);
  return terminar(doc, `Servicios de Altura · levantamiento ${ficha.Folio} · ${ficha.Cliente}`);
}

/** Cada foto en su página, ajustada al área útil y con su título. */
async function agregarEvidencias(doc: Awaited<ReturnType<typeof crearDocumento>>["doc"], d: DatosLevantamientoDoc): Promise<void> {
  for (const [i, e] of d.evidencias.entries()) {
    const segmentos = e.Archivo.replace(/^\/uploads\//, "").split("/");
    const archivo = await leerUpload(segmentos);
    if (!archivo || archivo.tipo !== "image/jpeg") continue;
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Evidencia ${i + 1}${e.Titulo && e.Titulo !== `Evidencia ${i + 1}` ? ` · ${e.Titulo}` : ""}`, PAGINA.margen, PAGINA.margen);
    const base64 = Buffer.from(archivo.datos).toString("base64");
    const props = doc.getImageProperties(`data:image/jpeg;base64,${base64}`);
    const maxAncho = PAGINA.ancho - PAGINA.margen * 2;
    const maxAlto = PAGINA.alto - PAGINA.margen * 2 - 40;
    const escala = Math.min(maxAncho / props.width, maxAlto / props.height);
    const ancho = props.width * escala;
    const alto = props.height * escala;
    doc.addImage(base64, "JPEG", PAGINA.margen + (maxAncho - ancho) / 2, PAGINA.margen + 16, ancho, alto);
  }
}
