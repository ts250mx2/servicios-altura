import type { Cliente, Insumo, Puesto } from "@/lib/consultas/catalogos";
import { costoUnitarioDe, importePartida, SIN_ULTIMOS_COSTOS, type UltimosCostos } from "@/lib/costeo/ultimos-costos";
import { hoyIso } from "@/lib/fechas";
import type { LineaInsumo, LineaPersonal, ValoresIniciales } from "@/lib/levantamientos/tipos";
import { normalizar } from "./lineas";
import type { LevantamientoExtraido } from "./tipos";

export interface Catalogos {
  clientes: Cliente[];
  puestos: Puesto[];
  insumos: Insumo[];
  /** Último costo unitario de cada insumo en costeos anteriores; manda sobre el catálogo. */
  ultimosCostos?: UltimosCostos;
}

type PersonalExtraido = LevantamientoExtraido["personal"][number];
type PartidaExtraida = LevantamientoExtraido["insumos"][number];

/**
 * Empata lo extraído del PDF contra los catálogos y arma los valores con los
 * que se abre el asistente de captura. Lo que no empata no se pierde: se deja
 * como captura libre y se avisa para que alguien lo revise.
 */
export function prepararRevision(
  datos: LevantamientoExtraido,
  catalogos: Catalogos,
): { inicial: ValoresIniciales; avisos: string[] } {
  const cliente = buscarCliente(datos.cliente, catalogos.clientes);
  const { lineas: personal, sinPuesto } = resolverPersonal(datos.personal, catalogos.puestos);
  const ultimos = catalogos.ultimosCostos ?? SIN_ULTIMOS_COSTOS;
  const insumos = [
    ...datos.insumos.map((p) => resolverPartida(p, false, catalogos.insumos, ultimos)),
    ...datos.herramental.map((p) => resolverPartida(p, true, catalogos.insumos, ultimos)),
  ];
  const sinCatalogo = insumos.filter(
    (i) => i.idInsumo === null && costoUnitarioDe(i, ultimos) === null,
  ).length;

  const avisos = [
    ...datos.avisos,
    ...(datos.cliente && !cliente
      ? [`El cliente «${datos.cliente}» no está en el catálogo; se dará de alta al guardar.`]
      : []),
    ...sinPuesto.map(
      (p) => `No se reconoció el puesto «${p.puesto}» (${p.cantidad}); asígnalo a mano en Recursos.`,
    ),
    ...(sinCatalogo > 0
      ? [`${sinCatalogo} partidas no están en el catálogo de insumos; captura su costo en Recursos.`]
      : []),
  ];

  const inicial: ValoresIniciales = {
    idCliente: cliente?.IdCliente ?? "nuevo",
    clienteNuevo: cliente ? "" : datos.cliente,
    proyecto: datos.proyecto,
    areaTrabajo: datos.areaTrabajo,
    usuarioContacto: datos.usuarioContacto,
    correoUsuario: datos.correoUsuario,
    fecha: datos.fecha ?? hoyIso(),
    nivelRiesgo: datos.nivelRiesgo ?? "ALTO",
    dias: datos.dias ?? 1,
    trabajoNormal: datos.trabajoNormal,
    trabajoExtra: datos.trabajoExtra,
    aplicaCena: datos.aplicaCena,
    aplicaBono: datos.aplicaBono,
    elaboro: datos.elaboro || datos.responsable,
    actividades: datos.actividades.length > 0 ? datos.actividades : [{ descripcion: "", metros: 0 }],
    observaciones: datos.observaciones,
    personal,
    insumos,
  };

  return { inicial, avisos };
}

export function buscarCliente(nombre: string, clientes: Cliente[]): Cliente | undefined {
  const buscado = normalizar(nombre);
  if (!buscado) return undefined;
  return clientes.find((c) => normalizar(c.Cliente) === buscado);
}

/**
 * La columna del PDF dice "TÉCNICO", "SUP SEG", "VIGÍA"…; el catálogo tiene el
 * puesto largo y una abreviatura. Se prueba de lo más exacto a lo más laxo.
 */
export function buscarPuesto(etiqueta: string, puestos: Puesto[]): Puesto | undefined {
  const buscado = sinPuntuacion(etiqueta);
  if (!buscado) return undefined;
  return (
    puestos.find((p) => sinPuntuacion(p.Puesto) === buscado) ??
    puestos.find((p) => sinPuntuacion(p.Abreviatura) === buscado) ??
    puestos.find((p) => sinPuntuacion(p.Puesto).startsWith(buscado)) ??
    (buscado === "SUP SEG"
      ? puestos.find((p) => sinPuntuacion(p.Puesto).includes("SEGURIDAD"))
      : undefined)
  );
}

function sinPuntuacion(texto: string): string {
  return normalizar(texto).replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function resolverPersonal(
  personal: PersonalExtraido[],
  puestos: Puesto[],
): { lineas: LineaPersonal[]; sinPuesto: PersonalExtraido[] } {
  return personal.reduce<{ lineas: LineaPersonal[]; sinPuesto: PersonalExtraido[] }>(
    (acumulado, p) => {
      if (p.cantidad <= 0) return acumulado;
      const puesto = buscarPuesto(p.puesto, puestos);
      if (!puesto) return { ...acumulado, sinPuesto: [...acumulado.sinPuesto, p] };
      const linea = { idPuesto: puesto.IdPuesto, cantidad: p.cantidad, tiempoExtra: p.tiempoExtra, bono: p.bono };
      return { ...acumulado, lineas: [...acumulado.lineas, linea] };
    },
    { lineas: [], sinPuesto: [] },
  );
}

function resolverPartida(
  partida: PartidaExtraida,
  esHerramental: boolean,
  catalogo: Insumo[],
  ultimos: UltimosCostos,
): LineaInsumo {
  const buscado = normalizar(partida.descripcion);
  const encontrado = catalogo.find((i) => normalizar(i.Insumo) === buscado);
  const idInsumo = encontrado?.IdInsumo ?? null;
  const unitario = costoUnitarioDe({ idInsumo, descripcion: partida.descripcion }, ultimos, encontrado?.CostoUnitario);
  return {
    idInsumo,
    descripcion: partida.descripcion,
    cantidad: partida.cantidad,
    costo: unitario === null ? 0 : importePartida(unitario, partida.cantidad),
    esHerramental: encontrado ? encontrado.EsHerramental === 1 : esHerramental,
    aplica: !buscado.includes("NO APLICA"),
  };
}
