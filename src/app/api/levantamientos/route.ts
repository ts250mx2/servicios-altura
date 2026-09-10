import { NextResponse } from "next/server";
import { z } from "zod";
import type { PoolConnection } from "mysql2/promise";
import { enTransaccion } from "@/lib/db";
import { leerSesion } from "@/lib/auth/sesion";
import { bloquearImportacion, marcarAplicada, type ImportacionBloqueada } from "@/lib/consultas/importaciones";
import { resolverCliente } from "@/lib/costeo/guardar";
import { ErrorDeNegocio } from "@/lib/errores";
import { PaqueteImportacion } from "@/lib/importacion/tipos";
import { cotizarLevantamiento } from "@/lib/levantamientos/cotizar";
import {
  EsquemaActividades, EsquemaCosteoCaptura, EsquemaInsumosLevantamiento, EsquemaLevantamiento,
  EsquemaPersonal, type DatosLevantamiento,
} from "@/lib/levantamientos/esquemas";
import { insertarDetalleLevantamiento } from "@/lib/levantamientos/guardar";

const Entrada = z.object({
  levantamiento: EsquemaLevantamiento,
  actividades: EsquemaActividades,
  personal: EsquemaPersonal,
  insumos: EsquemaInsumosLevantamiento,
  costeo: EsquemaCosteoCaptura.nullable(),
  /** Presente cuando el levantamiento viene de la pantalla de revisión de un PDF. */
  importacion: z.object({ idImportacion: z.number().int().positive() }).nullable().optional(),
});

/** Alta de un levantamiento (captura manual o importación de PDF), con cotización y costeo opcionales. */
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
  const lev = d.levantamiento;

  try {
    const idLevantamiento = await enTransaccion(async (cx) => {
      const importacion = d.importacion
        ? await bloquearImportacion(cx, d.importacion.idImportacion, "PDF")
        : null;
      const idCliente = await resolverCliente(cx, {
        idCliente: lev.idCliente, clienteNuevo: lev.clienteNuevo,
        contacto: lev.usuarioContacto, correo: lev.correoUsuario,
      });
      const folio = await resolverFolio(cx, lev.folio, importacion !== null);

      const idLev = await insertarLevantamiento(cx, {
        lev, idCliente, folio, importacion, idUsuario: sesion.idUsuario, cotizar: d.costeo !== null,
      });
      await insertarDetalleLevantamiento(cx, idLev, d);

      const ids = d.costeo
        ? await cotizarLevantamiento(cx, {
            idLev, idCliente, lev, costeo: d.costeo, personal: d.personal,
            insumos: d.insumos, idUsuario: sesion.idUsuario, exacto: importacion !== null,
          })
        : null;

      if (importacion) {
        await insertarEvidencias(cx, importacion, idLev);
        await marcarAplicada(cx, importacion.IdImportacion, { idLevantamiento: idLev, idCosteo: ids?.idCosteo ?? null });
      }

      await cx.query(
        "INSERT INTO tblBitacora (IdUsuario, Entidad, IdEntidad, Accion, Detalle) VALUES (?, 'LEVANTAMIENTO', ?, 'ALTA', ?)",
        [
          sesion.idUsuario, idLev,
          importacion
            ? `Folio ${folio} importado de ${importacion.Archivo}`
            : `Folio ${folio} capturado manualmente`,
        ],
      );

      return idLev;
    });

    return NextResponse.json({ ok: true, idLevantamiento });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) {
      return NextResponse.json({ mensaje: error.message }, { status: error.estado });
    }
    console.error("Error al guardar levantamiento:", error);
    return NextResponse.json(
      { mensaje: "No se pudo guardar el levantamiento. Revisa la configuración o inténtalo de nuevo." },
      { status: 500 },
    );
  }
}

/**
 * Captura manual: nunca menor al siguiente consecutivo, para que dos capturistas
 * no choquen. Importación: el folio del papel tal cual, porque es histórico.
 * El bloqueo del máximo se toma en los dos casos a propósito: serializa las altas
 * simultáneas y convierte un choque de folio en un 409 claro, no en llave duplicada.
 */
async function resolverFolio(cx: PoolConnection, pedido: number, exacto: boolean): Promise<number> {
  const [maximo] = await cx.query("SELECT MAX(Folio) AS n FROM tblLevantamientos FOR UPDATE");
  const folioMaximo = Number((maximo as { n: number | null }[])[0]?.n ?? 3433);
  const folio = exacto ? pedido : Math.max(pedido, folioMaximo + 1);
  const [repetidos] = await cx.query("SELECT IdLevantamiento FROM tblLevantamientos WHERE Folio = ?", [folio]);
  if ((repetidos as unknown[]).length > 0) {
    throw new ErrorDeNegocio(`Ya existe un levantamiento con el folio ${folio}.`);
  }
  return folio;
}

async function insertarLevantamiento(
  cx: PoolConnection,
  datos: {
    lev: DatosLevantamiento; idCliente: number; folio: number;
    importacion: ImportacionBloqueada | null; idUsuario: number; cotizar: boolean;
  },
): Promise<number> {
  const { lev, idCliente, folio, importacion, idUsuario, cotizar } = datos;
  const [alta] = await cx.query(
    `INSERT INTO tblLevantamientos
       (Folio, IdCliente, Proyecto, AreaTrabajo, UsuarioContacto, CorreoUsuario,
        IdResponsable, Fecha, NivelRiesgo, Dias, TrabajoNormal, TrabajoExtra,
        AplicaCena, AplicaBono, Observaciones, Elaboro, Origen, ArchivoOrigen, Status, IdUsuarioAlta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      folio, idCliente, lev.proyecto, lev.areaTrabajo || null,
      lev.usuarioContacto || null, lev.correoUsuario || null, idUsuario,
      lev.fecha, lev.nivelRiesgo, lev.dias, lev.trabajoNormal ? 1 : 0, lev.trabajoExtra ? 1 : 0,
      lev.aplicaCena ? 1 : 0, lev.aplicaBono ? 1 : 0,
      lev.observaciones || null, lev.elaboro || null,
      importacion ? "PDF" : "MANUAL", importacion?.Archivo ?? null,
      cotizar ? "COTIZADO" : lev.status, idUsuario,
    ],
  );
  return (alta as { insertId: number }).insertId;
}

/** Cuelga las fotos extraídas del PDF como evidencias del levantamiento. */
async function insertarEvidencias(cx: PoolConnection, importacion: ImportacionBloqueada, idLev: number): Promise<void> {
  for (const [i, archivo] of evidenciasDe(importacion).entries()) {
    await cx.query(
      "INSERT INTO tblLevantamientoEvidencias (IdLevantamiento, Archivo, Titulo, Orden) VALUES (?, ?, ?, ?)",
      [idLev, archivo, `Evidencia ${i + 1}`, i + 1],
    );
  }
}

function evidenciasDe(importacion: ImportacionBloqueada): string[] {
  try {
    const paquete = PaqueteImportacion.safeParse(JSON.parse(importacion.JsonExtraido ?? "null"));
    return paquete.success ? paquete.data.evidencias : [];
  } catch {
    return [];
  }
}
