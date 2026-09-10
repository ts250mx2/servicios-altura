import type { DatosCotizacionDoc } from "./datos";
import {
  FECHA, MONEDA, RELLENO_TOTAL, anchos, bandaMarca, bytesDe, cuerpo, encabezados, moneda, nuevoLibro, pares, preparar, titulo,
} from "./excel-base";

const COLUMNAS = 6;

/** La cotización para el cliente: datos, partidas y totales con fórmulas vivas, con formato de la casa. */
export async function excelCotizacion(d: DatosCotizacionDoc): Promise<Uint8Array> {
  const libro = nuevoLibro();
  const f = d.ficha;
  const hoja = libro.addWorksheet(`Cotización ${f.NoCotizacion}`);
  anchos(hoja, [8, 64, 10, 11, 17, 17]);

  let fila = bandaMarca(hoja, `COTIZACIÓN ${f.NoCotizacion}`, "Servicios de Altura · trabajos verticales", COLUMNAS);

  fila = titulo(hoja, fila, "DATOS", COLUMNAS);
  const inicioDatos = fila;
  fila = pares(hoja, fila, [
    ["Cliente", f.Cliente],
    ["Atención", f.Contacto ?? ""],
    ["Correo", f.Correo ?? ""],
    ["Fecha", new Date(`${String(f.Fecha).slice(0, 10)}T12:00:00`)],
    ["Vigencia (días)", f.Vigencia],
    ["Folio de levantamiento", f.Folio ?? "-"],
    ["Vendedor", f.Vendedor ?? ""],
    ["Estatus", f.Status],
    ["Proyecto", f.Descripcion],
  ]);
  hoja.getCell(inicioDatos + 3, 2).numFmt = FECHA;
  hoja.mergeCells(fila - 1, 2, fila - 1, COLUMNAS);

  fila = titulo(hoja, fila + 1, "PARTIDAS", COLUMNAS);
  fila = encabezados(hoja, fila, ["#", "Concepto", "Unidad", "Cantidad", "Precio unitario", "Importe"]);
  const primera = fila;
  for (const p of d.partidas) {
    hoja.getCell(fila, 1).value = p.Orden;
    hoja.getCell(fila, 1).alignment = { horizontal: "center" };
    hoja.getCell(fila, 2).value = p.Concepto;
    hoja.getCell(fila, 3).value = p.Unidad;
    hoja.getCell(fila, 3).alignment = { horizontal: "center" };
    hoja.getCell(fila, 4).value = Number(p.Cantidad);
    hoja.getCell(fila, 4).numFmt = "#,##0.00";
    moneda(hoja, fila, 5, Number(p.PrecioUnitario));
    moneda(hoja, fila, 6, { formula: `D${fila}*E${fila}`, result: Number(p.Importe) });
    fila += 1;
  }
  const ultima = fila - 1;
  cuerpo(hoja, primera, ultima, 1, COLUMNAS);
  fila += 1;

  const renglon = (texto: string, valor: unknown, fuerte = false) => {
    const e = hoja.getCell(fila, 5);
    e.value = texto;
    e.font = { bold: fuerte, color: { argb: fuerte ? "FF051622" : "FF63808F" } };
    e.alignment = { horizontal: "right" };
    const v = hoja.getCell(fila, 6);
    v.value = valor as never;
    v.numFmt = MONEDA;
    v.font = { bold: fuerte };
    if (fuerte) { e.fill = RELLENO_TOTAL; v.fill = RELLENO_TOTAL; }
    fila += 1;
  };
  const filaSubtotal = fila;
  renglon("Subtotal", ultima >= primera ? { formula: `SUM(F${primera}:F${ultima})`, result: Number(f.Subtotal) } : Number(f.Subtotal));
  const filaDescuento = fila;
  renglon(`Descuento ${Number(f.DescuentoPct)} %`, { formula: `F${filaSubtotal}*${Number(f.DescuentoPct) / 100}`, result: Number(f.Descuento) });
  const filaBase = fila;
  renglon("Base", { formula: `F${filaSubtotal}-F${filaDescuento}`, result: Number(f.Subtotal) - Number(f.Descuento) });
  const filaIva = fila;
  renglon(`IVA ${Number(f.IvaPct)} %`, { formula: `F${filaBase}*${Number(f.IvaPct) / 100}`, result: Number(f.Iva) });
  renglon("TOTAL", { formula: `F${filaBase}+F${filaIva}`, result: Number(f.Total) }, true);

  fila = titulo(hoja, fila + 1, "CONDICIONES", COLUMNAS);
  hoja.mergeCells(fila, 1, fila, COLUMNAS);
  hoja.getCell(fila, 1).value =
    f.Condiciones ||
    `Precios en pesos mexicanos, más IVA. Vigencia de ${f.Vigencia} días a partir de la fecha de emisión. Incluye personal certificado para trabajos en altura, equipo de protección y líneas de vida.`;
  hoja.getCell(fila, 1).alignment = { wrapText: true, vertical: "top" };
  hoja.getRow(fila).height = 64;

  preparar(hoja, 3, "portrait");
  return bytesDe(libro);
}
