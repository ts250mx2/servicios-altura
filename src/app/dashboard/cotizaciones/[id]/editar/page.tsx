import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EditorCotizacion } from "@/components/cotizaciones/EditorCotizacion";
import { TituloPagina } from "@/components/layout/Cascaron";
import { Boton } from "@/components/ui/Basicos";
import { vendedores } from "@/lib/consultas/catalogos";
import { fichaCotizacion, partidasDe } from "@/lib/consultas/cotizaciones";
import type { ValoresCotizacion } from "@/lib/cotizaciones/esquemas";

export const dynamic = "force-dynamic";

export default async function EditarCotizacion(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const idCotizacion = Number(id);
  if (!Number.isFinite(idCotizacion)) notFound();

  const [ficha, partidas, listaVendedores] = await Promise.all([
    fichaCotizacion(idCotizacion), partidasDe(idCotizacion), vendedores(),
  ]);
  if (!ficha) notFound();
  const f = ficha as typeof ficha & { IdVendedor: number | null; MotivoRechazo: string | null };

  const inicial: ValoresCotizacion = {
    idCotizacion,
    noCotizacion: ficha.NoCotizacion,
    ivaPct: Number(ficha.IvaPct) || 16,
    fecha: String(ficha.Fecha).slice(0, 10),
    vigencia: ficha.Vigencia,
    descripcion: ficha.Descripcion,
    condiciones: ficha.Condiciones ?? "",
    idVendedor: f.IdVendedor ?? null,
    descuentoPct: Number(ficha.DescuentoPct),
    status: ficha.Status,
    autorizadoPor: ficha.AutorizadoPor ?? "",
    motivoRechazo: f.MotivoRechazo ?? "",
    partidas: partidas.length > 0
      ? partidas.map((p) => ({ concepto: p.Concepto, unidad: p.Unidad, cantidad: Number(p.Cantidad), precioUnitario: Number(p.PrecioUnitario) }))
      : [{ concepto: ficha.Descripcion, unidad: "SERV", cantidad: 1, precioUnitario: Number(ficha.Subtotal) }],
  };

  return (
    <>
      <TituloPagina
        titulo={`Editar cotización ${ficha.NoCotizacion}`}
        descripcion={`${ficha.Cliente} · lo que verá el cliente. El costeo se recalcula solo si cambia el precio.`}
        accion={
          <Link href={`/dashboard/cotizaciones/${idCotizacion}`}>
            <Boton variante="secundario"><ChevronLeft size={15} /> Ficha</Boton>
          </Link>
        }
      />
      <EditorCotizacion inicial={inicial} vendedores={listaVendedores} tieneCosteo={ficha.IdCosteo !== null} />
    </>
  );
}
