import { consulta } from "@/lib/db";
import { puestos, tarifasMonto, type Puesto } from "@/lib/consultas/catalogos";
import { conceptosDe, fichaCosteo, gastosDe, insumosCosteoDe, nominaDe } from "@/lib/consultas/costeos";
import { fichaCotizacion, partidasDe } from "@/lib/consultas/cotizaciones";
import {
  actividadesDe, evidenciasDe, fichaLevantamiento, insumosDe, personalDe,
} from "@/lib/consultas/levantamientos";
import { cadenaDeCosteo, cadenaDeCotizacion, cadenaDeLevantamiento, type CadenaProyecto } from "@/lib/consultas/proyectos";

/** Todo lo que necesitan los PDF y Excel de cada cara del proyecto, en una sola carga. */

export interface DatosLevantamientoDoc {
  ficha: NonNullable<Awaited<ReturnType<typeof fichaLevantamiento>>>;
  actividades: Awaited<ReturnType<typeof actividadesDe>>;
  personal: Awaited<ReturnType<typeof personalDe>>;
  insumos: Awaited<ReturnType<typeof insumosDe>>;
  evidencias: Awaited<ReturnType<typeof evidenciasDe>>;
  puestos: Puesto[];
  cadena: CadenaProyecto;
}

export async function datosLevantamiento(id: number): Promise<DatosLevantamientoDoc | null> {
  const ficha = await fichaLevantamiento(id);
  if (!ficha) return null;
  const [actividades, personal, insumos, evidencias, listaPuestos, cadena] = await Promise.all([
    actividadesDe(id), personalDe(id), insumosDe(id), evidenciasDe(id), puestos(), cadenaDeLevantamiento(id),
  ]);
  if (!cadena) return null;
  return { ficha, actividades, personal, insumos, evidencias, puestos: listaPuestos, cadena };
}

export interface DatosCotizacionDoc {
  ficha: NonNullable<Awaited<ReturnType<typeof fichaCotizacion>>>;
  partidas: Awaited<ReturnType<typeof partidasDe>>;
  cadena: CadenaProyecto;
}

export async function datosCotizacion(id: number): Promise<DatosCotizacionDoc | null> {
  const ficha = await fichaCotizacion(id);
  if (!ficha) return null;
  const [partidas, cadena] = await Promise.all([partidasDe(id), cadenaDeCotizacion(id)]);
  if (!cadena) return null;
  return { ficha, partidas, cadena };
}

export interface DiaNomina {
  IdCosteoNomina: number;
  Fecha: string;
  Laborado: number;
  EsReal: number;
}

export interface DatosCosteoDoc {
  ficha: NonNullable<Awaited<ReturnType<typeof fichaCosteo>>>;
  conceptos: Awaited<ReturnType<typeof conceptosDe>>;
  nomina: Awaited<ReturnType<typeof nominaDe>>;
  dias: DiaNomina[];
  insumos: Awaited<ReturnType<typeof insumosCosteoDe>>;
  gastos: Awaited<ReturnType<typeof gastosDe>>;
  tarifasEpp: { MontoHasta: number; Costo: number }[];
  tarifasEquipo: { MontoHasta: number; Costo: number }[];
  cadena: CadenaProyecto;
  usuarioContacto: string | null;
  vendedor: string | null;
}

export async function datosCosteo(id: number): Promise<DatosCosteoDoc | null> {
  const ficha = await fichaCosteo(id);
  if (!ficha) return null;
  const [conceptos, nomina, dias, insumos, gastos, tarifasEpp, tarifasEquipo, cadena, extra] = await Promise.all([
    conceptosDe(id), nominaDe(id),
    consulta<DiaNomina>(
      `SELECT d.IdCosteoNomina, d.Fecha, d.Laborado, d.EsReal
         FROM tblCosteoNominaDias d JOIN tblCosteoNomina n ON n.IdCosteoNomina = d.IdCosteoNomina
        WHERE n.IdCosteo = ? ORDER BY d.Fecha`,
      [id],
    ),
    insumosCosteoDe(id), gastosDe(id), tarifasMonto("EPP"), tarifasMonto("EQUIPO"), cadenaDeCosteo(id),
    consulta<{ UsuarioContacto: string | null; Contacto: string | null; Vendedor: string | null }>(
      `SELECT l.UsuarioContacto, c.Contacto, u.Usuario AS Vendedor
         FROM tblCosteos cs
         JOIN tblCotizaciones co ON co.IdCotizacion = cs.IdCotizacion
         JOIN tblClientes c ON c.IdCliente = co.IdCliente
         LEFT JOIN tblLevantamientos l ON l.IdLevantamiento = co.IdLevantamiento
         LEFT JOIN tblUsuarios u ON u.IdUsuario = co.IdVendedor
        WHERE cs.IdCosteo = ?`,
      [id],
    ),
  ]);
  if (!cadena) return null;
  return {
    ficha, conceptos, nomina, dias, insumos, gastos, tarifasEpp, tarifasEquipo, cadena,
    usuarioContacto: extra[0]?.UsuarioContacto ?? extra[0]?.Contacto ?? null,
    vendedor: extra[0]?.Vendedor ?? null,
  };
}
