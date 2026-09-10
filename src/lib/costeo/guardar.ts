import type { PoolConnection } from "mysql2/promise";
import { ErrorDeNegocio } from "@/lib/errores";
import { diasDelProyecto } from "@/lib/fechas";
import { centavos } from "@/lib/formato";
import type { Concepto, RenglonNomina, ResultadoCosteo } from "./tipos";

export type StatusCosteo = "PLANEADO" | "EN_PROCESO" | "CERRADO";

/** Encabezado de la cotización que se va a insertar o actualizar. */
export interface CabeceraCotizacion {
  noCotizacion: number;
  idLevantamiento: number | null;
  idCliente: number;
  idVendedor: number | null;
  fecha: string;
  descripcion: string;
  metodoPrecio: "TARIFA" | "MARGEN" | "MANUAL";
  status: "BORRADOR" | "ENVIADA" | "AUTORIZADA";
  autorizadoPor: string | null;
  ivaPct: number;
  idUsuario: number;
}

export interface InsumoCosteo {
  idInsumo: number | null;
  descripcion: string;
  unidades: number;
  costo: number;
  aplica: boolean;
  costoReal: number;
}

export interface GastoCosteo {
  concepto: "GASOLINA" | "ADMINISTRATIVO" | "EPP" | "EQUIPO";
  fecha: string | null;
  descripcion: string | null;
  cantidad: number;
}

/** Todo lo que se escribe en las tablas de costeo. `resultado` ya viene del motor. */
export interface DetalleCosteo {
  dias: number;
  isr: number;
  resultado: ResultadoCosteo;
  nomina: RenglonNomina[];
  insumos: InsumoCosteo[];
  gastos: GastoCosteo[];
  /** Presente cuando ya hay gasto real distinto del plan. */
  real: { conceptos: Record<Concepto, number>; resultado: ResultadoCosteo } | null;
  /** Si no viene, se deriva: EN_PROCESO con real, PLANEADO sin él. */
  status?: StatusCosteo;
}

type Alta = { insertId: number };

/**
 * Número de cotización definitivo. Captura manual: nunca menor al siguiente
 * consecutivo, para que dos capturistas no choquen. Importación (`exacto`): el
 * número del papel tal cual, porque es histórico. El bloqueo del máximo se toma
 * en los dos casos a propósito: serializa las altas simultáneas y convierte un
 * choque en un 409 claro, no en llave duplicada.
 */
export async function resolverNoCotizacion(cx: PoolConnection, pedido: number, exacto: boolean): Promise<number> {
  const [maximo] = await cx.query("SELECT MAX(NoCotizacion) AS n FROM tblCotizaciones FOR UPDATE");
  const siguiente = Number((maximo as { n: number | null }[])[0]?.n ?? 6743) + 1;
  const noCotizacion = exacto ? pedido : Math.max(pedido, siguiente);
  const [repetidas] = await cx.query("SELECT IdCotizacion FROM tblCotizaciones WHERE NoCotizacion = ?", [noCotizacion]);
  if ((repetidas as unknown[]).length > 0) {
    throw new ErrorDeNegocio(`Ya existe la cotización ${noCotizacion}.`);
  }
  return noCotizacion;
}

/** Cliente existente, o alta del nuevo con su contacto. */
export async function resolverCliente(
  cx: PoolConnection,
  datos: { idCliente: number | null; clienteNuevo: string; contacto?: string; correo?: string },
): Promise<number> {
  if (datos.idCliente) return datos.idCliente;
  const nombre = datos.clienteNuevo.trim();
  if (!nombre) throw new ErrorDeNegocio("Falta el nombre del cliente.", 400);
  const [alta] = await cx.query(
    "INSERT INTO tblClientes (Cliente, Contacto, Correo) VALUES (?, ?, ?)",
    [nombre, datos.contacto || null, datos.correo || null],
  );
  return (alta as Alta).insertId;
}

