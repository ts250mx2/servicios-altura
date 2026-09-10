"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Link2Off } from "lucide-react";
import { AreaTexto, Boton, Campo, Carta, Entrada, Selector } from "@/components/ui/Basicos";
import { Chip } from "@/components/ui/Chip";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import { calcularCosteo, semaforoMargen } from "@/lib/costeo/motor";
import { CONCEPTOS, ETIQUETA_CONCEPTO, type Concepto } from "@/lib/costeo/tipos";
import type { Cliente, Puesto } from "@/lib/consultas/catalogos";
import type { LevantamientoLigado, ReferenciaExcel, ValoresCosteo } from "@/lib/importacion/excel/revision";
import { formatoMoneda, formatoPorcentaje } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { TablaGastos, TablaInsumos, TablaNomina, conClaves } from "./TablasRevisionCosteo";

/** Con menos de un peso de diferencia se considera que el motor cuadra con el Excel. */
const TOLERANCIA_CUADRE = 1;

interface Props {
  inicial: ValoresCosteo;
  levantamiento: LevantamientoLigado | null;
  clientes: Cliente[];
  puestos: Puesto[];
  vendedores: { IdUsuario: number; Usuario: string }[];
  margenAlertaPct: number;
  /** Importación: se manda `POST /api/costeos` y se muestra el cuadre con el Excel. */
  idImportacion?: number;
  referencia?: ReferenciaExcel;
  /** Edición: se manda `PUT /api/costeos/[id]` y se puede capturar el gasto real. */
  idCosteo?: number;
  /** La cotización tiene varias partidas o descuento: el precio se edita allá. */
  precioDesdeCotizacion?: boolean;
}

/**
 * Editor del costeo: cotización, nómina, insumos y gastos, con el motor
 * recalculando en vivo. Sirve para revisar un Excel importado y para editar un
 * costeo guardado. Nada entra a la base hasta oprimir «Guardar».
 */
