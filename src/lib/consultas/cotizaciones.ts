import { consulta, consultaUna } from "@/lib/db";

export interface CotizacionLista {
  IdCotizacion: number;
  NoCotizacion: number;
  Folio: number | null;
  Cliente: string;
  Descripcion: string;
  Fecha: string;
  Vigencia: number;
  Subtotal: number;
  Total: number;
  Status: "BORRADOR" | "ENVIADA" | "AUTORIZADA" | "RECHAZADA" | "CANCELADA";
  Vendedor: string | null;
  MargenPlanPct: number | null;
  IdCosteo: number | null;
  DiasAbierta: number;
}

export function listaCotizaciones(filtro: { status?: string; texto?: string } = {}) {
  const donde: string[] = ["1 = 1"];
  const par: unknown[] = [];
  if (filtro.status) {
    donde.push("co.Status = ?");
    par.push(filtro.status);
  }
  if (filtro.texto) {
    donde.push("(co.Descripcion LIKE ? OR c.Cliente LIKE ? OR CAST(co.NoCotizacion AS CHAR) LIKE ?)");
    par.push(`%${filtro.texto}%`, `%${filtro.texto}%`, `%${filtro.texto}%`);
  }
  return consulta<CotizacionLista>(
    `SELECT co.IdCotizacion, co.NoCotizacion, l.Folio, c.Cliente, co.Descripcion,
            co.Fecha, co.Vigencia, co.Subtotal, co.Total, co.Status,
            u.Usuario AS Vendedor, cs.MargenPlanPct, cs.IdCosteo,
            DATEDIFF(CURDATE(), co.Fecha) AS DiasAbierta
       FROM tblCotizaciones co
       JOIN tblClientes c ON c.IdCliente = co.IdCliente
       LEFT JOIN tblLevantamientos l ON l.IdLevantamiento = co.IdLevantamiento
       LEFT JOIN tblUsuarios u       ON u.IdUsuario = co.IdVendedor
       LEFT JOIN tblCosteos cs       ON cs.IdCotizacion = co.IdCotizacion
      WHERE ${donde.join(" AND ")}
      ORDER BY co.Fecha DESC, co.NoCotizacion DESC
      LIMIT 300`,
    par,
  );
}

export function fichaCotizacion(id: number) {
  return consultaUna<CotizacionLista & {
    IdLevantamiento: number | null;
    Condiciones: string | null;
    IvaPct: number;
    Iva: number;
    DescuentoPct: number;
    Descuento: number;
    MetodoPrecio: string;
    AutorizadoPor: string | null;
    Correo: string | null;
    Contacto: string | null;
  }>(
    `SELECT co.*, c.Cliente, c.Correo, c.Contacto, l.Folio, u.Usuario AS Vendedor,
            cs.MargenPlanPct, cs.IdCosteo, DATEDIFF(CURDATE(), co.Fecha) AS DiasAbierta
       FROM tblCotizaciones co
       JOIN tblClientes c ON c.IdCliente = co.IdCliente
       LEFT JOIN tblLevantamientos l ON l.IdLevantamiento = co.IdLevantamiento
       LEFT JOIN tblUsuarios u       ON u.IdUsuario = co.IdVendedor
       LEFT JOIN tblCosteos cs       ON cs.IdCotizacion = co.IdCotizacion
      WHERE co.IdCotizacion = ?`,
    [id],
  );
}

export function partidasDe(idCotizacion: number) {
  return consulta<{
    IdPartida: number;
    Orden: number;
    Concepto: string;
    Unidad: string;
    Cantidad: number;
    PrecioUnitario: number;
    Importe: number;
  }>(
    "SELECT IdPartida, Orden, Concepto, Unidad, Cantidad, PrecioUnitario, Importe FROM tblCotizacionPartidas WHERE IdCotizacion = ? ORDER BY Orden",
    [idCotizacion],
  );
}
