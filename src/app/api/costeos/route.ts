import { NextResponse } from "next/server";
import { z } from "zod";
import type { PoolConnection } from "mysql2/promise";
import { leerSesion } from "@/lib/auth/sesion";
import { bloquearImportacion, marcarAplicada } from "@/lib/consultas/importaciones";
import { armarDetalleCosteo } from "@/lib/costeo/armar";
import { EsquemaCosteoCompleto } from "@/lib/costeo/esquemas";
import { guardarCotizacionYCosteo, resolverCliente, resolverNoCotizacion } from "@/lib/costeo/guardar";
import { enTransaccion } from "@/lib/db";
import { ErrorDeNegocio } from "@/lib/errores";

const Entrada = EsquemaCosteoCompleto.extend({
  /** Presente cuando el costeo viene de la pantalla de revisión de un Excel. */
  importacion: z.object({ idImportacion: z.number().int().positive() }).nullable().optional(),
});

/**
 * Crea cotización + costeo a partir de la revisión de un Excel importado (o de
 * cualquier captura con este mismo cuerpo). El servidor recalcula la cadena con
 * el motor; los totales del archivo sólo sirvieron para comprobar el cuadre.
 */
export async function POST(peticion: Request) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });

  const cuerpo = Entrada.safeParse(await peticion.json().catch(() => null));
  if (!cuerpo.success) {
    return NextResponse.json(
      { mensaje: "Datos incompletos o inválidos.", detalle: cuerpo.error.issues.slice(0, 3) },
      { status: 400 },
    );
  }
  const d = cuerpo.data;
  if (d.precioVenta <= 0) {
    return NextResponse.json({ mensaje: "Captura el precio de venta antes de guardar." }, { status: 400 });
  }

  try {
    const ids = await enTransaccion(async (cx) => {
      const importacion = d.importacion
        ? await bloquearImportacion(cx, d.importacion.idImportacion, "EXCEL")
        : null;
      const levantamiento = d.idLevantamiento ? await bloquearLevantamientoLibre(cx, d.idLevantamiento) : null;
      const idCliente = levantamiento
        ? levantamiento.IdCliente
        : await resolverCliente(cx, { idCliente: d.idCliente, clienteNuevo: d.clienteNuevo, contacto: d.contacto });
      const noCotizacion = await resolverNoCotizacion(cx, d.noCotizacion, importacion !== null);
      const detalle = armarDetalleCosteo(d);

      const guardado = await guardarCotizacionYCosteo(
        cx,
        {
          noCotizacion, idLevantamiento: d.idLevantamiento, idCliente, idVendedor: d.idVendedor,
          fecha: d.fecha, descripcion: d.descripcion, metodoPrecio: "MANUAL",
          status: d.statusCotizacion, autorizadoPor: d.autorizadoPor || null, ivaPct: 16,
          idUsuario: sesion.idUsuario,
        },
        detalle,
      );

      if (d.idLevantamiento) {
        await cx.query(
          "UPDATE tblLevantamientos SET Status = 'COTIZADO' WHERE IdLevantamiento = ? AND Status <> 'CANCELADO'",
          [d.idLevantamiento],
        );
      }
      if (importacion) {
        await marcarAplicada(cx, importacion.IdImportacion, {
          idLevantamiento: d.idLevantamiento, idCosteo: guardado.idCosteo,
        });
      }
      await cx.query(
        "INSERT INTO tblBitacora (IdUsuario, Entidad, IdEntidad, Accion, Detalle) VALUES (?, 'COSTEO', ?, 'ALTA', ?)",
        [
          sesion.idUsuario, guardado.idCosteo,
          importacion
            ? `Cotización ${noCotizacion} importada de ${importacion.Archivo}`
            : `Cotización ${noCotizacion} capturada`,
        ],
      );
      return { ...guardado, noCotizacion };
    });

    return NextResponse.json({ ok: true, ...ids });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      return NextResponse.json({ mensaje: error.message }, { status: error.estado });
    }
    console.error("Error al guardar costeo:", error);
    return NextResponse.json(
      { mensaje: "No se pudo guardar el costeo. Revisa la configuración o inténtalo de nuevo." },
      { status: 500 },
    );
  }
}

/** El levantamiento al que se liga: debe existir y no tener ya una cotización. */
async function bloquearLevantamientoLibre(cx: PoolConnection, id: number): Promise<{ IdLevantamiento: number; IdCliente: number }> {
  const [filas] = await cx.query(
    "SELECT IdLevantamiento, IdCliente, Folio FROM tblLevantamientos WHERE IdLevantamiento = ? FOR UPDATE",
    [id],
  );
  const fila = (filas as { IdLevantamiento: number; IdCliente: number; Folio: number }[])[0];
  if (!fila) throw new ErrorDeNegocio("El levantamiento al que se quiere ligar no existe.", 404);
  const [cotizaciones] = await cx.query(
    "SELECT NoCotizacion FROM tblCotizaciones WHERE IdLevantamiento = ? LIMIT 1",
    [id],
  );
  const existente = (cotizaciones as { NoCotizacion: number }[])[0];
  if (existente) {
    throw new ErrorDeNegocio(`El folio ${fila.Folio} ya tiene la cotización ${existente.NoCotizacion}.`);
  }
  return fila;
}
