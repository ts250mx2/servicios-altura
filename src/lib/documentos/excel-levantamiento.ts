import type { DatosLevantamientoDoc } from "./datos";
import { anchos, bytesDe, encabezados, nuevoLibro, pares, titulo } from "./excel-base";

const SI_NO = (v: number) => (v === 1 ? "Sí" : "No");

/** La hoja de levantamiento en una sola pestaña, sección por sección. */
export async function excelLevantamiento(d: DatosLevantamientoDoc): Promise<Uint8Array> {
  const libro = nuevoLibro();
  const hoja = libro.addWorksheet(`Levantamiento ${d.ficha.Folio}`);
  anchos(hoja, [22, 60, 14, 14, 14, 14]);
  const f = d.ficha;

  let fila = titulo(hoja, 1, `LEVANTAMIENTO DE PROYECTO · FOLIO ${f.Folio}`);
  fila = pares(hoja, fila + 1, [
    ["No. cotización", d.cadena.cotizacion?.no ?? "-"],
    ["Folio", f.Folio],
    ["Fecha", f.Fecha],
    ["Proyecto", f.Proyecto],
    ["Área de trabajo", f.AreaTrabajo ?? ""],
    ["Cliente", f.Cliente],
    ["Usuario", f.UsuarioContacto ?? ""],
    ["Correo usuario", f.CorreoUsuario ?? ""],
    ["Responsable", f.Elaboro ?? ""],
    ["Nivel de riesgo", f.NivelRiesgo],
    ["Estatus", f.Status],
  ]);

  fila = titulo(hoja, fila + 1, "TRABAJO A REALIZAR");
  fila = encabezados(hoja, fila, ["#", "Descripción", "Metros"]);
  for (const a of d.actividades) {
    hoja.getCell(fila, 1).value = a.Orden;
    hoja.getCell(fila, 2).value = a.Descripcion;
    hoja.getCell(fila, 2).alignment = { wrapText: true, vertical: "top" };
    hoja.getCell(fila, 3).value = Number(a.Metros);
    fila += 1;
  }
  if (f.Observaciones) {
    fila = pares(hoja, fila + 1, [["Observaciones", f.Observaciones]]);
  }

  fila = titulo(hoja, fila + 1, "CANTIDAD DE PERSONAL");
  fila = encabezados(hoja, fila, ["", ...d.puestos.map((p) => p.Abreviatura), "Nivel riesgo"]);
  const lineas = d.puestos.map((p) => d.personal.find((l) => l.IdPuesto === p.IdPuesto));
  const filasPersonal: [string, (string | number)[], string][] = [
    ["Cantidad", lineas.map((l) => (l ? l.Cantidad : "-")), f.NivelRiesgo],
    ["T. extra", lineas.map((l) => (l ? SI_NO(l.TiempoExtra) : "-")), ""],
    ["Bono", lineas.map((l) => (l ? SI_NO(l.Bono) : "-")), ""],
  ];
  for (const [etiqueta, valores, riesgo] of filasPersonal) {
    hoja.getCell(fila, 1).value = etiqueta;
    valores.forEach((v, i) => { hoja.getCell(fila, i + 2).value = v; });
    hoja.getCell(fila, valores.length + 2).value = riesgo;
    fila += 1;
  }

  for (const [nombre, esHerramental] of [["INSUMOS", 0], ["HERRAMENTAL", 1]] as const) {
    fila = titulo(hoja, fila + 1, nombre);
    fila = encabezados(hoja, fila, ["Cantidad", "Descripción", "Aplica"]);
    for (const i of d.insumos.filter((x) => x.EsHerramental === esHerramental)) {
      hoja.getCell(fila, 1).value = Number(i.Cantidad);
      hoja.getCell(fila, 2).value = i.Descripcion;
      hoja.getCell(fila, 3).value = i.Aplica === 1 ? "Sí" : "NO APLICAR";
      fila += 1;
    }
  }

  fila = titulo(hoja, fila + 1, "DÍAS");
  fila = encabezados(hoja, fila, ["Días", "Trabajo tiempo normal", "Trabajo tiempo extra", "Aplica cena", "Aplica bono"]);
  [f.Dias, SI_NO(f.TrabajoNormal), SI_NO(f.TrabajoExtra), SI_NO(f.AplicaCena), SI_NO(f.AplicaBono)]
    .forEach((v, i) => { hoja.getCell(fila, i + 1).value = v; });
  fila += 2;
  fila = encabezados(hoja, fila, ["Elaboró", "Recibió", "Revisó"]);
  [f.Elaboro ?? "", f.Recibio ?? "", f.Reviso ?? ""].forEach((v, i) => { hoja.getCell(fila, i + 1).value = v; });

  return bytesDe(libro);
}