/**
 * Inserta cotización, partida, costeo, conceptos, nómina persona × día,
 * insumos y gastos, dentro de la transacción que recibe. Los totales salen
 * siempre de `resultado` (el motor), nunca del navegador ni del archivo.
 */
export async function guardarCotizacionYCosteo(
  cx: PoolConnection,
  cabecera: CabeceraCotizacion,
  detalle: DetalleCosteo,
): Promise<{ idCotizacion: number; idCosteo: number }> {
  const idCotizacion = await insertarCotizacion(cx, cabecera, detalle.resultado);
  const idCosteo = await insertarCosteo(cx, idCotizacion, cabecera, detalle);
  await insertarDetalleCosteo(cx, idCosteo, cabecera.fecha, detalle);
  return { idCotizacion, idCosteo };
}

/**
 * Reescribe un costeo existente y el encabezado de su cotización: se borra el
 * detalle y se vuelve a insertar con lo recalculado. El número de cotización,
 * el cliente y la liga al levantamiento no cambian por aquí.
 */
export async function reemplazarCosteo(
  cx: PoolConnection,
  ids: { idCosteo: number; idCotizacion: number },
  cabecera: Omit<CabeceraCotizacion, "noCotizacion" | "idLevantamiento" | "idCliente" | "idUsuario" | "metodoPrecio">,
  detalle: DetalleCosteo,
  /** true = la cotización tiene varias partidas o descuento: su precio manda y aquí no se toca. */
  precioDesdeCotizacion: boolean,
): Promise<void> {
  const r = detalle.resultado;
  await cx.query(
    `UPDATE tblCotizaciones
        SET IdVendedor = ?, Fecha = ?, Descripcion = ?,
            Status = ?, FechaEnvio = COALESCE(FechaEnvio, ?), FechaAutoriza = ?, AutorizadoPor = ?
      WHERE IdCotizacion = ?`,
    [
      cabecera.idVendedor, cabecera.fecha, cabecera.descripcion, cabecera.status,
      cabecera.status === "BORRADOR" ? null : cabecera.fecha,
      cabecera.status === "AUTORIZADA" ? cabecera.fecha : null,
      cabecera.status === "AUTORIZADA" ? cabecera.autorizadoPor : null,
      ids.idCotizacion,
    ],
  );
  if (!precioDesdeCotizacion) {
    // Una sola partida sin descuento: el precio del costeo es el de la cotización.
    const iva = centavos(r.precioVenta * (cabecera.ivaPct / 100));
    await cx.query(
      "UPDATE tblCotizaciones SET Subtotal = ?, Descuento = 0, IvaPct = ?, Iva = ?, Total = ? WHERE IdCotizacion = ?",
      [r.precioVenta, cabecera.ivaPct, iva, centavos(r.precioVenta + iva), ids.idCotizacion],
    );
    await cx.query(
      "UPDATE tblCotizacionPartidas SET Concepto = ?, PrecioUnitario = ?, Importe = ? WHERE IdCotizacion = ? AND Orden = 1",
      [cabecera.descripcion, r.precioVenta, r.precioVenta, ids.idCotizacion],
    );
  }
  await actualizarTotalesCosteo(cx, ids.idCosteo, detalle);
  await borrarDetalleCosteo(cx, ids.idCosteo);
  await insertarDetalleCosteo(cx, ids.idCosteo, cabecera.fecha, detalle);
}

