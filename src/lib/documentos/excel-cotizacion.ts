import type { DatosCotizacionDoc } from "./datos";
import { MONEDA, anchos, bytesDe, encabezados, moneda, nuevoLibro, pares, titulo } from "./excel-base";

/** La cotización en una pestaña: datos del cliente, partidas y totales con fórmulas vivas. */
export async function excelCotizacion(d: DatosCotizacionDoc): Promise<Uint8Array> {
  const libro = nuevoLibro();
  const f = d.ficha;
  const hoja = libro.addWorksheet(`Cotización ${f.NoCotizacion}`);
  anchos(hoja, [6, 64, 10, 10, 16, 16]);

  let fila = titulo(hoja, 1, `COTIZACIÓN ${f.NoCotizacion} · SERVICIOS DE ALTURA`);
  fila = pares(hoja, fila + 1, [
    ["Cliente", f.Cliente],
    ["Atención", f.Contacto ?? ""],
    ["Correo", f.Correo ?? ""],
    ["Fecha", f.Fecha],
    ["Vigencia (días)", f.Vigencia],
    ["Folio de levantamiento", f.Folio ?? "-"],
    ["Vendedor", f.Vendedor ?? ""],
    ["Estatus", f.Status],
    ["Proyecto", f.Descripcion],
  ]);
  hoja.getCell(fila - 1, 2).alignment = { wrapText: true, vertical: "top" };

  fila = titulo(hoja, fila + 1, "PARTIDAS");
  fila = encabezados(hoja, fila, ["#", "Concepto", "Unidad", "Cantidad", "Precio unitario", "Importe"]);
  const primera = fila;
  for (const p of d.partidas) {
    hoja.getCell(fila, 1).value = p.Orden;
    hoja.getCell(fila, 2).value = p.Concepto;
    hoja.getCell(fila, 2).alignment = { wrapText: true, vertical: "top" };
    hoja.getCell(fila, 3).value = p.Unidad;
    hoja.getCell(fila, 4).value = Number(p.Cantidad);
    moneda(hoja, fila, 5, Number(p.PrecioUnitario));
    moneda(hoja, fila, 6, { formula: `D${fila}*E${fila}`, result: Number(p.Importe) });
    fila += 1;
  }
  const ultima = fila - 1;
  fila += 1;
  const etiqueta = (texto: string, valor: unknown, negrita = false) => {
    hoja.getCell(fila, 5).value = texto;
    hoja.getCell(fila, 5).font = { bold: negrita };
    hoja.getCell(fila, 6).value = valor as never;
    hoja.getCell(fila, 6).numFmt = MONEDA;
    hoja.getCell(fila, 6).font = { bold: negrita };
    fila += 1;
  };
  const filaSubtotal = fila;
  etiqueta("Subtotal", ultima >= primera ? { formula: `SUM(F${primera}:F${ultima})`, result: Number(f.Subtotal) } : Number(f.Subtotal));
  const filaDescuento = fila;
  etiqueta(`Descuento ${Number(f.DescuentoPct)} %`, { formula: `F${filaSubtotal}*${Number(f.DescuentoPct) / 100}`, result: Number(f.Descuento) });
  const filaBase = fila;
  etiqueta("Base", { formula: `F${filaSubtotal}-F${filaDescuento}`, result: Number(f.Subtotal) - Number(f.Descuento) });
  const filaIva = fila;
  etiqueta(`IVA ${Number(f.IvaPct)} %`, { formula: `F${filaBase}*${Number(f.IvaPct) / 100}`, result: Number(f.Iva) });
  etiqueta("Total", { formula: `F${filaBase}+F${filaIva}`, result: Number(f.Total) }, true);

  if (f.Condiciones) {
    fila = titulo(hoja, fila + 1, "CONDICIONES");
    hoja.mergeCells(fila, 1, fila, 6);
    hoja.getCell(fila, 1).value = f.Condiciones;
    hoja.getCell(fila, 1).alignment = { wrapText: true, vertical: "top" };
    hoja.getRow(fila).height = 60;
  }

  return bytesDe(libro);
}
