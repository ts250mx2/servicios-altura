import type { PoolConnection } from "mysql2/promise";
import type { TarjetaProyecto } from "@/lib/consultas/proyectos";
import type { CambiosDeEstado } from "./columnas";

/**
 * Vuelve a leer, con bloqueo, los estatus de las tres caras de la tarjeta.
 * Así la decisión de a dónde se puede mover se toma con datos frescos aunque
 * otra persona haya cambiado algo entre que se pintó el tablero y se soltó.
 */
export async function refrescarTarjeta(cx: PoolConnection, t: TarjetaProyecto): Promise<TarjetaProyecto> {
  let levantamiento = t.levantamiento;
  let cotizacion = t.cotizacion;
  let costeo = t.costeo;
  if (levantamiento) {
    const [f] = (await cx.query("SELECT Status FROM tblLevantamientos WHERE IdLevantamiento = ? FOR UPDATE", [levantamiento.id])) as unknown as [{ Status: string }[]];
    levantamiento = f[0] ? { ...levantamiento, status: f[0].Status } : null;
  }
  if (cotizacion) {
    const [f] = (await cx.query("SELECT Status FROM tblCotizaciones WHERE IdCotizacion = ? FOR UPDATE", [cotizacion.id])) as unknown as [{ Status: string }[]];
    cotizacion = f[0] ? { ...cotizacion, status: f[0].Status } : null;
  }
  if (costeo) {
    const [f] = (await cx.query("SELECT Status FROM tblCosteos WHERE IdCosteo = ? FOR UPDATE", [costeo.id])) as unknown as [{ Status: string }[]];
    costeo = f[0] ? { ...costeo, status: f[0].Status } : null;
  }
  return { ...t, levantamiento, cotizacion, costeo };
}

/** Aplica en la base los cambios de estatus que pide una columna del tablero. */
export async function aplicarCambios(cx: PoolConnection, t: TarjetaProyecto, c: CambiosDeEstado): Promise<void> {
  if (c.levantamiento && t.levantamiento) {
    await cx.query("UPDATE tblLevantamientos SET Status = ? WHERE IdLevantamiento = ?", [c.levantamiento, t.levantamiento.id]);
  }
  if (c.cotizacion && t.cotizacion) {
    const enviada = c.cotizacion !== "BORRADOR";
    const autorizada = c.cotizacion === "AUTORIZADA";
    await cx.query(
      `UPDATE tblCotizaciones
          SET Status = ?,
              FechaEnvio = CASE WHEN ? THEN COALESCE(FechaEnvio, NOW()) ELSE NULL END,
              FechaAutoriza = CASE WHEN ? THEN COALESCE(FechaAutoriza, NOW()) ELSE NULL END,
              MotivoRechazo = CASE WHEN ? = 'RECHAZADA' THEN MotivoRechazo ELSE NULL END
        WHERE IdCotizacion = ?`,
      [c.cotizacion, enviada, autorizada, c.cotizacion, t.cotizacion.id],
    );
    if (t.levantamiento) {
      await cx.query(
        "UPDATE tblLevantamientos SET Status = 'COTIZADO' WHERE IdLevantamiento = ? AND Status <> 'CANCELADO'",
        [t.levantamiento.id],
      );
    }
  }
  if (c.costeo && t.costeo) {
    await cx.query("UPDATE tblCosteos SET Status = ? WHERE IdCosteo = ?", [c.costeo, t.costeo.id]);
  }
}
