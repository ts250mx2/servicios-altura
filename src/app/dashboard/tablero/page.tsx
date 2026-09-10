import { TituloPagina } from "@/components/layout/Cascaron";
import { Tablero } from "@/components/tablero/Tablero";
import { tarjetasTablero } from "@/lib/consultas/proyectos";

export const dynamic = "force-dynamic";

/** Todos los proyectos de un vistazo, por etapa. Se arrastran entre columnas para cambiar de estatus. */
export default async function PaginaTablero() {
  const tarjetas = await tarjetasTablero();
  return (
    <>
      <TituloPagina
        titulo="Tablero"
        descripcion="Cada tarjeta es un proyecto. Arrástrala a otra columna para cambiar su estatus; haz clic para abrir su ficha."
      />
      <Tablero tarjetas={tarjetas} />
    </>
  );
}
