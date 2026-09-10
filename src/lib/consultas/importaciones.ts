import type { PoolConnection } from "mysql2/promise";
import { consulta, consultaUna, ejecuta } from "@/lib/db";
import { ErrorDeNegocio } from "@/lib/errores";

export type EstadoImportacion = "PENDIENTE" | "REVISION" | "APLICADA" | "ERROR";
export type TipoImportacion = "PDF" | "EXCEL";

export interface ImportacionLista {
  IdImportacion: number;
  Archivo: string;
  Tipo: TipoImportacion;
  Metodo: "PLANTILLA" | "IA";
  Estado: EstadoImportacion;
  Mensaje: string | null;
  FechaAlta: Date | string;
  Usuario: string | null;
  IdLevantamiento: number | null;
  Folio: number | null;
  IdCosteo: number | null;
  NoCotizacion: number | null;
}

export interface ImportacionFila extends ImportacionLista {
  JsonExtraido: string | null;
}

/** Lo que una transacción necesita de la importación que está aplicando. */
export interface ImportacionBloqueada {
  IdImportacion: number;
  Archivo: string;
  Tipo: TipoImportacion;
  Estado: EstadoImportacion;
  JsonExtraido: string | null;
}

const CAMPOS = `i.IdImportacion, i.Archivo, i.Tipo, i.Metodo, i.Estado, i.Mensaje, i.FechaAlta,
            u.Usuario, i.IdLevantamiento, l.Folio, i.IdCosteo, co.NoCotizacion`;

const JUNTAS = `FROM tblImportaciones i
       LEFT JOIN tblUsuarios u       ON u.IdUsuario = i.IdUsuario
       LEFT JOIN tblLevantamientos l ON l.IdLevantamiento = i.IdLevantamiento
       LEFT JOIN tblCosteos cs       ON cs.IdCosteo = i.IdCosteo
       LEFT JOIN tblCotizaciones co  ON co.IdCotizacion = cs.IdCotizacion`;

export function listaImportaciones(): Promise<ImportacionLista[]> {
  return consulta<ImportacionLista>(
    `SELECT ${CAMPOS} ${JUNTAS}
      ORDER BY i.FechaAlta DESC, i.IdImportacion DESC
      LIMIT 200`,
  );
}

export function importacionPorId(id: number): Promise<ImportacionFila | null> {
  return consultaUna<ImportacionFila>(
    `SELECT ${CAMPOS}, i.JsonExtraido ${JUNTAS}
      WHERE i.IdImportacion = ?`,
    [id],
  );
}

export async function crearImportacion(datos: {
  archivo: string;
  tipo: TipoImportacion;
  idUsuario: number;
}): Promise<number> {
  const { insertId } = await ejecuta(
    `INSERT INTO tblImportaciones (Archivo, Tipo, Metodo, Estado, IdUsuario)
     VALUES (?, ?, 'PLANTILLA', 'PENDIENTE', ?)`,
    [datos.archivo, datos.tipo, datos.idUsuario],
  );
  return insertId;
}

export async function actualizarImportacion(
  id: number,
  cambios: { estado: EstadoImportacion; json?: string; mensaje?: string | null },
): Promise<void> {
  await ejecuta(
    `UPDATE tblImportaciones
        SET Estado = ?, JsonExtraido = COALESCE(?, JsonExtraido), Mensaje = ?
      WHERE IdImportacion = ?`,
    [cambios.estado, cambios.json ?? null, cambios.mensaje ?? null, id],
  );
}

/**
 * Borra el renglón sólo si no llegó a levantamiento ni a costeo. Si otra petición
 * lo está aplicando en ese instante, este DELETE espera su bloqueo y al soltarse
 * ya lo ve APLICADA: devuelve false y quien llama no toca los archivos.
 */
export async function borrarImportacion(id: number): Promise<boolean> {
  const { afectadas } = await ejecuta(
    "DELETE FROM tblImportaciones WHERE IdImportacion = ? AND Estado <> 'APLICADA'",
    [id],
  );
  return afectadas > 0;
}

/**
 * Bloquea la importación mientras dura la transacción que la aplica; así sólo
 * se aplica una vez aunque dos personas guarden al mismo tiempo.
 */
export async function bloquearImportacion(
  cx: PoolConnection,
  id: number,
  tipo: TipoImportacion,
): Promise<ImportacionBloqueada> {
  const [filas] = await cx.query(
    "SELECT IdImportacion, Archivo, Tipo, Estado, JsonExtraido FROM tblImportaciones WHERE IdImportacion = ? FOR UPDATE",
    [id],
  );
  const fila = (filas as ImportacionBloqueada[])[0];
  if (!fila) throw new ErrorDeNegocio("La importación no existe.", 404);
  if (fila.Tipo !== tipo) throw new ErrorDeNegocio("Esta importación no es del tipo esperado.", 400);
  if (fila.Estado !== "REVISION") throw new ErrorDeNegocio("Esta importación ya fue aplicada o descartada.");
  return fila;
}

export async function marcarAplicada(
  cx: PoolConnection,
  id: number,
  ligas: { idLevantamiento: number | null; idCosteo: number | null },
): Promise<void> {
  await cx.query(
    "UPDATE tblImportaciones SET Estado = 'APLICADA', IdLevantamiento = ?, IdCosteo = ? WHERE IdImportacion = ?",
    [ligas.idLevantamiento, ligas.idCosteo, id],
  );
}