export function RevisionCosteo({
  inicial, levantamiento, clientes, puestos, vendedores, margenAlertaPct, idImportacion, referencia, idCosteo,
  precioDesdeCotizacion = false,
}: Props) {
  const router = useRouter();
  const editando = idCosteo !== undefined;
  const [v, setV] = useState<ValoresCosteo>(() => ({
    ...inicial,
    nomina: conClaves(inicial.nomina),
    insumos: conClaves(inicial.insumos),
    gastos: conClaves(inicial.gastos),
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiar = <K extends keyof ValoresCosteo>(campo: K, valor: ValoresCosteo[K]) =>
    setV((actual) => ({ ...actual, [campo]: valor }));

  const costeo = useMemo(
    () =>
      calcularCosteo({
        nomina: v.nomina.map((p) => ({
          nombre: p.nombre, idPuesto: p.idPuesto, salarioDiario: p.salarioDiario, imssDiario: p.imssDiario,
          desgasteDiario: p.desgasteDiario, bono: p.bono, diasLaborados: p.dias,
        })),
        insumos: v.insumos.map((i) => ({ descripcion: i.descripcion, unidades: i.unidades, costo: i.costo, aplica: i.aplica })),
        gastos: {
          gasolina: suma(v, "GASOLINA"), administrativo: suma(v, "ADMINISTRATIVO"),
          epp: suma(v, "EPP"), equipo: suma(v, "EQUIPO"),
        },
        porcentajes: v.porcentajes,
        precioVenta: v.precioVenta,
      }),
    [v],
  );

  const semaforo = semaforoMargen(costeo.margenPct, margenAlertaPct);
  const personas = v.nomina.filter((p) => p.dias > 0).length;

  const faltante =
    !v.descripcion.trim() ? "Escribe la descripción del proyecto."
    : v.idCliente === "nuevo" && !v.clienteNuevo.trim() && !v.idLevantamiento ? "Escribe el nombre del cliente."
    : v.noCotizacion <= 0 ? "Captura el número de cotización."
    : v.precioVenta <= 0 ? "Captura el precio de venta."
    : v.nomina.some((p) => !p.nombre.trim()) ? "Hay una persona sin nombre en la nómina."
    : v.insumos.some((i) => !i.descripcion.trim()) ? "Hay un insumo sin descripción."
    : null;

  async function guardar() {
    if (faltante) { setError(faltante); return; }
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await fetch(editando ? `/api/costeos/${idCosteo}` : "/api/costeos", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...v,
          idCliente: v.idCliente === "nuevo" ? null : v.idCliente,
          ...(idImportacion ? { importacion: { idImportacion } } : {}),
        }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setError(datos.mensaje ?? "No se pudo guardar.");
        return;
      }
      router.push(`/dashboard/costeos/${datos.idCosteo}`);
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
        <Carta titulo="Cotización" etiqueta="Lo que se cobra: a quién, cuánto y en qué estado va">
          <div className="grid gap-4 md:grid-cols-2">
            {!editando && (
              <div className="md:col-span-2">
                <LigaLevantamiento levantamiento={levantamiento} ligado={v.idLevantamiento !== null} />
              </div>
            )}

            {v.idLevantamiento === null && !editando && (
              <>
                <Campo etiqueta="Cliente" requerido>
                  <Selector value={String(v.idCliente)}
                    onChange={(e) => cambiar("idCliente", e.target.value === "nuevo" ? "nuevo" : Number(e.target.value))}>
                    {clientes.map((c) => <option key={c.IdCliente} value={c.IdCliente}>{c.Cliente}</option>)}
                    <option value="nuevo">+ Cliente nuevo…</option>
                  </Selector>
                </Campo>
                {v.idCliente === "nuevo" ? (
                  <Campo etiqueta="Nombre del cliente nuevo" requerido>
                    <Entrada value={v.clienteNuevo} onChange={(e) => cambiar("clienteNuevo", e.target.value)} />
                  </Campo>
                ) : <div />}
              </>
            )}

            <Campo etiqueta="Descripción del proyecto" requerido className="md:col-span-2">
              <AreaTexto value={v.descripcion} onChange={(e) => cambiar("descripcion", e.target.value)} />
            </Campo>

            {!editando && (
              <Campo etiqueta="Contacto (usuario)">
                <Entrada value={v.contacto} onChange={(e) => cambiar("contacto", e.target.value)} />
              </Campo>
            )}
            <Campo etiqueta="Vendedor">
              <Selector value={v.idVendedor ?? ""} onChange={(e) => cambiar("idVendedor", e.target.value ? Number(e.target.value) : null)}>
                <option value="">Sin vendedor</option>
                {vendedores.map((u) => <option key={u.IdUsuario} value={u.IdUsuario}>{u.Usuario}</option>)}
              </Selector>
            </Campo>

            {editando ? (
              <Campo etiqueta="No. de cotización">
                <Entrada value={v.noCotizacion} disabled className="opacity-60" />
              </Campo>
            ) : (
              <Campo etiqueta="No. de cotización" requerido>
                <Entrada type="number" min={1} value={v.noCotizacion || ""}
                  onChange={(e) => cambiar("noCotizacion", Number(e.target.value) || 0)} />
              </Campo>
            )}
            <Campo etiqueta="Fecha de emisión" requerido>
              <Entrada type="date" value={v.fecha} onChange={(e) => cambiar("fecha", e.target.value)} />
            </Campo>

            <Campo
              etiqueta="Precio de venta sin IVA"
              requerido
              ayuda={precioDesdeCotizacion ? "Sale de las partidas de la cotización; edítalo allá." : "Lo que se le cobra al cliente."}
            >
              <Entrada type="number" min={0} step="0.01" value={v.precioVenta} disabled={precioDesdeCotizacion}
                className={precioDesdeCotizacion ? "opacity-60" : undefined}
                onChange={(e) => cambiar("precioVenta", Number(e.target.value) || 0)} />
            </Campo>
            <Campo etiqueta="ISR">
              <Entrada type="number" min={0} step="0.01" value={v.isr}
                onChange={(e) => cambiar("isr", Number(e.target.value) || 0)} />
            </Campo>

            <Campo etiqueta="Días de trabajo" requerido>
              <Entrada type="number" min={1} max={365} value={v.dias}
                onChange={(e) => cambiar("dias", Math.max(1, Number(e.target.value) || 1))} />
            </Campo>
            <Campo etiqueta="Administrativos" ayuda="5 %, 10 % o 15 % según el proyecto">
              <Selector value={v.porcentajes.administrativosPct}
                onChange={(e) => cambiar("porcentajes", { ...v.porcentajes, administrativosPct: Number(e.target.value) })}>
                {[5, 10, 15].map((p) => <option key={p} value={p}>{p} %</option>)}
                {![5, 10, 15].includes(v.porcentajes.administrativosPct) && (
                  <option value={v.porcentajes.administrativosPct}>{v.porcentajes.administrativosPct} %</option>
                )}
              </Selector>
            </Campo>

            <Campo etiqueta="Estatus de la cotización">
              <Selector value={v.statusCotizacion}
                onChange={(e) => cambiar("statusCotizacion", e.target.value as ValoresCosteo["statusCotizacion"])}>
                <option value="BORRADOR">Borrador (todavía no se manda)</option>
                <option value="ENVIADA">Enviada al cliente</option>
                <option value="AUTORIZADA">Autorizada por el cliente</option>
              </Selector>
            </Campo>
            {v.statusCotizacion === "AUTORIZADA" ? (
              <Campo etiqueta="Autorizó">
                <Entrada value={v.autorizadoPor} onChange={(e) => cambiar("autorizadoPor", e.target.value)} placeholder="AUTORIZA RODOLFO" />
              </Campo>
            ) : <div />}

            {editando && (
              <Campo etiqueta="Estatus del costeo" ayuda="En obra y cerrado piden la cotización autorizada">
                <Selector value={v.statusCosteo ?? "PLANEADO"}
                  onChange={(e) => cambiar("statusCosteo", e.target.value as ValoresCosteo["statusCosteo"])}>
                  <option value="PLANEADO">Planeado</option>
                  <option value="EN_PROCESO">En obra</option>
                  <option value="CERRADO">Cerrado</option>
                </Selector>
              </Campo>
            )}
          </div>
          <p className="mt-3 text-xs text-tinta-3">
            Impuestos {v.porcentajes.impuestosPct} % · financiamiento {v.porcentajes.financiamientoPct} % ·
            comisión {v.porcentajes.comisionPct} %{editando ? ", congelados al crear el costeo." : ", tal como venían en las fórmulas del Excel."}
          </p>
        </Carta>

        <TablaNomina filas={v.nomina} puestos={puestos} onChange={(nomina) => cambiar("nomina", nomina)} />
        <TablaInsumos filas={v.insumos} onChange={(insumos) => cambiar("insumos", insumos)} />
        <TablaGastos filas={v.gastos} onChange={(gastos) => cambiar("gastos", gastos)} />

        {editando && (
          <GastoReal
            plan={costeo.conceptos}
            real={v.conceptosReal}
            onChange={(real) => cambiar("conceptosReal", real)}
          />
        )}

        {error && (
          <p className="rounded border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">{error}</p>
        )}
        <div className="flex justify-end">
          <Boton onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar cotización y costeo"}
          </Boton>
        </div>
      </div>

      <aside className="xl:sticky xl:top-0 xl:self-start space-y-4">
        <Carta titulo="Resultado en vivo" etiqueta="Se recalcula al editar">
          <dl className="space-y-3">
            <Dato etiqueta="Gasto total (lo que cuesta hacerlo)" valor={formatoMoneda(costeo.gastoTotal)} />
            <Dato etiqueta="Precio de venta (lo que se cobra)" valor={formatoMoneda(costeo.precioVenta)} />
            <Dato etiqueta="Utilidad neta (lo que deja)" valor={formatoMoneda(costeo.utilidadNeta)} />
            <div>
              <dt className="etiqueta mb-1">Margen</dt>
              <dd className="flex items-center gap-2">
                {costeo.precioVenta <= 0 ? (
                  <span className="display text-3xl leading-none text-tinta-3">—</span>
                ) : (
                  <>
                    <span className={cn("display text-3xl leading-none",
                      semaforo === "bueno" ? "text-bueno" : semaforo === "alerta" ? "text-alerta" : "text-critico")}>
                      {formatoPorcentaje(costeo.margenPct)}
                    </span>
                    <Chip tono={semaforo}>{semaforo === "bueno" ? "Sano" : semaforo === "alerta" ? "Justo" : "Bajo"}</Chip>
                  </>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-borde pt-3 text-xs text-tinta-3">
            {personas} personas · {v.insumos.filter((i) => i.aplica).length} insumos que aplican · {v.gastos.length} gastos
          </p>
        </Carta>

        {referencia && <Cuadre referencia={referencia} gastoTotal={costeo.gastoTotal} utilidadNeta={costeo.utilidadNeta} />}
      </aside>
    </div>
  );
}

function suma(v: ValoresCosteo, concepto: ValoresCosteo["gastos"][number]["concepto"]): number {
  return v.gastos.filter((g) => g.concepto === concepto).reduce((s, g) => s + g.cantidad, 0);
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="etiqueta">{etiqueta}</dt>
      <dd className="num-tab text-lg text-tinta">{valor}</dd>
    </div>
  );
}

function Cuadre({ referencia, gastoTotal, utilidadNeta }: { referencia: ReferenciaExcel; gastoTotal: number; utilidadNeta: number }) {
  const cuadra =
    Math.abs(gastoTotal - referencia.gastoTotal) < TOLERANCIA_CUADRE &&
    Math.abs(utilidadNeta - referencia.utilidadNeta) < TOLERANCIA_CUADRE;
  return (
    <Carta titulo="Cuadre con el Excel" etiqueta="Lo que el archivo decía">
      <dl className="space-y-2 text-sm">
        <Comparacion etiqueta="Gasto total" excel={referencia.gastoTotal} calculado={gastoTotal} />
        <Comparacion etiqueta="Utilidad neta" excel={referencia.utilidadNeta} calculado={utilidadNeta} />
      </dl>
      <div className="mt-3">
        <Chip tono={cuadra ? "bueno" : "alerta"}>{cuadra ? "Cuadra al peso" : "No cuadra"}</Chip>
        {!cuadra && (
          <p className="mt-2 text-xs text-tinta-3">
            Si editaste algo, es normal. Si no, alguna hoja del Excel no se leyó completa: revisa nómina, insumos y gastos.
          </p>
        )}
      </div>
    </Carta>
  );
}

function Comparacion({ etiqueta, excel, calculado }: { etiqueta: string; excel: number; calculado: number }) {
  const diferencia = calculado - excel;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-tinta-2">{etiqueta}</dt>
      <dd className="text-right">
        <span className="num-tab text-tinta">{formatoMoneda(excel)}</span>
        <span className={cn("num-tab ml-2 text-xs", Math.abs(diferencia) < TOLERANCIA_CUADRE ? "text-tinta-3" : "text-alerta")}>
          {diferencia >= 0 ? "+" : "−"}{formatoMoneda(Math.abs(diferencia))}
        </span>
      </dd>
    </div>
  );
}

function LigaLevantamiento({ levantamiento, ligado }: { levantamiento: LevantamientoLigado | null; ligado: boolean }) {
  if (ligado && levantamiento) {
    return (
      <p className="flex items-center gap-2 rounded border border-bueno/40 bg-bueno/10 px-3 py-2 text-sm text-tinta">
        <Link2 size={15} className="text-bueno" />
        Se ligará al levantamiento {levantamiento.folio} de {levantamiento.cliente}; el cliente sale de ahí.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 rounded border border-borde bg-fondo px-3 py-2 text-sm text-tinta-2">
      <Link2Off size={15} className="text-tinta-3" />
      Sin levantamiento ligado: la cotización y el costeo se guardan solos. Puedes importar el PDF del levantamiento después.
    </p>
  );
}

/** Plan contra real por concepto: lo que se presupuestó y lo que de verdad se gastó. */
function GastoReal({
  plan, real, onChange,
}: {
  plan: Record<Concepto, number>;
  real: Record<Concepto, number> | null;
  onChange: (real: Record<Concepto, number> | null) => void;
}) {
  const activo = real !== null;
  const valores = real ?? (Object.fromEntries(CONCEPTOS.map((c) => [c, 0])) as Record<Concepto, number>);
  return (
    <Carta
      titulo="Gasto real"
      etiqueta="Lo que de verdad se gastó, concepto por concepto; se compara con el plan"
      accion={
        <label className="flex cursor-pointer items-center gap-2 text-xs text-tinta-2">
          <input type="checkbox" checked={activo} className="size-4 accent-[var(--color-acento)]"
            onChange={(e) => onChange(e.target.checked ? { ...plan } : null)} />
          Capturar gasto real
        </label>
      }
    >
      {!activo ? (
        <p className="py-4 text-center text-sm text-tinta-3">
          Sin gasto real todavía. Actívalo cuando el trabajo esté en obra; arranca con los valores del plan.
        </p>
      ) : (
        <Tabla>
          <Encabezados columnas={[
            { texto: "Concepto" }, { texto: "Plan", derecha: true, ancho: "130px" },
            { texto: "Real", derecha: true, ancho: "150px" }, { texto: "Diferencia", derecha: true, ancho: "130px" },
          ]} />
          <tbody>
            {CONCEPTOS.map((c) => {
              const diferencia = valores[c] - plan[c];
              return (
                <Fila key={c}>
                  <Celda>{ETIQUETA_CONCEPTO[c]}</Celda>
                  <Celda derecha mono apagada>{formatoMoneda(plan[c])}</Celda>
                  <Celda derecha>
                    <Entrada type="number" min={0} step="0.01" className="px-2 py-1 text-right num-tab" value={valores[c]}
                      onChange={(e) => onChange({ ...valores, [c]: Math.max(0, Number(e.target.value) || 0) })} />
                  </Celda>
                  <Celda derecha mono className={diferencia > 0 ? "text-critico" : diferencia < 0 ? "text-bueno" : "text-tinta-3"}>
                    {diferencia === 0 ? "—" : formatoMoneda(diferencia)}
                  </Celda>
                </Fila>
              );
            })}
          </tbody>
        </Tabla>
      )}
    </Carta>
  );
}
