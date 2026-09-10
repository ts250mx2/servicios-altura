import { consulta, consultaUna } from "@/lib/db";

/**
 * Un proyecto son las tres caras del mismo trabajo. Esta vista junta lo que
 * existe de cada una para pintar la cadena en las fichas y el tablero.
 */
export interface CadenaProyecto {
  levantamiento: { id: number; folio: number; status: string; cliente: string; proyecto: string } | null;
  cotizacion: { id: number; no: number; status: string; subtotal: number; fecha: string } | null;
  costeo: { id: number; status: string; margenPlan: number; margenReal: number } | null;
}

interface FilaCadena {
  IdLevantamiento: number | null;
  Folio: number | null;
  StatusLev: string | null;
  Cliente: string;
  Proyecto: string;
  IdCotizacion: number | null;
  NoCotizacion: number | null;
  StatusCot: string | null;
  Subtotal: number | null;
  FechaCot: string | null;
  IdCosteo: number | null;
  StatusCos: string | null;
  MargenPlanPct: number | null;
  MargenRealPct: number | null;
}

const CAMPOS = `l.IdLevantamiento, l.Folio, l.Status AS StatusLev,
        COALESCE(cl.Cliente, cc.Cliente) AS Cliente, COALESCE(l.Proyecto, co.Descripcion) AS Proyecto,
        co.IdCotizacion, co.NoCotizacion, co.Status AS StatusCot, co.Subtotal, co.Fecha AS FechaCot,
        cs.IdCosteo, cs.Status AS StatusCos, cs.MargenPlanPct, cs.MargenRealPct`;

function armar(f: FilaCadena | null): CadenaProyecto | null {
  if (!f) return null;
  return {
    levantamiento: f.IdLevantamiento
      ? { id: f.IdLevantamiento, folio: f.Folio!, status: f.StatusLev!, cliente: f.Cliente, proyecto: f.Proyecto }
      : null,
    cotizacion: f.IdCotizacion
      ? { id: f.IdCotizacion, no: f.NoCotizacion!, status: f.StatusCot!, subtotal: Number(f.Subtotal), fecha: String(f.FechaCot) }
      : null,
    costeo: f.IdCosteo
      ? { id: f.IdCosteo, status: f.StatusCos!, margenPlan: Number(f.MargenPlanPct), margenReal: Number(f.MargenRealPct) }
      : null,
  };
}

export async function cadenaDeLevantamiento(id: number): Promise<CadenaProyecto | null> {
  return armar(await consultaUna<FilaCadena>(
    `SELECT ${CAMPOS}
       FROM tblLevantamientos l
       JOIN tblClientes cl ON cl.IdCliente = l.IdCliente
       LEFT JOIN tblCotizaciones co ON co.IdLevantamiento = l.IdLevantamiento
       LEFT JOIN tblClientes cc ON cc.IdCliente = co.IdCliente
       LEFT JOIN tblCosteos cs ON cs.IdCotizacion = co.IdCotizacion
      WHERE l.IdLevantamiento = ?`,
    [id],
  ));
}

export async function cadenaDeCotizacion(id: number): Promise<CadenaProyecto | null> {
  return armar(await consultaUna<FilaCadena>(
    `SELECT ${CAMPOS}
       FROM tblCotizaciones co
       JOIN tblClientes cc ON cc.IdCliente = co.IdCliente
       LEFT JOIN tblLevantamientos l ON l.IdLevantamiento = co.IdLevantamiento
       LEFT JOIN tblClientes cl ON cl.IdCliente = l.IdCliente
       LEFT JOIN tblCosteos cs ON cs.IdCotizacion = co.IdCotizacion
      WHERE co.IdCotizacion = ?`,
    [id],
  ));
}

export async function cadenaDeCosteo(id: number): Promise<CadenaProyecto | null> {
  return armar(await consultaUna<FilaCadena>(
    `SELECT ${CAMPOS}
       FROM tblCosteos cs
       JOIN tblCotizaciones co ON co.IdCotizacion = cs.IdCotizacion
       JOIN tblClientes cc ON cc.IdCliente = co.IdCliente
       LEFT JOIN tblLevantamientos l ON l.IdLevantamiento = co.IdLevantamiento
       LEFT JOIN tblClientes cl ON cl.IdCliente = l.IdCliente
      WHERE cs.IdCosteo = ?`,
    [id],
  ));
}

