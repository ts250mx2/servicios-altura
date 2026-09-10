"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { AreaTexto, Boton, Campo, Carta, Entrada, Selector } from "@/components/ui/Basicos";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import type { ValoresCotizacion } from "@/lib/cotizaciones/esquemas";
import { totalesCotizacion } from "@/lib/cotizaciones/guardar";
import { formatoMoneda } from "@/lib/formato";

type Partida = ValoresCotizacion["partidas"][number] & { clave?: string };
type Estado = Omit<ValoresCotizacion, "partidas"> & { partidas: Partida[] };

let contador = 0;
const nuevaClave = () => `p${Date.now()}-${++contador}`;

/**
 * Edición comercial: lo que ve el cliente. Partidas, descuento, vigencia,
 * condiciones y estatus. Si hay costeo, el servidor lo recalcula con el nuevo precio.
 */
export function EditorCotizacion({
  inicial, vendedores, tieneCosteo,
}: {
  inicial: ValoresCotizacion;
  vendedores: { IdUsuario: number; Usuario: string }[];
  tieneCosteo: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<Estado>(() => ({
    ...inicial,
    partidas: inicial.partidas.map((p) => ({ ...p, clave: nuevaClave() })),
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiar = <K extends keyof ValoresCotizacion>(campo: K, valor: ValoresCotizacion[K]) =>
    setV((actual) => ({ ...actual, [campo]: valor }));
  const cambiarPartida = (i: number, cambios: Partial<Partida>) =>
    setV((actual) => ({ ...actual, partidas: actual.partidas.map((p, j) => (j === i ? { ...p, ...cambios } : p)) }));

  const t = totalesCotizacion(v.partidas, v.descuentoPct, v.ivaPct);

  async function guardar() {
    if (!v.descripcion.trim()) { setError("Escribe la descripción."); return; }
    if (v.partidas.length === 0 || v.partidas.some((p) => !p.concepto.trim())) {
      setError("Cada partida necesita un concepto.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/cotizaciones/${v.idCotizacion}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: v.fecha, vigencia: v.vigencia, descripcion: v.descripcion, condiciones: v.condiciones,
          idVendedor: v.idVendedor, descuentoPct: v.descuentoPct, status: v.status,
          autorizadoPor: v.autorizadoPor, motivoRechazo: v.motivoRechazo,
          partidas: v.partidas.map(({ concepto, unidad, cantidad, precioUnitario }) => ({ concepto, unidad, cantidad, precioUnitario })),
        }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setError(datos.mensaje ?? "No se pudo guardar.");
        return;
      }
      router.push(`/dashboard/cotizaciones/${v.idCotizacion}`);
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <Carta titulo="Datos de la cotización" etiqueta={`No. ${v.noCotizacion}`}>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo etiqueta="Descripción del proyecto" requerido className="md:col-span-2">
              <AreaTexto value={v.descripcion} onChange={(e) => cambiar("descripcion", e.target.value)} />
            </Campo>
            <Campo etiqueta="Fecha de emisión" requerido>
              <Entrada type="date" value={v.fecha} onChange={(e) => cambiar("fecha", e.target.value)} />
            </Campo>
            <Campo etiqueta="Vigencia (días)" ayuda="Cuántos días vale el precio.">
              <Entrada type="number" min={1} max={365} value={v.vigencia}
                onChange={(e) => cambiar("vigencia", Math.max(1, Number(e.target.value) || 1))} />
            </Campo>
            <Campo etiqueta="Vendedor">
              <Selector value={v.idVendedor ?? ""} onChange={(e) => cambiar("idVendedor", e.target.value ? Number(e.target.value) : null)}>
                <option value="">Sin vendedor</option>
                {vendedores.map((u) => <option key={u.IdUsuario} value={u.IdUsuario}>{u.Usuario}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Descuento %">
              <Entrada type="number" min={0} max={100} step="0.5" value={v.descuentoPct}
                onChange={(e) => cambiar("descuentoPct", Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
            </Campo>
            <Campo etiqueta="Estatus">
              <Selector value={v.status} onChange={(e) => cambiar("status", e.target.value as ValoresCotizacion["status"])}>
                <option value="BORRADOR">Borrador (todavía no se manda)</option>
                <option value="ENVIADA">Enviada al cliente</option>
                <option value="AUTORIZADA">Autorizada por el cliente</option>
                <option value="RECHAZADA">Rechazada</option>
                <option value="CANCELADA">Cancelada</option>
              </Selector>
            </Campo>
            {v.status === "AUTORIZADA" && (
              <Campo etiqueta="Autorizó">
                <Entrada value={v.autorizadoPor} onChange={(e) => cambiar("autorizadoPor", e.target.value)} placeholder="AUTORIZA RODOLFO" />
              </Campo>
            )}
            {v.status === "RECHAZADA" && (
              <Campo etiqueta="Motivo del rechazo">
                <Entrada value={v.motivoRechazo} onChange={(e) => cambiar("motivoRechazo", e.target.value)} />
              </Campo>
            )}
            <Campo etiqueta="Condiciones" ayuda="Forma de pago, tiempos, lo que incluye y lo que no." className="md:col-span-2">
              <AreaTexto value={v.condiciones} onChange={(e) => cambiar("condiciones", e.target.value)} />
            </Campo>
          </div>
        </Carta>

        <Carta
          titulo="Partidas"
          etiqueta="Lo que se le cobra al cliente, renglón por renglón"
          accion={
            <Boton variante="secundario" onClick={() =>
              setV((a) => ({ ...a, partidas: [...a.partidas, { clave: nuevaClave(), concepto: "", unidad: "SERV", cantidad: 1, precioUnitario: 0 }] }))}>
              <Plus size={14} /> Partida
            </Boton>
          }
        >
          <Tabla>
            <Encabezados columnas={[
              { texto: "Concepto" }, { texto: "Unidad", ancho: "90px" }, { texto: "Cantidad", derecha: true, ancho: "90px" },
              { texto: "Precio unitario", derecha: true, ancho: "140px" }, { texto: "Importe", derecha: true, ancho: "130px" }, { texto: "", ancho: "40px" },
            ]} />
            <tbody>
              {v.partidas.map((p, i) => (
                <Fila key={p.clave}>
                  <Celda>
                    <AreaTexto className="min-h-9 px-2 py-1" value={p.concepto} onChange={(e) => cambiarPartida(i, { concepto: e.target.value })} />
                  </Celda>
                  <Celda><Entrada className="px-2 py-1" value={p.unidad} onChange={(e) => cambiarPartida(i, { unidad: e.target.value })} /></Celda>
                  <Celda derecha>
                    <Entrada type="number" min={0} step="0.01" className="px-2 py-1 text-right num-tab" value={p.cantidad}
                      onChange={(e) => cambiarPartida(i, { cantidad: Math.max(0, Number(e.target.value) || 0) })} />
                  </Celda>
                  <Celda derecha>
                    <Entrada type="number" min={0} step="0.01" className="px-2 py-1 text-right num-tab" value={p.precioUnitario}
                      onChange={(e) => cambiarPartida(i, { precioUnitario: Math.max(0, Number(e.target.value) || 0) })} />
                  </Celda>
                  <Celda derecha mono>{formatoMoneda(p.cantidad * p.precioUnitario)}</Celda>
                  <Celda>
                    <Boton variante="fantasma" aria-label="Quitar partida" className="size-8 p-0"
                      onClick={() => setV((a) => ({ ...a, partidas: a.partidas.filter((_, j) => j !== i) }))}>
                      <Trash2 size={14} />
                    </Boton>
                  </Celda>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        </Carta>

        {error && <p className="rounded border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">{error}</p>}
        <div className="flex justify-end">
          <Boton onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar cotización"}</Boton>
        </div>
      </div>

      <aside className="xl:sticky xl:top-0 xl:self-start">
        <Carta titulo="Totales" etiqueta="Lo que verá el cliente">
          <dl className="space-y-2 text-sm">
            <Renglon etiqueta="Subtotal" valor={t.subtotal} />
            {t.descuento > 0 && <Renglon etiqueta={`Descuento ${v.descuentoPct} %`} valor={-t.descuento} />}
            <Renglon etiqueta="Base (precio de venta)" valor={t.base} fuerte />
            <Renglon etiqueta={`IVA ${v.ivaPct} %`} valor={t.iva} />
            <Renglon etiqueta="Total" valor={t.total} fuerte />
          </dl>
          <p className="mt-4 border-t border-borde pt-3 text-xs text-tinta-3">
            {tieneCosteo
              ? "El costeo se recalcula con la nueva base al guardar: cambia la utilidad y el margen, no el gasto."
              : "Esta cotización no tiene costeo."}
          </p>
        </Carta>
      </aside>
    </div>
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
