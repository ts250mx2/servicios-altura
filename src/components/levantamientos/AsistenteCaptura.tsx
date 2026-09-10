"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { AreaTexto, Boton, Campo, Carta, Entrada, Selector } from "@/components/ui/Basicos";
import { Chip } from "@/components/ui/Chip";
import { calcularCosteo, precioPorMargen, precioPorTarifa, semaforoMargen } from "@/lib/costeo/motor";
import { ETIQUETA_CONCEPTO, CONCEPTOS, type Concepto } from "@/lib/costeo/tipos";
import type { Cliente, Insumo, Puesto } from "@/lib/consultas/catalogos";
import { formatoMoneda, formatoPorcentaje } from "@/lib/formato";
import { hoyIso } from "@/lib/fechas";
import type {
  Actividad, LineaInsumo, LineaPersonal, NivelRiesgo, ValoresIniciales,
} from "@/lib/levantamientos/tipos";
import { cn } from "@/lib/utils";

const PASOS = ["Datos", "Trabajo", "Recursos", "Resultado"] as const;

export function AsistenteCaptura({
  clientes, puestos, insumos, folio, noCotizacion, parametros, modoCampo, inicial, idImportacion,
  modo = "nuevo", idLevantamiento, tieneCotizacion = false, pasoInicial = 0, statusActual = "BORRADOR",
}: {
  clientes: Cliente[];
  puestos: Puesto[];
  insumos: Insumo[];
  folio: number;
  noCotizacion: number;
  parametros: Record<string, number>;
  modoCampo: boolean;
  /** Valores con los que abre el asistente (p. ej. lo extraído de un PDF o lo ya guardado). */
  inicial?: ValoresIniciales;
  /** Importación que se aplica al guardar: el servidor liga las fotos y la cierra. */
  idImportacion?: number;
  /** "editar" guarda con PUT sobre un levantamiento existente. */
  modo?: "nuevo" | "editar";
  idLevantamiento?: number;
  /** Con cotización ya generada, el paso 4 se oculta: se edita desde la cotización. */
  tieneCotizacion?: boolean;
  pasoInicial?: number;
  /** Al editar, el estatus que ya tiene: guardar cambios no lo mueve. */
  statusActual?: "BORRADOR" | "CERRADO" | "COTIZADO";
}) {
  const router = useRouter();
  const editando = modo === "editar";
  const ultimoPaso = modoCampo || (editando && tieneCotizacion) ? 2 : 3;
  const [paso, setPaso] = useState(Math.min(Math.max(0, pasoInicial), ultimoPaso));
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Paso 1 · datos ──────────────────────────────────────────────────────
  const [idCliente, setIdCliente] = useState<number | "nuevo">(
    inicial?.idCliente ?? clientes[0]?.IdCliente ?? "nuevo",
  );
  const [clienteNuevo, setClienteNuevo] = useState(inicial?.clienteNuevo ?? "");
  const [proyecto, setProyecto] = useState(inicial?.proyecto ?? "");
  const [areaTrabajo, setAreaTrabajo] = useState(inicial?.areaTrabajo ?? "");
  const [usuarioContacto, setUsuarioContacto] = useState(inicial?.usuarioContacto ?? "");
  const [correoUsuario, setCorreoUsuario] = useState(inicial?.correoUsuario ?? "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyIso());
  const [nivelRiesgo, setNivelRiesgo] = useState<NivelRiesgo>(inicial?.nivelRiesgo ?? "ALTO");
  const [dias, setDias] = useState(inicial?.dias ?? 1);
  const [trabajoNormal, setTrabajoNormal] = useState(inicial?.trabajoNormal ?? true);
  const [trabajoExtra, setTrabajoExtra] = useState(inicial?.trabajoExtra ?? false);
  const [aplicaCena, setAplicaCena] = useState(inicial?.aplicaCena ?? false);
  const [aplicaBono, setAplicaBono] = useState(inicial?.aplicaBono ?? true);
  const [elaboro, setElaboro] = useState(inicial?.elaboro ?? "");

  // ── Paso 2 · trabajo ────────────────────────────────────────────────────
  const [actividades, setActividades] = useState<Actividad[]>(
    inicial?.actividades ?? [{ descripcion: "", metros: 0 }],
  );
  const [observaciones, setObservaciones] = useState(inicial?.observaciones ?? "");

  // ── Paso 3 · recursos ───────────────────────────────────────────────────
  const [personal, setPersonal] = useState<LineaPersonal[]>(
    puestos.map(
      (p) =>
        inicial?.personal.find((l) => l.idPuesto === p.IdPuesto) ??
        { idPuesto: p.IdPuesto, cantidad: 0, tiempoExtra: false, bono: false },
    ),
  );
  const [lineasInsumo, setLineasInsumo] = useState<LineaInsumo[]>(inicial?.insumos ?? []);

  // ── Paso 4 · resultado ──────────────────────────────────────────────────
  const [gasolina, setGasolina] = useState(0);
  const [administrativo, setAdministrativo] = useState(0);
  const [epp, setEpp] = useState(0);
  const [equipo, setEquipo] = useState(0);
  const [metodoPrecio, setMetodoPrecio] = useState<"TARIFA" | "MARGEN" | "MANUAL">("TARIFA");
  const [precioManual, setPrecioManual] = useState(0);
  const [margenObjetivo, setMargenObjetivo] = useState(parametros.MARGEN_OBJETIVO_PCT ?? 50);
  const [administrativosPct, setAdministrativosPct] = useState(parametros.ADMINISTRATIVOS_PCT ?? 5);

  const porcentajes = {
    impuestosPct: parametros.IMPUESTOS_PCT ?? 10,
    administrativosPct,
    financiamientoPct: parametros.FINANCIAMIENTO_PCT ?? 5,
    comisionPct: parametros.COMISION_PCT ?? 4,
  };

  // ── Costeo en vivo ──────────────────────────────────────────────────────
  const nomina = useMemo(
    () =>
      personal
        .filter((l) => l.cantidad > 0)
        .flatMap((l) => {
          const p = puestos.find((x) => x.IdPuesto === l.idPuesto)!;
          return Array.from({ length: l.cantidad }, (_, i) => ({
            nombre: `${p.Abreviatura} ${i + 1}`,
            idPuesto: p.IdPuesto,
            salarioDiario: Number(p.SalarioDiario),
            imssDiario: Number(p.ImssDiario),
            desgasteDiario: Number(p.DesgasteDiario),
            bono: l.bono ? Number(p.BonoDefault) : 0,
            diasLaborados: dias,
          }));
        }),
    [personal, puestos, dias],
  );

  const partidasInsumo = useMemo(
    () =>
      lineasInsumo.map((l) => ({
        descripcion: l.descripcion,
        unidades: l.cantidad,
        costo: l.costo,
        aplica: l.aplica,
      })),
    [lineasInsumo],
  );

  const sinPrecio = useMemo(
    () =>
      calcularCosteo({
        nomina,
        insumos: partidasInsumo,
        gastos: { gasolina, administrativo, epp, equipo },
        porcentajes,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nomina, partidasInsumo, gasolina, administrativo, epp, equipo, administrativosPct],
  );

  const precioTarifa = useMemo(
    () =>
      precioPorTarifa(
        personal
          .filter((l) => l.cantidad > 0)
          .map((l) => {
            const p = puestos.find((x) => x.IdPuesto === l.idPuesto)!;
            return {
              cantidad: l.cantidad,
              tarifaVentaDia: Number(p.TarifaVentaDia),
              bono: l.bono ? Number(p.BonoDefault) : 0,
            };
          }),
        dias,
      ),
    [personal, puestos, dias],
  );

  const precioVenta =
    metodoPrecio === "TARIFA"
      ? precioTarifa
      : metodoPrecio === "MARGEN"
        ? precioPorMargen(sinPrecio.gastoTotal, margenObjetivo, porcentajes.comisionPct)
        : precioManual;

  const costeo = useMemo(
    () =>
      calcularCosteo({
        nomina,
        insumos: partidasInsumo,
        gastos: { gasolina, administrativo, epp, equipo },
        porcentajes,
        precioVenta,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nomina, partidasInsumo, gasolina, administrativo, epp, equipo, precioVenta, administrativosPct],
  );

  const totalPersonas = personal.reduce((s, l) => s + l.cantidad, 0);
  const semaforo = semaforoMargen(
    costeo.margenPct,
    parametros.MARGEN_ALERTA_PCT ?? 30,
  );

  // ── Validación por paso ─────────────────────────────────────────────────
  const errores: Record<number, string | null> = {
    0:
      !proyecto.trim()
        ? "Escribe la descripción del proyecto."
        : idCliente === "nuevo" && !clienteNuevo.trim()
          ? "Escribe el nombre del cliente."
          : dias < 1
            ? "Los días de trabajo deben ser al menos 1."
            : null,
    1: actividades.every((a) => !a.descripcion.trim())
      ? "Captura al menos una actividad del trabajo a realizar."
      : null,
    2: totalPersonas === 0 ? "Asigna al menos una persona al proyecto." : null,
    3: null,
  };
  const errorPaso = errores[paso];

  async function guardar(cerrar: boolean) {
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await fetch(editando ? `/api/levantamientos/${idLevantamiento}` : "/api/levantamientos", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levantamiento: {
            folio, idCliente: idCliente === "nuevo" ? null : idCliente, clienteNuevo,
            proyecto, areaTrabajo, usuarioContacto, correoUsuario, fecha, nivelRiesgo,
            dias, trabajoNormal, trabajoExtra, aplicaCena, aplicaBono, observaciones, elaboro,
            status: cerrar ? "COTIZADO" : editando ? statusActual : "BORRADOR",
          },
          importacion: idImportacion ? { idImportacion } : null,
          actividades: actividades.filter((a) => a.descripcion.trim()),
          personal: personal.filter((l) => l.cantidad > 0),
          insumos: lineasInsumo.filter((l) => l.descripcion.trim()),
          costeo: cerrar && !tieneCotizacion
            ? {
                noCotizacion, metodoPrecio, precioVenta, porcentajes,
                gastos: { gasolina, administrativo, epp, equipo },
              }
            : null,
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.mensaje ?? "No se pudo guardar.");
        return;
      }
      router.push(
        datos.idCosteo ? `/dashboard/costeos/${datos.idCosteo}` : `/dashboard/levantamientos/${datos.idLevantamiento}`,
      );
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        {/* Indicador de pasos */}
        <ol className="mb-4 flex overflow-hidden rounded border border-borde">
          {PASOS.slice(0, ultimoPaso + 1).map((nombre, i) => (
            <li key={nombre} className="flex-1">
              <button
                type="button"
                onClick={() => i <= paso && setPaso(i)}
                disabled={i > paso}
                className={cn(
                  "flex w-full items-center justify-center gap-2 px-2 py-2.5 text-xs font-semibold tracking-wide uppercase transition-colors duration-150",
                  i === paso
                    ? "bg-acento text-sobre-acento"
                    : i < paso
                      ? "bg-superficie-2 text-tinta hover:bg-borde"
                      : "bg-superficie text-tinta-3",
                )}
              >
                {i < paso ? <Check size={14} strokeWidth={3} /> : <span className="num-tab">{i + 1}</span>}
                <span className="hidden sm:inline">{nombre}</span>
              </button>
            </li>
          ))}
        </ol>

        {paso === 0 && (
          <Carta titulo="Datos del proyecto" etiqueta={`Folio ${folio}`}>
            <div className="grid gap-4 md:grid-cols-2">
              <Campo etiqueta="Cliente" requerido className="md:col-span-2">
                <Selector
                  value={String(idCliente)}
                  onChange={(e) =>
                    setIdCliente(e.target.value === "nuevo" ? "nuevo" : Number(e.target.value))
                  }
                >
                  {clientes.map((c) => (
                    <option key={c.IdCliente} value={c.IdCliente}>
                      {c.Cliente}
                      {c.Planta ? ` · ${c.Planta}` : ""}
                    </option>
                  ))}
                  <option value="nuevo">+ Cliente nuevo…</option>
                </Selector>
              </Campo>

              {idCliente === "nuevo" && (
                <Campo etiqueta="Nombre del cliente nuevo" requerido className="md:col-span-2">
                  <Entrada value={clienteNuevo} onChange={(e) => setClienteNuevo(e.target.value)}
                    placeholder="IGLESIA SAN JUAN DE LOS LAGOS" />
                </Campo>
              )}

              <Campo etiqueta="Proyecto" requerido className="md:col-span-2"
                ayuda="Lo que va como título en la hoja y en la cotización.">
                <AreaTexto value={proyecto} onChange={(e) => setProyecto(e.target.value)}
                  placeholder="SERVICIO POR LIMPIEZA Y APLICACIÓN DE SILICÓN DURETÁN EN ALUMINIO Y CRISTAL…" />
              </Campo>

              <Campo etiqueta="Área de trabajo">
                <Entrada value={areaTrabajo} onChange={(e) => setAreaTrabajo(e.target.value)}
                  placeholder="VENTANALES DE LA PARROQUIA (EXTERIOR)" />
              </Campo>

              <Campo etiqueta="Usuario / contacto en sitio">
                <Entrada value={usuarioContacto} onChange={(e) => setUsuarioContacto(e.target.value)}
                  placeholder="PADRE JAVIER LOZANO" />
              </Campo>

              <Campo etiqueta="Correo del usuario">
                <Entrada type="email" value={correoUsuario}
                  onChange={(e) => setCorreoUsuario(e.target.value)} />
              </Campo>

              <Campo etiqueta="Elaboró">
                <Entrada value={elaboro} onChange={(e) => setElaboro(e.target.value)}
                  placeholder="JUAN GAYTÁN MARTÍNEZ" />
              </Campo>

              <Campo etiqueta="Fecha" requerido>
                <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </Campo>

              <Campo etiqueta="Días de trabajo" requerido>
                <Entrada type="number" min={1} max={180} value={dias}
                  onChange={(e) => setDias(Math.max(1, Number(e.target.value) || 1))} />
              </Campo>

              <Campo etiqueta="Nivel de riesgo">
                <Selector value={nivelRiesgo}
                  onChange={(e) => setNivelRiesgo(e.target.value as typeof nivelRiesgo)}>
                  <option value="ALTO">Alto</option>
                  <option value="MEDIO">Medio</option>
                  <option value="BAJO">Bajo</option>
                </Selector>
              </Campo>

              <div className="flex flex-wrap items-center gap-4 md:col-span-2">
                {([
                  ["Trabajo normal", trabajoNormal, setTrabajoNormal],
                  ["Tiempo extra", trabajoExtra, setTrabajoExtra],
                  ["Aplica cena", aplicaCena, setAplicaCena],
                  ["Aplica bono", aplicaBono, setAplicaBono],
                ] as const).map(([texto, valor, set]) => (
                  <label key={texto} className="flex cursor-pointer items-center gap-2 text-sm text-tinta-2">
                    <input type="checkbox" checked={valor} onChange={(e) => set(e.target.checked)}
                      className="size-4 accent-[var(--color-acento)]" />
                    {texto}
                  </label>
                ))}
              </div>
            </div>
          </Carta>
        )}

        {paso === 1 && (
          <Carta
            titulo="Trabajo a realizar"
            etiqueta="Paso a paso, en el orden de ejecución"
            accion={
              <Boton variante="secundario"
                onClick={() => setActividades([...actividades, { descripcion: "", metros: 0 }])}>
                <Plus size={14} /> Actividad
              </Boton>
            }
          >
            <ol className="space-y-3">
              {actividades.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="num-tab mt-2.5 w-5 shrink-0 text-sm text-tinta-3">{i + 1}</span>
                  <AreaTexto
                    value={a.descripcion}
                    onChange={(e) => {
                      const copia = [...actividades];
                      copia[i] = { ...copia[i], descripcion: e.target.value };
                      setActividades(copia);
                    }}
                    placeholder="Instalación de líneas de vida horizontales fijadas a puntos de anclaje estructurales…"
                  />
                  <div className="w-24 shrink-0">
                    <Entrada type="number" min={0} step="0.01" value={a.metros || ""}
                      placeholder="m²"
                      onChange={(e) => {
                        const copia = [...actividades];
                        copia[i] = { ...copia[i], metros: Number(e.target.value) || 0 };
                        setActividades(copia);
                      }} />
                  </div>
                  <Boton variante="fantasma" aria-label="Quitar actividad"
                    onClick={() => setActividades(actividades.filter((_, j) => j !== i))}>
                    <Trash2 size={15} />
                  </Boton>
                </li>
              ))}
            </ol>

            <div className="mt-5">
              <Campo etiqueta="Observaciones del trabajo">
                <AreaTexto value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="LA COTIZACIÓN SE GENERARÁ POR EL EXTERIOR E INTERIOR · SÓLO SE GENERA COSTO POR MANO DE OBRA" />
              </Campo>
            </div>
          </Carta>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <Carta titulo="Personal" etiqueta={`${totalPersonas} personas × ${dias} días`}>
              <ul className="space-y-2">
                {personal.map((l, i) => {
                  const p = puestos.find((x) => x.IdPuesto === l.idPuesto)!;
                  return (
                    <li key={l.idPuesto}
                      className="flex flex-wrap items-center gap-3 rounded border border-borde bg-fondo px-3 py-2.5">
                      <div className="min-w-32 flex-1">
                        <p className="text-sm text-tinta">{p.Puesto}</p>
                        <p className="num-tab text-xs text-tinta-3">
                          {formatoMoneda(p.SalarioDiario)}/día · venta {formatoMoneda(p.TarifaVentaDia)}/día
                        </p>
                      </div>

                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-tinta-2">
                        <input type="checkbox" checked={l.bono}
                          onChange={(e) => {
                            const copia = [...personal];
                            copia[i] = { ...copia[i], bono: e.target.checked };
                            setPersonal(copia);
                          }}
                          className="size-3.5 accent-[var(--color-acento)]" />
                        Bono
                      </label>

                      <div className="flex items-center gap-1">
                        <Boton variante="secundario" className="size-9 p-0"
                          onClick={() => {
                            const copia = [...personal];
                            copia[i] = { ...copia[i], cantidad: Math.max(0, copia[i].cantidad - 1) };
                            setPersonal(copia);
                          }}>−</Boton>
                        <span className="num-tab w-9 text-center text-base text-tinta">{l.cantidad}</span>
                        <Boton variante="secundario" className="size-9 p-0"
                          onClick={() => {
                            const copia = [...personal];
                            copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
                            setPersonal(copia);
                          }}>+</Boton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Carta>

            <Carta
              titulo="Insumos y herramental"
              etiqueta="Escribe y elige del catálogo, o captura libre"
              accion={
                <Boton variante="secundario"
                  onClick={() =>
                    setLineasInsumo([
                      ...lineasInsumo,
                      { idInsumo: null, descripcion: "", cantidad: 1, costo: 0, esHerramental: false, aplica: true },
                    ])
                  }>
                  <Plus size={14} /> Partida
                </Boton>
              }
            >
              {lineasInsumo.length === 0 ? (
                <p className="py-6 text-center text-sm text-tinta-3">
                  Sin insumos. Si el cliente pone el material, deja esta sección vacía.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lineasInsumo.map((l, i) => (
                    <li key={i} className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-12 md:col-span-6">
                        <Entrada
                          list="catalogo-insumos"
                          value={l.descripcion}
                          placeholder="CARTUCHOS DE SILICÓN DURETÁN…"
                          onChange={(e) => {
                            const texto = e.target.value;
                            const encontrado = insumos.find(
                              (x) => x.Insumo.toUpperCase() === texto.toUpperCase(),
                            );
                            const copia = [...lineasInsumo];
                            copia[i] = {
                              ...copia[i],
                              descripcion: texto,
                              idInsumo: encontrado?.IdInsumo ?? null,
                              esHerramental: encontrado ? encontrado.EsHerramental === 1 : copia[i].esHerramental,
                              costo: encontrado
                                ? Number(encontrado.CostoUnitario) * copia[i].cantidad
                                : copia[i].costo,
                            };
                            setLineasInsumo(copia);
                          }}
                        />
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <Entrada type="number" min={0} step="0.01" value={l.cantidad} placeholder="Cant."
                          onChange={(e) => {
                            const cantidad = Number(e.target.value) || 0;
                            const cat = insumos.find((x) => x.IdInsumo === l.idInsumo);
                            const copia = [...lineasInsumo];
                            copia[i] = {
                              ...copia[i],
                              cantidad,
                              costo: cat ? Number(cat.CostoUnitario) * cantidad : copia[i].costo,
                            };
                            setLineasInsumo(copia);
                          }} />
                      </div>
                      <div className="col-span-5 md:col-span-2">
                        <Entrada type="number" min={0} step="0.01" value={l.costo} placeholder="Costo"
                          onChange={(e) => {
                            const copia = [...lineasInsumo];
                            copia[i] = { ...copia[i], costo: Number(e.target.value) || 0 };
                            setLineasInsumo(copia);
                          }} />
                      </div>
                      <div className="col-span-4 flex items-center gap-1 md:col-span-2">
                        <label className="flex cursor-pointer items-center gap-1 text-xs text-tinta-2"
                          title="Desmarca cuando el material lo pone el cliente">
                          <input type="checkbox" checked={l.aplica}
                            onChange={(e) => {
                              const copia = [...lineasInsumo];
                              copia[i] = { ...copia[i], aplica: e.target.checked };
                              setLineasInsumo(copia);
                            }}
                            className="size-3.5 accent-[var(--color-acento)]" />
                          Aplica
                        </label>
                        <Boton variante="fantasma" aria-label="Quitar partida"
                          onClick={() => setLineasInsumo(lineasInsumo.filter((_, j) => j !== i))}>
                          <Trash2 size={15} />
                        </Boton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <datalist id="catalogo-insumos">
                {insumos.map((i) => <option key={i.IdInsumo} value={i.Insumo} />)}
              </datalist>
            </Carta>
          </div>
        )}

        {paso === 3 && !modoCampo && (
          <div className="space-y-4">
            <Carta titulo="Otros gastos" etiqueta="Fuera de nómina e insumos">
              <div className="grid gap-4 sm:grid-cols-4">
                {([
                  ["Gasolina", gasolina, setGasolina],
                  ["Administrativo", administrativo, setAdministrativo],
                  ["EPP", epp, setEpp],
                  ["Compra de equipo", equipo, setEquipo],
                ] as const).map(([texto, valor, set]) => (
                  <Campo key={texto} etiqueta={texto}>
                    <Entrada type="number" min={0} step="0.01" value={valor}
                      onChange={(e) => set(Number(e.target.value) || 0)} />
                  </Campo>
                ))}
              </div>
            </Carta>

            <Carta titulo="Precio de venta" etiqueta="Tres formas de llegar al mismo lugar">
              <div className="mb-4 flex rounded border border-borde">
                {([
                  ["TARIFA", "Por tarifa"],
                  ["MARGEN", "Por margen"],
                  ["MANUAL", "Manual"],
                ] as const).map(([valor, texto]) => (
                  <button key={valor} type="button" onClick={() => setMetodoPrecio(valor)}
                    className={cn(
                      "flex-1 px-3 py-2 text-xs font-semibold tracking-wide uppercase transition-colors duration-150",
                      metodoPrecio === valor
                        ? "bg-acento text-sobre-acento"
                        : "text-tinta-2 hover:bg-superficie-2",
                    )}>
                    {texto}
                  </button>
                ))}
              </div>

              {metodoPrecio === "TARIFA" && (
                <p className="text-sm text-tinta-2">
                  {totalPersonas} personas × {dias} días según la tarifa de cada puesto
                  {aplicaBono ? ", más los bonos marcados" : ""} ={" "}
                  <span className="num-tab text-tinta">{formatoMoneda(precioTarifa)}</span>
                </p>
              )}

              {metodoPrecio === "MARGEN" && (
                <div className="flex flex-wrap items-end gap-4">
                  <Campo etiqueta="Margen objetivo" className="w-36">
                    <Entrada type="number" min={0} max={90} step="0.5" value={margenObjetivo}
                      onChange={(e) => setMargenObjetivo(Number(e.target.value) || 0)} />
                  </Campo>
                  <p className="pb-2 text-sm text-tinta-2">
                    Precio necesario:{" "}
                    <span className="num-tab text-tinta">{formatoMoneda(precioVenta)}</span>
                  </p>
                </div>
              )}

              {metodoPrecio === "MANUAL" && (
                <Campo etiqueta="Precio de venta sin IVA" className="max-w-56">
                  <Entrada type="number" min={0} step="0.01" value={precioManual}
                    onChange={(e) => setPrecioManual(Number(e.target.value) || 0)} />
                </Campo>
              )}

              <div className="mt-4 border-t border-borde pt-4">
                <Campo etiqueta="Administrativos" ayuda="5 %, 10 % o 15 % según el proyecto" className="max-w-40">
                  <Selector value={administrativosPct}
                    onChange={(e) => setAdministrativosPct(Number(e.target.value))}>
                    <option value={5}>5 %</option>
                    <option value={10}>10 %</option>
                    <option value={15}>15 %</option>
                  </Selector>
                </Campo>
              </div>
            </Carta>

            <Carta titulo="Cadena de costeo" etiqueta="Igual que la hoja del Excel">
              <dl className="space-y-1.5 text-sm">
                {CONCEPTOS.map((c) => {
                  const valor = costeo.conceptos[c as Concepto];
                  if (valor === 0) return null;
                  return (
                    <div key={c} className="flex justify-between text-tinta-2">
                      <dt className="pl-3">{ETIQUETA_CONCEPTO[c as Concepto]}</dt>
                      <dd className="num-tab">{formatoMoneda(valor)}</dd>
                    </div>
                  );
                })}
                <Renglon etiqueta="Gasto directo" valor={costeo.gastoDirecto} fuerte />
                <Renglon etiqueta={`Impuestos ${porcentajes.impuestosPct} %`} valor={costeo.impuestos} />
                <Renglon etiqueta={`Administrativos ${administrativosPct} %`} valor={costeo.administrativos} />
                <Renglon etiqueta="Insumos" valor={costeo.insumos} />
                <Renglon etiqueta={`Financiamiento ${porcentajes.financiamientoPct} %`} valor={costeo.financiamiento} />
                <Renglon etiqueta="Gasto total" valor={costeo.gastoTotal} fuerte />
                <Renglon etiqueta="Precio de venta" valor={costeo.precioVenta} fuerte />
                <Renglon etiqueta="Utilidad bruta" valor={costeo.utilidadBruta} />
                <Renglon etiqueta={`Comisión ${porcentajes.comisionPct} %`} valor={-costeo.comision} />
                <Renglon etiqueta="Utilidad neta" valor={costeo.utilidadNeta} fuerte />
              </dl>
            </Carta>
          </div>
        )}

        {(error || (intento && errorPaso)) && (
          <p className="mt-4 rounded border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">
            {error ?? errorPaso}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <Boton variante="secundario"
            onClick={() => { setIntento(false); setPaso(Math.max(0, paso - 1)); }}
            disabled={paso === 0}>
            <ChevronLeft size={15} /> Atrás
          </Boton>

          <div className="flex gap-2">
            <Boton variante="fantasma" onClick={() => guardar(false)} disabled={guardando || !!errores[0]}>
              {editando ? "Guardar cambios" : "Guardar borrador"}
            </Boton>
            {paso < ultimoPaso ? (
              <Boton
                onClick={() => {
                  if (errorPaso) { setIntento(true); return; }
                  setIntento(false);
                  setPaso(paso + 1);
                }}
              >
                Siguiente <ChevronRight size={15} />
              </Boton>
            ) : (
              <Boton onClick={() => guardar(true)} disabled={guardando || (!modoCampo && !tieneCotizacion && precioVenta <= 0)}>
                {guardando
                  ? "Guardando…"
                  : tieneCotizacion
                    ? "Guardar cambios"
                    : modoCampo
                      ? "Cerrar levantamiento"
                      : "Generar cotización y costeo"}
              </Boton>
            )}
          </div>
        </div>
      </div>

      {/* Resumen vivo: el margen se conoce mientras se captura, no después. */}
      {!modoCampo && (
        <aside className="xl:sticky xl:top-0 xl:self-start">
          <Carta titulo="Resultado en vivo" etiqueta="Se recalcula al capturar">
            <dl className="space-y-3">
              <div>
                <dt className="etiqueta">Gasto total</dt>
                <dd className="num-tab text-lg text-tinta">{formatoMoneda(costeo.gastoTotal)}</dd>
              </div>
              <div>
                <dt className="etiqueta">Precio de venta</dt>
                <dd className="num-tab text-lg text-tinta">{formatoMoneda(costeo.precioVenta)}</dd>
              </div>
              <div>
                <dt className="etiqueta">Utilidad neta</dt>
                <dd className="num-tab text-lg text-tinta">{formatoMoneda(costeo.utilidadNeta)}</dd>
              </div>
              <div>
                <dt className="etiqueta mb-1">Margen</dt>
                <dd className="flex items-center gap-2">
                  {costeo.precioVenta <= 0 ? (
                    <span className="display text-3xl leading-none text-tinta-3">—</span>
                  ) : (
                    <>
                      <span className={cn(
                        "display text-3xl leading-none",
                        semaforo === "bueno" ? "text-bueno" : semaforo === "alerta" ? "text-alerta" : "text-critico",
                      )}>
                        {formatoPorcentaje(costeo.margenPct)}
                      </span>
                      <Chip tono={semaforo}>
                        {semaforo === "bueno" ? "Sano" : semaforo === "alerta" ? "Justo" : "Bajo"}
                      </Chip>
                    </>
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-4 space-y-1 border-t border-borde pt-3 text-xs text-tinta-3">
              <p>{totalPersonas} personas · {dias} días · {totalPersonas * dias} personas-día</p>
              <p>{actividades.filter((a) => a.descripcion.trim()).length} actividades</p>
              <p>{lineasInsumo.filter((l) => l.aplica).length} partidas de insumo</p>
            </div>
          </Carta>
        </aside>
      )}
    </div>
  );
}

function Renglon({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div className={cn(
      "flex justify-between",
      fuerte ? "border-t border-borde pt-1.5 font-semibold text-tinta" : "text-tinta-2",
    )}>
      <dt>{etiqueta}</dt>
      <dd className="num-tab">{formatoMoneda(valor)}</dd>
    </div>
  );
}
