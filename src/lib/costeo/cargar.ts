import { consulta } from "@/lib/db";
import { conceptosDe, fichaCosteo, gastosDe, insumosCosteoDe } from "@/lib/consultas/costeos";
import type { ValoresCosteo } from "@/lib/importacion/excel/revision";
import { CONCEPTOS, type Concepto } from "./tipos";

interface FilaNomina {
  Nombre: string;
  IdPuesto: number;
  SalarioDiario: number;
  ImssDiario: number;
  DesgasteDiario: number;
  Bono: number;
  DiasPlan: number;
}

/** Lo que el editor de costeo necesita para abrirse con un costeo guardado. */
export async function valoresDesdeCosteo(
  idCosteo: number,
): Promise<{ ficha: NonNullable<Awaited<ReturnType<typeof fichaCosteo>>>; inicial: ValoresCosteo } | null> {
  const ficha = await fichaCosteo(idCosteo);
  if (!ficha) return null;
  const [nomina, insumos, gastos, conceptos, cotizacion] = await Promise.all([
    consulta<FilaNomina>(
      `SELECT n.Nombre, n.IdPuesto, n.SalarioDiario, n.ImssDiario, n.DesgasteDiario, n.Bono,
              COALESCE(SUM(d.Laborado), 0) AS DiasPlan
         FROM tblCosteoNomina n
         LEFT JOIN tblCosteoNominaDias d ON d.IdCosteoNomina = n.IdCosteoNomina
        WHERE n.IdCosteo = ?
        GROUP BY n.IdCosteoNomina
        ORDER BY n.IdCosteoNomina`,
      [idCosteo],
    ),
    insumosCosteoDe(idCosteo),
    gastosDe(idCosteo),
    conceptosDe(idCosteo),
    consulta<{ IdCliente: number; IdVendedor: number | null; AutorizadoPor: string | null; Contacto: string | null }>(
      `SELECT co.IdCliente, co.IdVendedor, co.AutorizadoPor, c.Contacto
         FROM tblCotizaciones co JOIN tblClientes c ON c.IdCliente = co.IdCliente
        WHERE co.IdCotizacion = ?`,
      [ficha.IdCotizacion],
    ),
  ]);
  const cot = cotizacion[0];
  const conReal = conceptos.some((c) => Number(c.GastoReal) > 0);
  const conceptosReal = conReal
    ? (Object.fromEntries(
        CONCEPTOS.map((c) => [c, Number(conceptos.find((x) => x.Concepto === c)?.GastoReal ?? 0)]),
      ) as Record<Concepto, number>)
    : null;
  const statusCot = ficha.StatusCotizacion;

  return {
    ficha,
    inicial: {
      noCotizacion: ficha.NoCotizacion,
      folio: ficha.Folio,
      idLevantamiento: ficha.IdLevantamiento,
      idCliente: cot?.IdCliente ?? "nuevo",
      clienteNuevo: "",
      contacto: cot?.Contacto ?? "",
      descripcion: ficha.Descripcion,
      fecha: String(ficha.Fecha).slice(0, 10),
      dias: ficha.Dias,
      precioVenta: Number(ficha.PrecioVenta),
      isr: Number(ficha.Isr),
      statusCotizacion: statusCot === "AUTORIZADA" || statusCot === "ENVIADA" ? statusCot : "BORRADOR",
      autorizadoPor: cot?.AutorizadoPor ?? "",
      idVendedor: cot?.IdVendedor ?? null,
      porcentajes: {
        impuestosPct: Number(ficha.ImpuestosPct),
        administrativosPct: Number(ficha.AdministrativosPct),
        financiamientoPct: Number(ficha.FinanciamientoPct),
        comisionPct: Number(ficha.ComisionPct),
      },
      nomina: nomina.map((n) => ({
        nombre: n.Nombre, idPuesto: n.IdPuesto, dias: Number(n.DiasPlan),
        salarioDiario: Number(n.SalarioDiario), imssDiario: Number(n.ImssDiario),
        desgasteDiario: Number(n.DesgasteDiario), bono: Number(n.Bono),
      })),
      insumos: insumos.map((i) => ({
        idInsumo: i.IdInsumo, descripcion: i.Descripcion, unidades: Number(i.Unidades),
        costo: Number(i.CostoPlan), costoReal: Number(i.CostoReal), aplica: i.Comentario !== "NO APLICAR",
      })),
      gastos: gastos.map((g) => ({
        concepto: g.Concepto as ValoresCosteo["gastos"][number]["concepto"],
        fecha: g.Fecha ? String(g.Fecha).slice(0, 10) : null,
        descripcion: g.Descripcion ?? "",
        cantidad: Number(g.Cantidad),
      })),
      conceptosReal,
      statusCosteo: ficha.Status,
    },
  };
}
