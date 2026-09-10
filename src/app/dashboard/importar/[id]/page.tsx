import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TituloPagina } from "@/components/layout/Cascaron";
import { BotonDescartar } from "@/components/importacion/BotonDescartar";
import { ResumenImportacion } from "@/components/importacion/ResumenImportacion";
import { RevisionCosteo } from "@/components/importacion/RevisionCosteo";
import { AsistenteCaptura } from "@/components/levantamientos/AsistenteCaptura";
import { Boton, Carta } from "@/components/ui/Basicos";
import {
  clientes, insumos, parametros, puestos, siguientesFolios, vendedores,
} from "@/lib/consultas/catalogos";
import { importacionPorId, type ImportacionFila } from "@/lib/consultas/importaciones";
import { levantamientoPorFolio } from "@/lib/consultas/levantamientos";
import { urlImportacion } from "@/lib/importacion/archivos";
import { prepararCosteo } from "@/lib/importacion/excel/preparar";
import type { LevantamientoLigado } from "@/lib/importacion/excel/revision";
import { PaqueteImportacionExcel } from "@/lib/importacion/excel/tipos";
import { prepararRevision } from "@/lib/importacion/preparar";
import { PaqueteImportacion } from "@/lib/importacion/tipos";

export const dynamic = "force-dynamic";

/**
 * Pantalla de revisión. PDF: el asistente de captura de siempre, ya lleno con lo
 * leído. Excel: la cotización y el costeo editables con el cuadre a la vista.
 * Al guardar, la importación queda APLICADA y ligada a lo que generó.
 */
export default async function RevisarImportacion(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const idImportacion = Number(id);
  if (!Number.isInteger(idImportacion) || idImportacion <= 0) notFound();

  const importacion = await importacionPorId(idImportacion);
  if (!importacion) notFound();
  if (importacion.Estado === "APLICADA") {
    if (importacion.Tipo === "EXCEL" && importacion.IdCosteo) redirect(`/dashboard/costeos/${importacion.IdCosteo}`);
    if (importacion.IdLevantamiento) redirect(`/dashboard/levantamientos/${importacion.IdLevantamiento}`);
  }

  if (importacion.Estado !== "REVISION") return <SinRevision importacion={importacion} />;
  if (importacion.Tipo === "EXCEL") return <RevisionExcel importacion={importacion} />;
  return <RevisionPdf importacion={importacion} />;
}

// ── PDF de levantamiento ────────────────────────────────────────────────────

async function RevisionPdf({ importacion }: { importacion: ImportacionFila }) {
  const paquete = leerJson(importacion.JsonExtraido, PaqueteImportacion);
  if (!paquete) return <SinRevision importacion={importacion} />;

  const [listaClientes, listaPuestos, listaInsumos, config, folios] = await Promise.all([
    clientes(), puestos(), insumos(), parametros(), siguientesFolios(),
  ]);
  const { inicial, avisos } = prepararRevision(paquete.datos, {
    clientes: listaClientes, puestos: listaPuestos, insumos: listaInsumos,
  });
  const folio = paquete.datos.folio ?? folios.folio;
  const noCotizacion = paquete.datos.noCotizacion ?? folios.noCotizacion;

  return (
    <>
      <TituloPagina
        titulo="Revisar importación"
        descripcion={`Folio ${folio} · cotización ${noCotizacion} · ${importacion.Archivo}`}
        accion={<Volver />}
      />
      <ResumenImportacion
        idImportacion={importacion.IdImportacion}
        archivo={importacion.Archivo}
        urlOriginal={urlImportacion(importacion.IdImportacion, "original.pdf")}
        avisos={avisos}
        evidencias={paquete.evidencias}
      />
      <AsistenteCaptura
        clientes={listaClientes}
        puestos={listaPuestos}
        insumos={listaInsumos}
        folio={folio}
        noCotizacion={noCotizacion}
        parametros={config}
        modoCampo={false}
        inicial={inicial}
        idImportacion={importacion.IdImportacion}
      />
    </>
  );
}

// ── Excel de costeo ─────────────────────────────────────────────────────────

async function RevisionExcel({ importacion }: { importacion: ImportacionFila }) {
  const paquete = leerJson(importacion.JsonExtraido, PaqueteImportacionExcel);
  if (!paquete) return <SinRevision importacion={importacion} />;

  const [listaClientes, listaPuestos, listaInsumos, listaVendedores, config, folios, levantamiento] =
    await Promise.all([
      clientes(), puestos(), insumos(), vendedores(), parametros(), siguientesFolios(),
      paquete.datos.folio !== null ? levantamientoPorFolio(paquete.datos.folio) : Promise.resolve(null),
    ]);
  const ligado: LevantamientoLigado | null = levantamiento
    ? {
        idLevantamiento: levantamiento.IdLevantamiento, folio: levantamiento.Folio,
        proyecto: levantamiento.Proyecto, cliente: levantamiento.Cliente, noCotizacion: levantamiento.NoCotizacion,
      }
    : null;
  const { inicial, avisos, referencia } = prepararCosteo(
    paquete.datos,
    { clientes: listaClientes, puestos: listaPuestos, insumos: listaInsumos, vendedores: listaVendedores },
    ligado,
  );
  const valores = inicial.noCotizacion > 0 ? inicial : { ...inicial, noCotizacion: folios.noCotizacion };

  return (
    <>
      <TituloPagina
        titulo="Revisar costeo"
        descripcion={`Cotización ${valores.noCotizacion} · folio ${valores.folio ?? "?"} · ${importacion.Archivo}`}
        accion={<Volver />}
      />
      <ResumenImportacion
        idImportacion={importacion.IdImportacion}
        archivo={importacion.Archivo}
        urlOriginal={urlImportacion(importacion.IdImportacion, "original.xlsx")}
        avisos={avisos}
        evidencias={[]}
      />
      <RevisionCosteo
        inicial={valores}
        referencia={referencia}
        levantamiento={ligado}
        clientes={listaClientes}
        puestos={listaPuestos}
        vendedores={listaVendedores}
        margenAlertaPct={config.MARGEN_ALERTA_PCT ?? 30}
        idImportacion={importacion.IdImportacion}
      />
    </>
  );
}

// ── Comunes ─────────────────────────────────────────────────────────────────

function SinRevision({ importacion }: { importacion: ImportacionFila }) {
  return (
    <>
      <TituloPagina
        titulo="Importación"
        descripcion={importacion.Archivo}
        accion={
          <div className="flex flex-wrap items-center gap-2">
            {importacion.Estado !== "APLICADA" && <BotonDescartar idImportacion={importacion.IdImportacion} />}
            <Volver />
          </div>
        }
      />
      <Carta>
        <p className="text-sm text-tinta-2">
          {importacion.Estado === "ERROR"
            ? `No se pudo leer este archivo: ${importacion.Mensaje ?? "sin detalle"}.`
            : "Esta importación no está lista para revisarse."}
        </p>
      </Carta>
    </>
  );
}

function leerJson<T>(json: string | null, esquema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T | null {
  if (!json) return null;
  try {
    const resultado = esquema.safeParse(JSON.parse(json));
    return resultado.success ? (resultado.data ?? null) : null;
  } catch {
    return null;
  }
}

function Volver() {
  return (
    <Link href="/dashboard/importar">
      <Boton variante="secundario"><ChevronLeft size={15} /> Importaciones</Boton>
    </Link>
  );
}
