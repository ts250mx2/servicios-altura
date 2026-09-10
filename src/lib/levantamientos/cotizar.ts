import type { PoolConnection } from "mysql2/promise";
import { z } from "zod";
import { guardarCotizacionYCosteo, resolverNoCotizacion } from "@/lib/costeo/guardar";
import { calcularCosteo } from "@/lib/costeo/motor";
import type { DatosLevantamiento, DetalleLevantamiento, EsquemaCosteoCaptura } from "./esquemas";

interface FilaPuesto {
  IdPuesto: number;
  Abreviatura: string;
  SalarioDiario: number;
  ImssDiario: number;
  DesgasteDiario: number;
  BonoDefault: number;
}

/**
 * Genera cotización y costeo a partir del paso 4 del asistente: arma la nómina
 * con las tarifas vigentes de cada puesto, recalcula en el servidor y guarda.
 */
export async function cotizarLevantamiento(
  cx: PoolConnection,
  datos: {
    idLev: number;
    idCliente: number;
    lev: Pick<DatosLevantamiento, "fecha" | "dias" | "proyecto">;
    costeo: z.infer<typeof EsquemaCosteoCaptura>;
    personal: DetalleLevantamiento["personal"];
    insumos: DetalleLevantamiento["insumos"];
    idUsuario: number;
    /** true = respetar el número de cotización del papel (importación). */
    exacto: boolean;
  },
): Promise<{ idCotizacion: number; idCosteo: number; noCotizacion: number }> {
  const { idLev, idCliente, lev, costeo: c, personal, insumos, idUsuario, exacto } = datos;

  const [filasPuesto] = await cx.query(
    "SELECT IdPuesto, Abreviatura, SalarioDiario, ImssDiario, DesgasteDiario, BonoDefault FROM tblPuestos",
  );
  const puestos = new Map((filasPuesto as FilaPuesto[]).map((p) => [p.IdPuesto, p]));

  const nomina = personal.flatMap((l) => {
    const p = puestos.get(l.idPuesto);
    if (!p || l.cantidad <= 0) return [];
    return Array.from({ length: l.cantidad }, (_, i) => ({
      nombre: `${p.Abreviatura} ${i + 1}`,
      idPuesto: p.IdPuesto,
      salarioDiario: Number(p.SalarioDiario),
      imssDiario: Number(p.ImssDiario),
      desgasteDiario: Number(p.DesgasteDiario),
      bono: l.bono ? Number(p.BonoDefault) : 0,
      diasLaborados: lev.dias,
    }));
  });

  // El servidor recalcula: nunca se confía en los totales que manda el navegador.
  const resultado = calcularCosteo({
    nomina,
    insumos: insumos.map((i) => ({
      descripcion: i.descripcion, unidades: i.cantidad, costo: i.costo, aplica: i.aplica,
    })),
    gastos: c.gastos,
    porcentajes: c.porcentajes,
    precioVenta: c.precioVenta,
  });

  const noCotizacion = await resolverNoCotizacion(cx, c.noCotizacion, exacto);

  const ids = await guardarCotizacionYCosteo(
    cx,
    {
      noCotizacion, idLevantamiento: idLev, idCliente, idVendedor: idUsuario,
      fecha: lev.fecha, descripcion: lev.proyecto, metodoPrecio: c.metodoPrecio,
      status: "BORRADOR", autorizadoPor: null, ivaPct: 16, idUsuario,
    },
    {
      dias: lev.dias,
      isr: 0,
      resultado,
      nomina,
      insumos: insumos.map((i) => ({
        idInsumo: i.idInsumo, descripcion: i.descripcion, unidades: i.cantidad,
        costo: i.costo, aplica: i.aplica, costoReal: 0,
      })),
      gastos: (["GASOLINA", "ADMINISTRATIVO", "EPP", "EQUIPO"] as const).map((concepto) => ({
        concepto,
        fecha: lev.fecha,
        descripcion: null,
        cantidad: c.gastos[concepto.toLowerCase() as keyof typeof c.gastos],
      })),
      real: null,
    },
  );
  return { ...ids, noCotizacion };
}
