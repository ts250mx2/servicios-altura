import { consulta, consultaUna } from "@/lib/db";

export interface LevantamientoLista {
  IdLevantamiento: number;
  Folio: number;
  Cliente: string;
  Proyecto: string;
  AreaTrabajo: string | null;
  Fecha: string;
  NivelRiesgo: "BAJO" | "MEDIO" | "ALTO";
  Dias: number;
  Personas: number;
  Status: "BORRADOR" | "CERRADO" | "COTIZADO" | "CANCELADO";
  Origen: "MANUAL" | "PDF" | "EXCEL";
  NoCotizacion: number | null;
  Total: number | null;
  MargenPlanPct: number | null;
}

export interface FiltroLevantamientos {
  texto?: string;
  status?: string;
  idCliente?: number;
  riesgo?: string;
  desde?: string;
  hasta?: string;
}

export function listaLevantamientos(f: FiltroLevantamientos = {}): Promise<LevantamientoLista[]> {
  const donde: string[] = ["1 = 1"];
  const par: unknown[] = [];

  if (f.texto) {
    donde.push("(l.Proyecto LIKE ? OR c.Cliente LIKE ? OR CAST(l.Folio AS CHAR) LIKE ?)");
    par.push(`%${f.texto}%`, `%${f.texto}%`, `%${f.texto}%`);
  }
  if (f.status) {
    donde.push("l.Status = ?");
    par.push(f.status);
  }
  if (f.idCliente) {
    donde.push("l.IdCliente = ?");
    par.push(f.idCliente);
  }
  if (f.riesgo) {
    donde.push("l.NivelRiesgo = ?");
    par.push(f.riesgo);
  }
  if (f.desde) {
    donde.push("l.Fecha >= ?");
    par.push(f.desde);
  }
  if (f.hasta) {
    donde.push("l.Fecha <= ?");
    par.push(f.hasta);
  }

  return consulta<LevantamientoLista>(
    `SELECT l.IdLevantamiento, l.Folio, c.Cliente, l.Proyecto, l.AreaTrabajo, l.Fecha,
            l.NivelRiesgo, l.Dias, l.Status, l.Origen,
            COALESCE((SELECT SUM(p.Cantidad) FROM tblLevantamientoPersonal p
                       WHERE p.IdLevantamiento = l.IdLevantamiento), 0) AS Personas,
            co.NoCotizacion, co.Total, cs.MargenPlanPct
       FROM tblLevantamientos l
       JOIN tblClientes c       ON c.IdCliente = l.IdCliente
       LEFT JOIN tblCotizaciones co ON co.IdLevantamiento = l.IdLevantamiento
       LEFT JOIN tblCosteos cs      ON cs.IdCotizacion = co.IdCotizacion
      WHERE ${donde.join(" AND ")}
      ORDER BY l.Fecha DESC, l.Folio DESC
      LIMIT 300`,
    par,
  );
}

export interface LevantamientoFicha {
  IdLevantamiento: number;
  Folio: number;
  IdCliente: number;
  Cliente: string;
  Planta: string | null;
  Proyecto: string;
  AreaTrabajo: string | null;
  UsuarioContacto: string | null;
  CorreoUsuario: string | null;
  Fecha: string;
  NivelRiesgo: "BAJO" | "MEDIO" | "ALTO";
  Dias: number;
  TrabajoNormal: number;
  TrabajoExtra: number;
  AplicaCena: number;
  AplicaBono: number;
  Observaciones: string | null;
  Elaboro: string | null;
  Recibio: string | null;
  Reviso: string | null;
  Origen: string;
  Status: string;
  IdCotizacion: number | null;
  NoCotizacion: number | null;
}

export function fichaLevantamiento(id: number): Promise<LevantamientoFicha | null> {
  return consultaUna<LevantamientoFicha>(
    `SELECT l.*, c.Cliente, c.Planta, co.IdCotizacion, co.NoCotizacion
       FROM tblLevantamientos l
       JOIN tblClientes c ON c.IdCliente = l.IdCliente
       LEFT JOIN tblCotizaciones co ON co.IdLevantamiento = l.IdLevantamiento
      WHERE l.IdLevantamiento = ?`,
    [id],
  );
}

/** Para ligar un costeo importado: el levantamiento del folio y si ya tiene cotización. */
export function levantamientoPorFolio(folio: number) {
  return consultaUna<{
    IdLevantamiento: number;
    Folio: number;
    Proyecto: string;
    IdCliente: number;
    Cliente: string;
    NoCotizacion: number | null;
  }>(
    `SELECT l.IdLevantamiento, l.Folio, l.Proyecto, l.IdCliente, c.Cliente, co.NoCotizacion
       FROM tblLevantamientos l
       JOIN tblClientes c ON c.IdCliente = l.IdCliente
       LEFT JOIN tblCotizaciones co ON co.IdLevantamiento = l.IdLevantamiento
      WHERE l.Folio = ?
      LIMIT 1`,
    [folio],
  );
}

export function actividadesDe(id: number) {
  return consulta<{ IdActividad: number; Orden: number; Descripcion: string; Metros: number }>(
    "SELECT IdActividad, Orden, Descripcion, Metros FROM tblLevantamientoActividades WHERE IdLevantamiento = ? ORDER BY Orden",
    [id],
  );
}

export function personalDe(id: number) {
  return consulta<{
    IdLevPersonal: number;
    IdPuesto: number;
    Puesto: string;
    Abreviatura: string;
    Cantidad: number;
    TiempoExtra: number;
    Bono: number;
    SalarioDiario: number;
    ImssDiario: number;
    DesgasteDiario: number;
    BonoDefault: number;
    TarifaVentaDia: number;
  }>(
    `SELECT lp.IdLevPersonal, lp.IdPuesto, p.Puesto, p.Abreviatura, lp.Cantidad,
            lp.TiempoExtra, lp.Bono,
            p.SalarioDiario, p.ImssDiario, p.DesgasteDiario, p.BonoDefault, p.TarifaVentaDia
       FROM tblLevantamientoPersonal lp
       JOIN tblPuestos p ON p.IdPuesto = lp.IdPuesto
      WHERE lp.IdLevantamiento = ?
      ORDER BY p.Orden`,
    [id],
  );
}

export function insumosDe(id: number) {
  return consulta<{
    IdLevInsumo: number;
    IdInsumo: number | null;
    Descripcion: string;
    Cantidad: number;
    EsHerramental: number;
    Aplica: number;
    Comentario: string | null;
    CostoUnitario: number | null;
  }>(
    `SELECT li.IdLevInsumo, li.IdInsumo, li.Descripcion, li.Cantidad, li.EsHerramental,
            li.Aplica, li.Comentario, i.CostoUnitario
       FROM tblLevantamientoInsumos li
       LEFT JOIN tblInsumos i ON i.IdInsumo = li.IdInsumo
      WHERE li.IdLevantamiento = ?
      ORDER BY li.EsHerramental, li.IdLevInsumo`,
    [id],
  );
}

export function evidenciasDe(id: number) {
  return consulta<{ IdEvidencia: number; Archivo: string; Titulo: string | null }>(
    "SELECT IdEvidencia, Archivo, Titulo FROM tblLevantamientoEvidencias WHERE IdLevantamiento = ? ORDER BY Orden",
    [id],
  );
}
