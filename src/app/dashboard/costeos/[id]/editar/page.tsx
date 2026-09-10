import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RevisionCosteo } from "@/components/importacion/RevisionCosteo";
import { TituloPagina } from "@/components/layout/Cascaron";
import { Boton } from "@/components/ui/Basicos";
import { clientes, parametros, puestos, vendedores } from "@/lib/consultas/catalogos";
import { partidasDe } from "@/lib/consultas/cotizaciones";
import { valoresDesdeCosteo } from "@/lib/costeo/cargar";

export const dynamic = "force-dynamic";

/** El editor del costeo con lo guardado: nómina, insumos, gastos, precio y gasto real. */
export default async function EditarCosteo(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const idCosteo = Number(id);
  if (!Number.isInteger(idCosteo) || idCosteo <= 0) notFound();

  const cargado = await valoresDesdeCosteo(idCosteo);
  if (!cargado) notFound();
  const { ficha, inicial } = cargado;

  const [listaClientes, listaPuestos, listaVendedores, config, partidas] = await Promise.all([
    clientes(), puestos(), vendedores(), parametros(), partidasDe(ficha.IdCotizacion),
  ]);
  const precioDesdeCotizacion = partidas.length > 1;

  return (
    <>
      <TituloPagina
        titulo={`Editar costeo · cotización ${ficha.NoCotizacion}`}
        descripcion={`${ficha.Cliente} · cambia lo que haga falta; la cadena se recalcula al guardar.`}
        accion={
          <Link href={`/dashboard/costeos/${idCosteo}`}>
            <Boton variante="secundario"><ChevronLeft size={15} /> Ficha</Boton>
          </Link>
        }
      />
      <RevisionCosteo
        inicial={inicial}
        levantamiento={null}
        clientes={listaClientes}
        puestos={listaPuestos}
        vendedores={listaVendedores}
        margenAlertaPct={config.MARGEN_ALERTA_PCT ?? 30}
        idCosteo={idCosteo}
        precioDesdeCotizacion={precioDesdeCotizacion}
      />
    </>
  );
}
