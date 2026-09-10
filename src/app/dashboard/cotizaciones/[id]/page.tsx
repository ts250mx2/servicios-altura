import { notFound } from "next/navigation";
import { TituloPagina } from "@/components/layout/Cascaron";
import { AccionesEstado } from "@/components/proyectos/AccionesEstado";
import { BotonesDocumento } from "@/components/proyectos/BotonesDocumento";
import { EncabezadoProyecto } from "@/components/proyectos/EncabezadoProyecto";
import { Carta, Vacio } from "@/components/ui/Basicos";
import { Chip, ChipStatus } from "@/components/ui/Chip";
import { Kpi } from "@/components/ui/Kpi";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import { fichaCotizacion, partidasDe } from "@/lib/consultas/cotizaciones";
import { cadenaDeCotizacion } from "@/lib/consultas/proyectos";
import { formatoFecha, formatoMoneda, formatoNumero } from "@/lib/formato";
import { accionesDeCotizacion, claveDe } from "@/lib/tablero/acciones";

export const dynamic = "force-dynamic";

/** La cara comercial del proyecto: qué se le cobra al cliente y en qué va la respuesta. */
export default async function FichaCotizacion(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const idCotizacion = Number(id);
  if (!Number.isFinite(idCotizacion)) notFound();

  const [ficha, partidas, cadena] = await Promise.all([
    fichaCotizacion(idCotizacion), partidasDe(idCotizacion), cadenaDeCotizacion(idCotizacion),
  ]);
  if (!ficha || !cadena) notFound();

  const vencida = ficha.Status === "ENVIADA" && ficha.DiasAbierta > ficha.Vigencia;
  const base = Number(ficha.Subtotal) - Number(ficha.Descuento);
  const clave = claveDe(cadena);

  return (
    <>
      <TituloPagina
        titulo={`Cotización ${ficha.NoCotizacion}`}
        descripcion={`${ficha.Cliente} · emitida el ${formatoFecha(ficha.Fecha)} · vigencia ${ficha.Vigencia} días`}
        accion={
          <BotonesDocumento
            tipo="cotizacion"
            id={idCotizacion}
            hrefEditar={`/dashboard/cotizaciones/${idCotizacion}/editar`}
            borrar={{ mensaje: `¿Borrar la cotización ${ficha.NoCotizacion}? Se borra también su costeo; el levantamiento se queda. No se puede deshacer.`, regresarA: "/dashboard/cotizaciones" }}
          />
        }
      />
      <EncabezadoProyecto cadena={cadena} actual="cotizacion" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi etiqueta="Precio sin IVA" valor={formatoMoneda(base)} />
        <Kpi etiqueta={`IVA ${formatoNumero(ficha.IvaPct, 0)} %`} valor={formatoMoneda(ficha.Iva)} />
        <Kpi etiqueta="Total con IVA" valor={formatoMoneda(ficha.Total)} />
        <Kpi etiqueta="Días desde la emisión" valor={String(ficha.DiasAbierta)} sufijo={vencida ? "vencida" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Carta titulo="Partidas" etiqueta="Lo que se le cobra al cliente" className="lg:col-span-2">
          {partidas.length === 0 ? (
            <Vacio mensaje="Sin partidas." />
          ) : (
            <Tabla>
              <Encabezados columnas={[
                { texto: "#", ancho: "40px" }, { texto: "Concepto" }, { texto: "Unidad", ancho: "80px" },
                { texto: "Cant.", derecha: true, ancho: "70px" }, { texto: "P. unitario", derecha: true, ancho: "120px" },
                { texto: "Importe", derecha: true, ancho: "120px" },
              ]} />
              <tbody>
                {partidas.map((p) => (
                  <Fila key={p.IdPartida}>
                    <Celda mono apagada>{p.Orden}</Celda>
                    <Celda className="whitespace-pre-line">{p.Concepto}</Celda>
                    <Celda apagada>{p.Unidad}</Celda>
                    <Celda derecha mono>{formatoNumero(p.Cantidad)}</Celda>
                    <Celda derecha mono>{formatoMoneda(p.PrecioUnitario)}</Celda>
                    <Celda derecha mono>{formatoMoneda(p.Importe)}</Celda>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
          <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <Renglon etiqueta="Subtotal" valor={ficha.Subtotal} />
            {Number(ficha.Descuento) > 0 && <Renglon etiqueta={`Descuento ${formatoNumero(ficha.DescuentoPct)} %`} valor={-Number(ficha.Descuento)} />}
            <Renglon etiqueta={`IVA ${formatoNumero(ficha.IvaPct, 0)} %`} valor={ficha.Iva} />
            <Renglon etiqueta="Total" valor={ficha.Total} fuerte />
          </dl>
        </Carta>

        <div className="space-y-4">
          <Carta titulo="Estado" etiqueta="En qué va la respuesta del cliente">
            <div className="flex flex-wrap items-center gap-2">
              <ChipStatus status={ficha.Status} />
              {vencida && <Chip tono="serio">Venció la vigencia</Chip>}
            </div>
            {ficha.AutorizadoPor && <p className="mt-3 text-sm text-tinta-2">Autorizó: {ficha.AutorizadoPor}</p>}
            {ficha.Status === "RECHAZADA" && (ficha as { MotivoRechazo?: string | null }).MotivoRechazo && (
              <p className="mt-3 text-sm text-tinta-2">Motivo: {(ficha as { MotivoRechazo?: string | null }).MotivoRechazo}</p>
            )}
            <div className="mt-4 border-t border-borde pt-3">
              {clave && <AccionesEstado clave={clave} acciones={accionesDeCotizacion(cadena)} />}
            </div>
          </Carta>

          <Carta titulo="Cliente" etiqueta="A quién se le cotiza">
            <dl className="space-y-2 text-sm">
              <div><dt className="etiqueta">Cliente</dt><dd className="text-tinta">{ficha.Cliente}</dd></div>
              <div><dt className="etiqueta">Contacto</dt><dd className="text-tinta">{ficha.Contacto ?? "—"}</dd></div>
              <div><dt className="etiqueta">Correo</dt><dd className="text-tinta">{ficha.Correo ?? "—"}</dd></div>
              <div><dt className="etiqueta">Vendedor</dt><dd className="text-tinta">{ficha.Vendedor ?? "—"}</dd></div>
            </dl>
          </Carta>

          {ficha.Condiciones && (
            <Carta titulo="Condiciones" etiqueta="Forma de pago, tiempos y alcance">
              <p className="text-sm whitespace-pre-line text-tinta-2">{ficha.Condiciones}</p>
            </Carta>
          )}
        </div>
      </div>
    </>
  );
}

function Renglon({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div className={fuerte ? "flex justify-between border-t border-borde pt-1.5 font-semibold text-tinta" : "flex justify-between text-tinta-2"}>
      <dt>{etiqueta}</dt>
      <dd className="num-tab">{formatoMoneda(valor)}</dd>
    </div>
  );
}
