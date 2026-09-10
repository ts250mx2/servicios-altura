import type { Cliente, Insumo, Puesto } from "@/lib/consultas/catalogos";
import { CONCEPTOS, type Concepto } from "@/lib/costeo/tipos";
import { hoyIso } from "@/lib/fechas";
import { normalizar } from "../lineas";
import { buscarCliente, buscarPuesto } from "../preparar";
import type { LevantamientoLigado, PersonaRevision, ReferenciaExcel, ValoresCosteo } from "./revision";
import type { CosteoExtraido, PersonaExtraida } from "./tipos";

export interface CatalogosCosteo {
  clientes: Cliente[];
  puestos: Puesto[];
  insumos: Insumo[];
  vendedores: { IdUsuario: number; Usuario: string }[];
}

/** Diferencia mínima entre plan y real para considerar que el Excel ya trae gasto real. */
const TOLERANCIA_REAL = 0.5;

/**
 * Empata lo extraído del Excel contra los catálogos y el levantamiento del folio
 * (si existe) y arma los valores con los que se abre la pantalla de revisión.
 * Lo que no empata no se pierde: queda como captura libre y se avisa.
 */
export function prepararCosteo(
  datos: CosteoExtraido,
  catalogos: CatalogosCosteo,
  levantamiento: LevantamientoLigado | null,
): { inicial: ValoresCosteo; avisos: string[]; referencia: ReferenciaExcel } {
  const avisos = [...datos.avisos];
  const liga = decidirLiga(datos, levantamiento, avisos);
  const cliente = liga ? null : buscarCliente(datos.planta, catalogos.clientes);
  if (!liga && datos.planta && !cliente) {
    avisos.push(`El cliente «${datos.planta}» no está en el catálogo; se dará de alta al guardar.`);
  }

  const nomina = datos.nomina.map((p) => resolverPersona(p, catalogos.puestos, avisos));
  const insumos = datos.insumos.map((i) => {
    const encontrado = catalogos.insumos.find((c) => normalizar(c.Insumo) === normalizar(i.descripcion));
    return {
      idInsumo: encontrado?.IdInsumo ?? null,
      descripcion: i.descripcion,
      unidades: i.unidades,
      costo: i.costoPlan,
      costoReal: i.costoReal,
      aplica: i.aplica,
    };
  });

  const vendedor = buscarVendedor(datos.vendedor, catalogos.vendedores);
  if (datos.vendedor && !vendedor) {
    avisos.push(`El vendedor «${datos.vendedor}» no es un usuario del sistema; la cotización queda sin vendedor.`);
  }

  const autoriza = normalizar(datos.autoriza).startsWith("AUTORIZA");
  const diasNomina = Math.max(0, ...datos.nomina.map((p) => p.dias));

  const inicial: ValoresCosteo = {
    noCotizacion: datos.noCotizacion ?? 0,
    folio: datos.folio,
    idLevantamiento: liga?.idLevantamiento ?? null,
    idCliente: liga ? levantamientoCliente(levantamiento, catalogos.clientes) : (cliente?.IdCliente ?? "nuevo"),
    clienteNuevo: liga || cliente ? "" : datos.planta,
    contacto: datos.usuario,
    descripcion: datos.descripcion,
    fecha: datos.fecha ?? hoyIso(),
    dias: datos.dias ?? (diasNomina > 0 ? diasNomina : 1),
    precioVenta: datos.precioVenta,
    isr: datos.isr,
    statusCotizacion: autoriza ? "AUTORIZADA" : "ENVIADA",
    autorizadoPor: autoriza ? datos.autoriza : "",
    idVendedor: vendedor?.IdUsuario ?? null,
    porcentajes: datos.porcentajes,
    nomina,
    insumos,
    gastos: datos.gastos.map((g) => ({ ...g })),
    conceptosReal: realDistintoDePlan(datos) ? { ...datos.conceptosReal } : null,
  };

  return {
    inicial,
    avisos,
    referencia: { gastoTotal: datos.gastoTotalExcel, utilidadNeta: datos.utilidadNetaExcel },
  };
}

