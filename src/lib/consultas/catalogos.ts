import { consulta } from "@/lib/db";

export interface Puesto {
  IdPuesto: number;
  Puesto: string;
  Abreviatura: string;
  SalarioDiario: number;
  ImssDiario: number;
  DesgasteDiario: number;
  BonoDefault: number;
  TarifaVentaDia: number;
  Orden: number;
}

export interface Cliente {
  IdCliente: number;
  Cliente: string;
  Planta: string | null;
  Contacto: string | null;
  Correo: string | null;
  Telefono: string | null;
  Ciudad: string | null;
}

export interface Insumo {
  IdInsumo: number;
  Insumo: string;
  Unidad: string;
  CostoUnitario: number;
  EsHerramental: number;
}

export interface Empleado {
  IdEmpleado: number;
  Empleado: string;
  IdPuesto: number;
  Puesto: string;
  SalarioDiario: number;
  ImssDiario: number;
  DesgasteDiario: number;
}

export function puestos(): Promise<Puesto[]> {
  return consulta<Puesto>(
    "SELECT IdPuesto, Puesto, Abreviatura, SalarioDiario, ImssDiario, DesgasteDiario, BonoDefault, TarifaVentaDia, Orden FROM tblPuestos WHERE Status = 1 ORDER BY Orden, Puesto",
  );
}

export function clientes(): Promise<Cliente[]> {
  return consulta<Cliente>(
    "SELECT IdCliente, Cliente, Planta, Contacto, Correo, Telefono, Ciudad FROM tblClientes WHERE Status = 1 ORDER BY Cliente",
  );
}

export function insumos(): Promise<Insumo[]> {
  return consulta<Insumo>(
    "SELECT IdInsumo, Insumo, Unidad, CostoUnitario, EsHerramental FROM tblInsumos WHERE Status = 1 ORDER BY EsHerramental, Insumo",
  );
}

export function empleados(): Promise<Empleado[]> {
  return consulta<Empleado>(
    `SELECT e.IdEmpleado, e.Empleado, e.IdPuesto, p.Puesto,
            COALESCE(e.SalarioDiario, p.SalarioDiario)   AS SalarioDiario,
            COALESCE(e.ImssDiario, p.ImssDiario)         AS ImssDiario,
            COALESCE(e.DesgasteDiario, p.DesgasteDiario) AS DesgasteDiario
       FROM tblEmpleados e
       JOIN tblPuestos p ON p.IdPuesto = e.IdPuesto
      WHERE e.Status = 1
      ORDER BY p.Orden, e.Empleado`,
  );
}

/** Usuarios activos, para empatar el "Vendedor:" del Excel. */
export function vendedores(): Promise<{ IdUsuario: number; Usuario: string }[]> {
  return consulta<{ IdUsuario: number; Usuario: string }>(
    "SELECT IdUsuario, Usuario FROM tblUsuarios WHERE Status = 1 ORDER BY Usuario",
  );
}

export async function parametros(): Promise<Record<string, number>> {
  const filas = await consulta<{ Clave: string; Valor: number }>(
    "SELECT Clave, Valor FROM tblParametros",
  );
  return Object.fromEntries(filas.map((f) => [f.Clave, Number(f.Valor)]));
}

export function tarifasMonto(tipo: "EPP" | "EQUIPO") {
  return consulta<{ MontoHasta: number; Costo: number }>(
    "SELECT MontoHasta, Costo FROM tblTarifasMonto WHERE Tipo = ? ORDER BY MontoHasta",
    [tipo],
  );
}

/** Siguiente folio de levantamiento y siguiente número de cotización. */
export async function siguientesFolios(): Promise<{ folio: number; noCotizacion: number }> {
  const [lev] = await consulta<{ n: number | null }>(
    "SELECT MAX(Folio) AS n FROM tblLevantamientos",
  );
  const [cot] = await consulta<{ n: number | null }>(
    "SELECT MAX(NoCotizacion) AS n FROM tblCotizaciones",
  );
  return {
    folio: Number(lev?.n ?? 3433) + 1,
    noCotizacion: Number(cot?.n ?? 6743) + 1,
  };
}