/** Sólo los totales y porcentajes del costeo (cuando cambia el precio o el detalle). */
export async function actualizarTotalesCosteo(cx: PoolConnection, idCosteo: number, d: DetalleCosteo): Promise<void> {
  const r = d.resultado;
  const real = d.real?.resultado;
  await cx.query(
    `UPDATE tblCosteos
        SET Dias = ?, Personal = ?, PrecioVenta = ?, Isr = ?,
            ImpuestosPct = ?, AdministrativosPct = ?, FinanciamientoPct = ?, ComisionPct = ?,
            GastoDirectoPlan = ?, InsumosPlan = ?, GastoTotalPlan = ?, UtilidadBrutaPlan = ?,
            ComisionPlan = ?, UtilidadNetaPlan = ?, MargenPlanPct = ?,
            GastoDirectoReal = ?, InsumosReal = ?, GastoTotalReal = ?, UtilidadNetaReal = ?, MargenRealPct = ?,
            Status = ?
      WHERE IdCosteo = ?`,
    [
      d.dias, personasDe(d.nomina), r.precioVenta, d.isr,
      r.porcentajes.impuestosPct, r.porcentajes.administrativosPct, r.porcentajes.financiamientoPct, r.porcentajes.comisionPct,
      r.gastoDirecto, r.insumos, r.gastoTotal, r.utilidadBruta, r.comision, r.utilidadNeta, r.margenPct,
      real?.gastoDirecto ?? 0, real?.insumos ?? 0, real?.gastoTotal ?? 0, real?.utilidadNeta ?? 0, real?.margenPct ?? 0,
      statusDe(d), idCosteo,
    ],
  );
}

function personasDe(nomina: RenglonNomina[]): number {
  return nomina.filter((n) => n.diasLaborados > 0).length;
}

function statusDe(d: DetalleCosteo): StatusCosteo {
  return d.status ?? (d.real ? "EN_PROCESO" : "PLANEADO");
}

async function insertarCotizacion(cx: PoolConnection, c: CabeceraCotizacion, r: ResultadoCosteo): Promise<number> {
  const subtotal = r.precioVenta;
  const iva = centavos(subtotal * (c.ivaPct / 100));
  const [alta] = await cx.query(
    `INSERT INTO tblCotizaciones
       (NoCotizacion, IdLevantamiento, IdCliente, IdVendedor, Fecha, Descripcion,
        MetodoPrecio, Subtotal, IvaPct, Iva, Total, Status, FechaEnvio, FechaAutoriza,
        AutorizadoPor, IdUsuarioAlta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.noCotizacion, c.idLevantamiento, c.idCliente, c.idVendedor, c.fecha, c.descripcion,
      c.metodoPrecio, subtotal, c.ivaPct, iva, centavos(subtotal + iva), c.status,
      c.status === "BORRADOR" ? null : c.fecha,
      c.status === "AUTORIZADA" ? c.fecha : null,
      c.status === "AUTORIZADA" ? c.autorizadoPor : null,
      c.idUsuario,
    ],
  );
  const idCotizacion = (alta as Alta).insertId;
  await cx.query(
    `INSERT INTO tblCotizacionPartidas (IdCotizacion, Orden, Concepto, Unidad, Cantidad, PrecioUnitario, Importe)
     VALUES (?, 1, ?, 'SERV', 1, ?, ?)`,
    [idCotizacion, c.descripcion, subtotal, subtotal],
  );
  return idCotizacion;
}

async function insertarCosteo(
  cx: PoolConnection,
  idCotizacion: number,
  c: CabeceraCotizacion,
  d: DetalleCosteo,
): Promise<number> {
  const r = d.resultado;
  const real = d.real?.resultado;
  const [alta] = await cx.query(
    `INSERT INTO tblCosteos
       (IdCotizacion, IdLevantamiento, Dias, Personal, PrecioVenta, Isr,
        ImpuestosPct, AdministrativosPct, FinanciamientoPct, ComisionPct,
        GastoDirectoPlan, InsumosPlan, GastoTotalPlan, UtilidadBrutaPlan,
        ComisionPlan, UtilidadNetaPlan, MargenPlanPct,
        GastoDirectoReal, InsumosReal, GastoTotalReal, UtilidadNetaReal, MargenRealPct, Status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      idCotizacion, c.idLevantamiento, d.dias, personasDe(d.nomina), r.precioVenta, d.isr,
      r.porcentajes.impuestosPct, r.porcentajes.administrativosPct,
      r.porcentajes.financiamientoPct, r.porcentajes.comisionPct,
      r.gastoDirecto, r.insumos, r.gastoTotal, r.utilidadBruta,
      r.comision, r.utilidadNeta, r.margenPct,
      real?.gastoDirecto ?? 0, real?.insumos ?? 0, real?.gastoTotal ?? 0,
      real?.utilidadNeta ?? 0, real?.margenPct ?? 0,
      statusDe(d),
    ],
  );
  return (alta as Alta).insertId;
}

