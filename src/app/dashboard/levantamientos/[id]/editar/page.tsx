import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TituloPagina } from "@/components/layout/Cascaron";
import { AsistenteCaptura } from "@/components/levantamientos/AsistenteCaptura";
import { Boton } from "@/components/ui/Basicos";
import { clientes, insumos, parametros, puestos, siguientesFolios } from "@/lib/consultas/catalogos";
import { valoresDesdeLevantamiento } from "@/lib/levantamientos/cargar";

export const dynamic = "force-dynamic";

/** El mismo asistente de captura, abierto con lo guardado. `?paso=3` salta directo a poner precio. */
export default async function EditarLevantamiento(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paso?: string }>;
}) {
  const [{ id }, { paso }] = await Promise.all([props.params, props.searchParams]);
  const idLev = Number(id);
  if (!Number.isInteger(idLev) || idLev <= 0) notFound();

  const cargado = await valoresDesdeLevantamiento(idLev);
  if (!cargado) notFound();
  const { ficha, inicial } = cargado;
  const tieneCotizacion = ficha.IdCotizacion !== null;

  const [listaClientes, listaPuestos, listaInsumos, config, folios] = await Promise.all([
    clientes(), puestos(), insumos(), parametros(), siguientesFolios(),
  ]);
  const pasoInicial = Number(paso ?? 0);

  return (
    <>
      <TituloPagina
        titulo={`Editar levantamiento ${ficha.Folio}`}
        descripcion={
          tieneCotizacion
            ? `${ficha.Cliente} · ya tiene la cotización ${ficha.NoCotizacion}: el precio se edita desde ella.`
            : `${ficha.Cliente} · corrige lo que haga falta o pasa al paso 4 para ponerle precio.`
        }
        accion={
          <Link href={`/dashboard/levantamientos/${idLev}`}>
            <Boton variante="secundario"><ChevronLeft size={15} /> Ficha</Boton>
          </Link>
        }
      />
      <AsistenteCaptura
        clientes={listaClientes}
        puestos={listaPuestos}
        insumos={listaInsumos}
        folio={ficha.Folio}
        noCotizacion={folios.noCotizacion}
        parametros={config}
        modoCampo={false}
        inicial={inicial}
        modo="editar"
        idLevantamiento={idLev}
        tieneCotizacion={tieneCotizacion}
        pasoInicial={Number.isFinite(pasoInicial) ? pasoInicial : 0}
        statusActual={ficha.Status === "CERRADO" || ficha.Status === "COTIZADO" ? ficha.Status : "BORRADOR"}
      />
    </>
  );
}
