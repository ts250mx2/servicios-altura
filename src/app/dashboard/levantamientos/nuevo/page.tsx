import { TituloPagina } from "@/components/layout/Cascaron";
import { AsistenteCaptura } from "@/components/levantamientos/AsistenteCaptura";
import { clientes, insumos, parametros, puestos, siguientesFolios } from "@/lib/consultas/catalogos";

export const dynamic = "force-dynamic";

export default async function NuevoLevantamiento(props: {
  searchParams: Promise<{ modo?: string }>;
}) {
  const { modo } = await props.searchParams;
  const modoCampo = modo === "campo";

  const [listaClientes, listaPuestos, listaInsumos, config, folios] = await Promise.all([
    clientes(), puestos(), insumos(), parametros(), siguientesFolios(),
  ]);

  return (
    <>
      <TituloPagina
        titulo="Nuevo levantamiento"
        descripcion={
          modoCampo
            ? "Modo campo: datos, trabajo y recursos. El costeo se completa en oficina."
            : "Captura los recursos y el costeo se calcula mientras avanzas."
        }
      />
      <AsistenteCaptura
        clientes={listaClientes}
        puestos={listaPuestos}
        insumos={listaInsumos}
        folio={folios.folio}
        noCotizacion={folios.noCotizacion}
        parametros={config}
        modoCampo={modoCampo}
      />
    </>
  );
}