/** Una tarjeta del tablero: un proyecto con lo que exista de sus tres caras. */
export interface TarjetaProyecto {
  clave: string;
  cliente: string;
  proyecto: string;
  fecha: string;
  nivelRiesgo: string | null;
  dias: number;
  personas: number;
  levantamiento: { id: number; folio: number; status: string } | null;
  cotizacion: { id: number; no: number; status: string; subtotal: number; diasAbierta: number; vigencia: number } | null;
  costeo: { id: number; status: string; margenPlan: number; margenReal: number; utilidad: number } | null;
}

interface FilaTarjeta extends FilaCadena {
  Fecha: string;
  NivelRiesgo: string | null;
  Dias: number | null;
  Personas: number | null;
  DiasAbierta: number | null;
  Vigencia: number | null;
  UtilidadNetaPlan: number | null;
}

/** Todos los proyectos vivos: cada levantamiento y cada cotización sin levantamiento. */
export async function tarjetasTablero(): Promise<TarjetaProyecto[]> {
  const filas = await consulta<FilaTarjeta>(
    `SELECT ${CAMPOS},
            COALESCE(l.Fecha, co.Fecha) AS Fecha, l.NivelRiesgo, COALESCE(cs.Dias, l.Dias) AS Dias,
            COALESCE(cs.Personal, (SELECT SUM(p.Cantidad) FROM tblLevantamientoPersonal p WHERE p.IdLevantamiento = l.IdLevantamiento)) AS Personas,
            DATEDIFF(CURDATE(), co.Fecha) AS DiasAbierta, co.Vigencia, cs.UtilidadNetaPlan
       FROM tblLevantamientos l
       JOIN tblClientes cl ON cl.IdCliente = l.IdCliente
       LEFT JOIN tblCotizaciones co ON co.IdLevantamiento = l.IdLevantamiento
       LEFT JOIN tblClientes cc ON cc.IdCliente = co.IdCliente
       LEFT JOIN tblCosteos cs ON cs.IdCotizacion = co.IdCotizacion
     UNION ALL
     SELECT ${CAMPOS},
            co.Fecha AS Fecha, NULL AS NivelRiesgo, cs.Dias, cs.Personal,
            DATEDIFF(CURDATE(), co.Fecha) AS DiasAbierta, co.Vigencia, cs.UtilidadNetaPlan
       FROM tblCotizaciones co
       JOIN tblClientes cc ON cc.IdCliente = co.IdCliente
       LEFT JOIN tblLevantamientos l ON l.IdLevantamiento = co.IdLevantamiento
       LEFT JOIN tblClientes cl ON cl.IdCliente = l.IdCliente
       LEFT JOIN tblCosteos cs ON cs.IdCotizacion = co.IdCotizacion
      WHERE co.IdLevantamiento IS NULL
     ORDER BY Fecha DESC
     LIMIT 400`,
  );
  return filas.map((f) => ({
    clave: f.IdLevantamiento ? `L${f.IdLevantamiento}` : `C${f.IdCotizacion}`,
    cliente: f.Cliente,
    proyecto: f.Proyecto,
    fecha: String(f.Fecha).slice(0, 10),
    nivelRiesgo: f.NivelRiesgo,
    dias: Number(f.Dias ?? 0),
    personas: Number(f.Personas ?? 0),
    levantamiento: f.IdLevantamiento ? { id: f.IdLevantamiento, folio: f.Folio!, status: f.StatusLev! } : null,
    cotizacion: f.IdCotizacion
      ? {
          id: f.IdCotizacion, no: f.NoCotizacion!, status: f.StatusCot!, subtotal: Number(f.Subtotal),
          diasAbierta: Number(f.DiasAbierta ?? 0), vigencia: Number(f.Vigencia ?? 15),
        }
      : null,
    costeo: f.IdCosteo
      ? {
          id: f.IdCosteo, status: f.StatusCos!, margenPlan: Number(f.MargenPlanPct),
          margenReal: Number(f.MargenRealPct), utilidad: Number(f.UtilidadNetaPlan ?? 0),
        }
      : null,
  }));
}