/** Conceptos, nómina persona × día, insumos y gastos. */
export async function insertarDetalleCosteo(cx: PoolConnection, idCosteo: number, fecha: string, d: DetalleCosteo): Promise<void> {
  await insertarConceptos(cx, idCosteo, d);
  await insertarNomina(cx, idCosteo, fecha, d.nomina);
  await insertarInsumos(cx, idCosteo, d.insumos);
  await insertarGastos(cx, idCosteo, fecha, d.gastos);
}

export async function borrarDetalleCosteo(cx: PoolConnection, idCosteo: number): Promise<void> {
  await cx.query("DELETE FROM tblCosteoConceptos WHERE IdCosteo = ?", [idCosteo]);
  await cx.query("DELETE FROM tblCosteoNomina WHERE IdCosteo = ?", [idCosteo]); // los días caen en cascada
  await cx.query("DELETE FROM tblCosteoInsumos WHERE IdCosteo = ?", [idCosteo]);
  await cx.query("DELETE FROM tblCosteoGastos WHERE IdCosteo = ?", [idCosteo]);
}

async function insertarConceptos(cx: PoolConnection, idCosteo: number, d: DetalleCosteo): Promise<void> {
  for (const [concepto, monto] of Object.entries(d.resultado.conceptos)) {
    await cx.query(
      "INSERT INTO tblCosteoConceptos (IdCosteo, Concepto, GastoPlan, GastoReal) VALUES (?, ?, ?, ?)",
      [idCosteo, concepto, monto, d.real?.conceptos[concepto as Concepto] ?? 0],
    );
  }
}

/** Una fila por persona y una por cada día que trabaja, a partir de la fecha de la cotización. */
async function insertarNomina(cx: PoolConnection, idCosteo: number, fecha: string, nomina: RenglonNomina[]): Promise<void> {
  for (const r of nomina) {
    const [alta] = await cx.query(
      `INSERT INTO tblCosteoNomina (IdCosteo, Nombre, IdPuesto, SalarioDiario, ImssDiario, DesgasteDiario, Bono)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idCosteo, r.nombre, r.idPuesto, r.salarioDiario, r.imssDiario, r.desgasteDiario, r.bono],
    );
    const idNomina = (alta as Alta).insertId;
    for (const dia of diasDelProyecto(fecha, r.diasLaborados)) {
      await cx.query(
        "INSERT INTO tblCosteoNominaDias (IdCosteoNomina, Fecha, Laborado, EsReal) VALUES (?, ?, 1, 0)",
        [idNomina, dia],
      );
    }
  }
}

async function insertarInsumos(cx: PoolConnection, idCosteo: number, insumos: InsumoCosteo[]): Promise<void> {
  for (const i of insumos) {
    await cx.query(
      `INSERT INTO tblCosteoInsumos (IdCosteo, IdInsumo, Descripcion, Unidades, CostoPlan, CostoReal, Comentario)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        idCosteo, i.idInsumo, i.descripcion, i.unidades,
        i.aplica ? i.costo : 0, i.aplica ? i.costoReal : 0,
        i.aplica ? null : "NO APLICAR",
      ],
    );
  }
}

async function insertarGastos(cx: PoolConnection, idCosteo: number, fecha: string, gastos: GastoCosteo[]): Promise<void> {
  for (const g of gastos) {
    if (g.cantidad <= 0) continue;
    await cx.query(
      "INSERT INTO tblCosteoGastos (IdCosteo, Concepto, Fecha, Descripcion, Cantidad, EsReal) VALUES (?, ?, ?, ?, ?, 0)",
      [idCosteo, g.concepto, g.fecha ?? fecha, g.descripcion || null, g.cantidad],
    );
  }
}