/** El costeo se liga al levantamiento del folio sólo si existe y todavía no tiene cotización. */
function decidirLiga(
  datos: CosteoExtraido,
  levantamiento: LevantamientoLigado | null,
  avisos: string[],
): LevantamientoLigado | null {
  if (datos.folio === null) return null;
  if (!levantamiento) {
    avisos.push(`No hay levantamiento con folio ${datos.folio}; la cotización se guardará sin ligar. Puedes importar su PDF después.`);
    return null;
  }
  if (levantamiento.noCotizacion !== null) {
    avisos.push(`El folio ${datos.folio} ya tiene la cotización ${levantamiento.noCotizacion}; esta se guardará sin ligar al levantamiento.`);
    return null;
  }
  if (datos.planta && normalizar(levantamiento.cliente) !== normalizar(datos.planta)) {
    avisos.push(`El Excel dice «${datos.planta}» pero el levantamiento ${datos.folio} es de «${levantamiento.cliente}»; se usa el del levantamiento.`);
  }
  return levantamiento;
}

function levantamientoCliente(levantamiento: LevantamientoLigado | null, clientes: Cliente[]): number | "nuevo" {
  if (!levantamiento) return "nuevo";
  return buscarCliente(levantamiento.cliente, clientes)?.IdCliente ?? "nuevo";
}

/**
 * "TECNICO 3" → TÉCNICO EN ALTURA, "SUP. SEGURIDAD" → SUPERVISOR DE SEGURIDAD,
 * "VIGIA" → VIGÍA. Un nombre propio ("MARCOS TOVAR") no empata: se asume técnico y se avisa.
 */
export function puestoDePersona(nombre: string, puestos: Puesto[]): Puesto | undefined {
  const base = normalizar(nombre).replace(/\s*\d+$/, "").replace(/\./g, "");
  const directo = buscarPuesto(base, puestos);
  if (directo) return directo;
  if (/\bSEG/.test(base)) return puestos.find((p) => normalizar(p.Puesto).includes("SEGURIDAD"));
  if (/\bSUP/.test(base)) return puestos.find((p) => normalizar(p.Puesto).startsWith("SUPERVISOR"));
  if (/\bAYUD/.test(base)) return puestos.find((p) => normalizar(p.Puesto).startsWith("AYUD"));
  return undefined;
}

function resolverPersona(p: PersonaExtraida, puestos: Puesto[], avisos: string[]): PersonaRevision {
  const puesto = puestoDePersona(p.nombre, puestos);
  const idPuesto = puesto?.IdPuesto ?? puestos[0]?.IdPuesto ?? 0;
  if (!puesto && puestos[0]) {
    avisos.push(`No se reconoció el puesto de «${p.nombre}»; se asumió ${puestos[0].Puesto}.`);
  }
  return {
    nombre: p.nombre,
    idPuesto,
    dias: p.dias,
    salarioDiario: p.salarioDiario,
    imssDiario: p.imssDiario,
    desgasteDiario: p.desgasteDiario,
    bono: p.bono,
  };
}

export function buscarVendedor(
  nombre: string,
  vendedores: { IdUsuario: number; Usuario: string }[],
): { IdUsuario: number; Usuario: string } | undefined {
  const buscado = normalizar(nombre);
  if (!buscado) return undefined;
  return (
    vendedores.find((v) => normalizar(v.Usuario) === buscado) ??
    vendedores.find((v) => normalizar(v.Usuario).includes(buscado) || buscado.includes(normalizar(v.Usuario)))
  );
}

function realDistintoDePlan(datos: CosteoExtraido): boolean {
  return CONCEPTOS.some(
    (c: Concepto) => Math.abs(datos.conceptosReal[c] - datos.conceptosPlan[c]) > TOLERANCIA_REAL,
  );
}
