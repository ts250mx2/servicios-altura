import { leerSesion } from "@/lib/auth/sesion";
import { costeoParaExcel } from "@/lib/documentos/costeo-para-excel";
import { datosCosteo, datosCotizacion, datosLevantamiento } from "@/lib/documentos/datos";
import { excelCosteo } from "@/lib/documentos/excel-costeo";
import { excelCotizacion } from "@/lib/documentos/excel-cotizacion";
import { excelLevantamiento } from "@/lib/documentos/excel-levantamiento";
import { pdfCosteo } from "@/lib/documentos/pdf-costeo";
import { pdfCotizacion } from "@/lib/documentos/pdf-cotizacion";
import { pdfLevantamiento } from "@/lib/documentos/pdf-levantamiento";

const TIPOS = new Set(["levantamiento", "cotizacion", "costeo"]);
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * `GET /api/documentos/{levantamiento|cotizacion|costeo}/{id}/{pdf|excel}`.
 * El PDF se abre en el navegador; el Excel se descarga.
 */
export async function GET(
  _peticion: Request,
  contexto: { params: Promise<{ tipo: string; id: string; formato: string }> },
) {
  const sesion = await leerSesion();
  if (!sesion) return new Response("Sesión requerida", { status: 401 });

  const { tipo, id, formato } = await contexto.params;
  const numero = Number(id);
  if (!TIPOS.has(tipo) || !Number.isInteger(numero) || numero <= 0 || !["pdf", "excel"].includes(formato)) {
    return new Response("No encontrado", { status: 404 });
  }

  try {
    const documento = await generar(tipo, numero, formato as "pdf" | "excel");
    if (!documento) return new Response("No encontrado", { status: 404 });
    const esPdf = formato === "pdf";
    const nombre = `${documento.nombre}.${esPdf ? "pdf" : "xlsx"}`;
    // Las cabeceras HTTP son ASCII: va un nombre plano y, aparte, el real codificado (RFC 5987).
    const ascii = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
    return new Response(Buffer.from(documento.bytes), {
      headers: {
        "Content-Type": esPdf ? "application/pdf" : MIME_XLSX,
        "Content-Disposition": `${esPdf ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`No se pudo generar ${formato} de ${tipo} ${numero}:`, error);
    return new Response("No se pudo generar el documento.", { status: 500 });
  }
}

async function generar(tipo: string, id: number, formato: "pdf" | "excel"): Promise<{ bytes: Uint8Array; nombre: string } | null> {
  if (tipo === "levantamiento") {
    const d = await datosLevantamiento(id);
    if (!d) return null;
    return { bytes: formato === "pdf" ? await pdfLevantamiento(d) : await excelLevantamiento(d), nombre: `Levantamiento-${d.ficha.Folio}` };
  }
  if (tipo === "cotizacion") {
    const d = await datosCotizacion(id);
    if (!d) return null;
    return { bytes: formato === "pdf" ? await pdfCotizacion(d) : await excelCotizacion(d), nombre: `Cotizacion-${d.ficha.NoCotizacion}` };
  }
  const d = await datosCosteo(id);
  if (!d) return null;
  return {
    bytes: formato === "pdf" ? await pdfCosteo(d) : await excelCosteo(costeoParaExcel(d)),
    nombre: formato === "pdf" ? `Costeo-${d.ficha.NoCotizacion}` : `NoC. ${d.ficha.NoCotizacion} ${d.ficha.Descripcion.slice(0, 60).replace(/[\\/:*?"<>|]/g, " ")}`,
  };
}
