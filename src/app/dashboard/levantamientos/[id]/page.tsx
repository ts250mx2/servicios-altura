import Link from "next/link";
import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";
import { TituloPagina } from "@/components/layout/Cascaron";
import { AccionesEstado } from "@/components/proyectos/AccionesEstado";
import { BotonesDocumento } from "@/components/proyectos/BotonesDocumento";
import { EncabezadoProyecto } from "@/components/proyectos/EncabezadoProyecto";
import { Boton, Carta, Vacio } from "@/components/ui/Basicos";
import { Chip, ChipRiesgo, ChipStatus } from "@/components/ui/Chip";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import {
  actividadesDe, evidenciasDe, fichaLevantamiento, insumosDe, personalDe,
} from "@/lib/consultas/levantamientos";
import { cadenaDeLevantamiento } from "@/lib/consultas/proyectos";
import { formatoFecha, formatoMoneda, formatoNumero } from "@/lib/formato";
import { accionesDeLevantamiento, claveDe } from "@/lib/tablero/acciones";

export const dynamic = "force-dynamic";

/** La cara operativa del proyecto: qué se va a hacer, con quién y con qué. */
export default async function FichaLevantamiento(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const idNumero = Number(id);
  if (!Number.isFinite(idNumero)) notFound();

  const ficha = await fichaLevantamiento(idNumero);
  if (!ficha) notFound();

  const [actividades, personal, insumos, evidencias, cadena] = await Promise.all([
    actividadesDe(idNumero), personalDe(idNumero), insumosDe(idNumero), evidenciasDe(idNumero),
    cadenaDeLevantamiento(idNumero),
  ]);
  if (!cadena) notFound();

  const consumibles = insumos.filter((i) => i.EsHerramental === 0);
  const herramental = insumos.filter((i) => i.EsHerramental === 1);
  const totalPersonas = personal.reduce((s, p) => s + p.Cantidad, 0);
  const clave = claveDe(cadena);

  return (
    <>
      <TituloPagina
        titulo={`Levantamiento ${ficha.Folio}`}
        descripcion={`${ficha.Cliente}${ficha.AreaTrabajo ? ` · ${ficha.AreaTrabajo}` : ""} · ${formatoFecha(ficha.Fecha)}`}
        accion={
          <div className="flex flex-wrap gap-2">
            <BotonesDocumento
              tipo="levantamiento"
              id={idNumero}
              hrefEditar={`/dashboard/levantamientos/${idNumero}/editar`}
              borrar={{ mensaje: mensajeBorrarLevantamiento(ficha.Folio, ficha.NoCotizacion), regresarA: "/dashboard/levantamientos" }}
            />
            {!ficha.IdCotizacion && ficha.Status !== "CANCELADO" && (
              <Link href={`/dashboard/levantamientos/${idNumero}/editar?paso=3`}>
                <Boton><Wallet size={15} /> Ponerle precio</Boton>
              </Link>
            )}
          </div>
        }
      />
      <EncabezadoProyecto cadena={cadena} actual="levantamiento" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Carta titulo="Datos" etiqueta="Qué se va a hacer y para quién" className="lg:col-span-2">
          <p className="mb-4 text-sm leading-relaxed text-tinta">{ficha.Proyecto}</p>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Dato etiqueta="Área de trabajo" valor={ficha.AreaTrabajo} />
            <Dato etiqueta="Contacto del cliente" valor={ficha.UsuarioContacto} />
            <Dato etiqueta="Correo" valor={ficha.CorreoUsuario} />
            <Dato etiqueta="Fecha" valor={formatoFecha(ficha.Fecha)} />
            <Dato etiqueta="Días de trabajo" valor={String(ficha.Dias)} />
            <Dato etiqueta="Elaboró" valor={ficha.Elaboro} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-borde pt-4">
            <ChipStatus status={ficha.Status} />
            <ChipRiesgo nivel={ficha.NivelRiesgo} />
            {ficha.TrabajoNormal === 1 && <Chip>Horario normal</Chip>}
            {ficha.TrabajoExtra === 1 && <Chip tono="serio">Tiempo extra</Chip>}
            {ficha.AplicaCena === 1 && <Chip>Aplica cena</Chip>}
            {ficha.AplicaBono === 1 && <Chip tono="alerta">Aplica bono</Chip>}
            <Chip>Origen {ficha.Origen.toLowerCase()}</Chip>
          </div>
          {ficha.Observaciones && (
            <div className="mt-4 rounded border border-borde bg-fondo p-3">
              <p className="etiqueta mb-1">Observaciones</p>
              <p className="text-sm whitespace-pre-line text-tinta-2">{ficha.Observaciones}</p>
            </div>
          )}
          {clave && (
            <div className="mt-4 border-t border-borde pt-4">
              <AccionesEstado clave={clave} acciones={accionesDeLevantamiento(cadena)} />
            </div>
          )}
        </Carta>

        <Carta titulo="Personal" etiqueta={`${totalPersonas} personas × ${ficha.Dias} días`}>
          {personal.length === 0 ? (
            <Vacio mensaje="Sin personal asignado." />
          ) : (
            <ul className="space-y-2">
              {personal.map((p) => (
                <li key={p.IdLevPersonal}
                  className="flex items-center justify-between gap-2 border-b border-borde/60 pb-2 last:border-0">
                  <div>
                    <p className="text-sm text-tinta">{p.Puesto}</p>
                    <p className="num-tab text-xs text-tinta-3">
                      {formatoMoneda(p.SalarioDiario)}/día
                      {p.Bono === 1 && ` · bono ${formatoMoneda(p.BonoDefault)}`}
                    </p>
                  </div>
                  <span className="num-tab text-lg text-acento">{p.Cantidad}</span>
                </li>
              ))}
            </ul>
          )}
        </Carta>
      </div>

      <Carta titulo="Trabajo a realizar" etiqueta={`${actividades.length} actividades, en orden de ejecución`} className="mt-4">
        {actividades.length === 0 ? (
          <Vacio mensaje="Sin actividades capturadas." />
        ) : (
          <ol className="space-y-3">
            {actividades.map((a) => (
              <li key={a.IdActividad} className="flex gap-3">
                <span className="num-tab mt-0.5 w-5 shrink-0 text-sm text-acento">{a.Orden}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-tinta-2">{a.Descripcion}</p>
                </div>
                {a.Metros > 0 && (
                  <span className="num-tab shrink-0 text-sm text-tinta-3">
                    {formatoNumero(a.Metros)} m²
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Carta>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TablaInsumos titulo="Insumos" ayuda="Material que se consume" filas={consumibles} />
        <TablaInsumos titulo="Herramental" ayuda="Equipo que se lleva y regresa" filas={herramental} />
      </div>

      {evidencias.length > 0 && (
        <Carta titulo="Evidencias" etiqueta={`${evidencias.length} fotografías`} className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {evidencias.map((e) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={e.IdEvidencia} src={e.Archivo} alt={e.Titulo ?? "Evidencia"}
                className="aspect-3/4 w-full rounded border border-borde object-cover" />
            ))}
          </div>
        </Carta>
      )}
    </>
  );
}

function mensajeBorrarLevantamiento(folio: number, noCotizacion: number | null): string {
  return noCotizacion
    ? `¿Borrar el levantamiento ${folio}? Se borran también la cotización ${noCotizacion} y su costeo. No se puede deshacer.`
    : `¿Borrar el levantamiento ${folio}? No se puede deshacer.`;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div>
      <dt className="etiqueta">{etiqueta}</dt>
      <dd className="text-tinta">{valor || "—"}</dd>
    </div>
  );
}

function TablaInsumos({
  titulo, ayuda, filas,
}: {
  titulo: string;
  ayuda: string;
  filas: { IdLevInsumo: number; Descripcion: string; Cantidad: number; Aplica: number; Comentario: string | null }[];
}) {
  return (
    <Carta titulo={titulo} etiqueta={`${filas.length} partidas · ${ayuda}`}>
      {filas.length === 0 ? (
        <Vacio mensaje="Sin partidas." />
      ) : (
        <Tabla>
          <Encabezados columnas={[
            { texto: "Cant.", ancho: "60px", derecha: true },
            { texto: "Descripción" },
          ]} />
          <tbody>
            {filas.map((f) => (
              <Fila key={f.IdLevInsumo}>
                <Celda derecha mono>{formatoNumero(f.Cantidad, 0)}</Celda>
                <Celda className={f.Aplica === 0 ? "text-tinta-3 line-through" : undefined}>
                  {f.Descripcion}
                  {f.Aplica === 0 && <Chip tono="neutro" className="ml-2">Lo pone el cliente</Chip>}
                </Celda>
              </Fila>
            ))}
          </tbody>
        </Tabla>
      )}
    </Carta>
  );
}
