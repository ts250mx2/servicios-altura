import type { DatosLevantamientoDoc } from "./datos";
import {
  FECHA, anchos, bandaMarca, bytesDe, cuerpo, encabezados, nuevoLibro, pares, preparar, titulo,
} from "./excel-base";

const SI_NO = (v: number) => (v === 1 ? "Sí" : "No");
const COLUMNAS = 6;

/** La hoja de levantamiento en una sola pestaña, sección por sección, con formato de la casa. */
export async function excelLevantamiento(d: DatosLevantamientoDoc): Promise<Uint8Array> {
  const libro = nuevoLibro();
  const hoja = libro.addWorksheet(`Levantamiento ${d.ficha.Folio}`);
  anchos(hoja, [24, 62, 14, 14, 14, 14]);
  const f = d.ficha;

  let fila = bandaMarca(
    hoja,
    `LEVANTAMIENTO DE PROYECTO · FOLIO ${f.Folio}`,
    `${f.Cliente}${d.cadena.cotizacion ? ` · Cotización ${d.cadena.cotizacion.no}` : ""}`,
    COLUMNAS,
  );

  fila = titulo(hoja, fila, "DATOS", COLUMNAS);
  const fechaLev = new Date(`${String(f.Fecha).slice(0, 10)}T12:00:00`);
  fila = pares(hoja, fila, [
    ["No. cotización", d.cadena.cotizacion?.no ?? "-"],
    ["Folio", f.Folio],
    ["Fecha", fechaLev],
    ["Proyecto", f.Proyecto],
    ["Área de trabajo", f.AreaTrabajo ?? ""],
    ["Cliente", f.Cliente],
    ["Usuario", f.UsuarioContacto ?? ""],
    ["Correo usuario", f.CorreoUsuario ?? ""],
    ["Responsable", f.Elaboro ?? ""],
    ["Nivel de riesgo", f.NivelRiesgo],
    ["Estatus", f.Status],
  ]);
  hoja.getCell(fila - 9, 2).numFmt = FECHA;
  hoja.mergeCells(fila - 8, 2, fila - 8, COLUMNAS); // proyecto a lo ancho

  fila = titulo(hoja, fila + 1, "TRABAJO A REALIZAR", COLUMNAS);
  fila = encabezados(hoja, fila, ["#", "Descripción", "Metros"]);
  const inicioAct = fila;
  for (const a of d.actividades) {
    hoja.getCell(fila, 1).value = a.Orden;
    hoja.getCell(fila, 1).alignment = { horizontal: "center" };
    hoja.getCell(fila, 2).value = a.Descripcion;
    hoja.getCell(fila, 3).value = Number(a.Metros);
    hoja.getCell(fila, 3).numFmt = "#,##0.00";
    fila += 1;
  }
  cuerpo(hoja, inicioAct, fila - 1, 1, 3);
  if (f.Observaciones) {
    fila = pares(hoja, fila + 1, [["Observaciones", f.Observaciones]]);
    hoja.mergeCells(fila - 1, 2, fila - 1, COLUMNAS);
  }

  fila = titulo(hoja, fila + 1, "CANTIDAD DE PERSONAL", COLUMNAS);
  fila = encabezados(hoja, fila, ["", ...d.puestos.map((p) => p.Abreviatura), "Nivel riesgo"]);
  const lineas = d.puestos.map((p) => d.personal.find((l) => l.IdPuesto === p.IdPuesto));
  const inicioPer = fila;
  const filasPersonal: [string, (string | number)[], string][] = [
    ["Cantidad", lineas.map((l) => (l ? l.Cantidad : "-")), f.NivelRiesgo],
    ["T. extra", lineas.map((l) => (l ? SI_NO(l.TiempoExtra) : "-")), ""],
    ["Bono", lineas.map((l) => (l ? SI_NO(l.Bono) : "-")), ""],
  ];
  for (const [etiqueta, valores, riesgo] of filasPersonal) {
    hoja.getCell(fila, 1).value = etiqueta;
    hoja.getCell(fila, 1).font = { bold: true };
    valores.forEach((v, i) => {
      hoja.getCell(fila, i + 2).value = v;
      hoja.getCell(fila, i + 2).alignment = { horizontal: "center" };
    });
    hoja.getCell(fila, valores.length + 2).value = riesgo;
    hoja.getCell(fila, valores.length + 2).alignment = { horizontal: "center" };
    fila += 1;
  }
  cuerpo(hoja, inicioPer, fila - 1, 1, d.puestos.length + 2);

  for (const [nombre, esHerramental] of [["INSUMOS", 0], ["HERRAMENTAL", 1]] as const) {
    fila = titulo(hoja, fila + 1, nombre, COLUMNAS);
    fila = encabezados(hoja, fila, ["Cantidad", "Descripción", "Aplica"]);
    const inicio = fila;
    const lista = d.insumos.filter((x) => x.EsHerramental === esHerramental);
    if (lista.length === 0) {
      hoja.getCell(fila, 2).value = esHerramental ? "Sin herramental" : "Sin insumos: el material lo pone el cliente";
      fila += 1;
    }
    for (const i of lista) {
      hoja.getCell(fila, 1).value = Number(i.Cantidad);
      hoja.getCell(fila, 1).alignment = { horizontal: "center" };
      hoja.getCell(fila, 2).value = i.Descripcion;
      hoja.getCell(fila, 3).value = i.Aplica === 1 ? "Sí" : "NO APLICAR";
      hoja.getCell(fila, 3).alignment = { horizontal: "center" };
      fila += 1;
    }
    cuerpo(hoja, inicio, fila - 1, 1, 3);
  }

  fila = titulo(hoja, fila + 1, "DÍAS Y CONDICIONES", COLUMNAS);
  fila = encabezados(hoja, fila, ["Días", "Trabajo tiempo normal", "Trabajo tiempo extra", "Aplica cena", "Aplica bono"]);
  [f.Dias, SI_NO(f.TrabajoNormal), SI_NO(f.TrabajoExtra), SI_NO(f.AplicaCena), SI_NO(f.AplicaBono)]
    .forEach((v, i) => {
      hoja.getCell(fila, i + 1).value = v;
      hoja.getCell(fila, i + 1).alignment = { horizontal: "center" };
    });
  cuerpo(hoja, fila, fila, 1, 5);
  fila += 2;

  fila = encabezados(hoja, fila, ["Elaboró", "Recibió", "Revisó"]);
  [f.Elaboro ?? "", f.Recibio ?? "", f.Reviso ?? ""].forEach((v, i) => {
    hoja.getCell(fila, i + 1).value = v;
    hoja.getCell(fila, i + 1).alignment = { horizontal: "center", vertical: "bottom" };
  });
  hoja.getRow(fila).height = 48;
  cuerpo(hoja, fila, fila, 1, 3);

  preparar(hoja, 3, "portrait");
  return bytesDe(libro);
}
