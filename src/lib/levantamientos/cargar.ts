import {
  actividadesDe, fichaLevantamiento, insumosDe, personalDe, type LevantamientoFicha,
} from "@/lib/consultas/levantamientos";
import type { ValoresIniciales } from "./tipos";

/** Lo que el asistente necesita para abrirse en modo edición con un levantamiento guardado. */
export async function valoresDesdeLevantamiento(
  id: number,
): Promise<{ ficha: LevantamientoFicha; inicial: ValoresIniciales } | null> {
  const ficha = await fichaLevantamiento(id);
  if (!ficha) return null;
  const [actividades, personal, insumos] = await Promise.all([
    actividadesDe(id), personalDe(id), insumosDe(id),
  ]);
  return {
    ficha,
    inicial: {
      idCliente: ficha.IdCliente,
      clienteNuevo: "",
      proyecto: ficha.Proyecto,
      areaTrabajo: ficha.AreaTrabajo ?? "",
      usuarioContacto: ficha.UsuarioContacto ?? "",
      correoUsuario: ficha.CorreoUsuario ?? "",
      fecha: ficha.Fecha.slice(0, 10),
      nivelRiesgo: ficha.NivelRiesgo,
      dias: ficha.Dias,
      trabajoNormal: ficha.TrabajoNormal === 1,
      trabajoExtra: ficha.TrabajoExtra === 1,
      aplicaCena: ficha.AplicaCena === 1,
      aplicaBono: ficha.AplicaBono === 1,
      elaboro: ficha.Elaboro ?? "",
      actividades: actividades.length > 0
        ? actividades.map((a) => ({ descripcion: a.Descripcion, metros: Number(a.Metros) }))
        : [{ descripcion: "", metros: 0 }],
      observaciones: ficha.Observaciones ?? "",
      personal: personal.map((p) => ({
        idPuesto: p.IdPuesto, cantidad: p.Cantidad, tiempoExtra: p.TiempoExtra === 1, bono: p.Bono === 1,
      })),
      insumos: insumos.map((i) => ({
        idInsumo: i.IdInsumo,
        descripcion: i.Descripcion,
        cantidad: Number(i.Cantidad),
        costo: i.CostoUnitario !== null ? Number(i.CostoUnitario) * Number(i.Cantidad) : 0,
        esHerramental: i.EsHerramental === 1,
        aplica: i.Aplica === 1,
      })),
    },
  };
}
