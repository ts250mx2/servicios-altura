import mysql from "mysql2/promise";

/**
 * Pool único de la aplicación. A diferencia de bodega-ia (que lee una base
 * ajena de solo lectura), aquí la base es nuestra: se lee y se escribe.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "BDServiciosAltura",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  dateStrings: ["DATE"],
  decimalNumbers: true,
  timezone: "local",
});

export default pool;

/** Consulta tipada. Devuelve siempre un arreglo de filas. */
export async function consulta<T = Record<string, unknown>>(
  sql: string,
  parametros: unknown[] = [],
): Promise<T[]> {
  const [filas] = await pool.query(sql, parametros);
  return filas as T[];
}

/** Primera fila o null. */
export async function consultaUna<T = Record<string, unknown>>(
  sql: string,
  parametros: unknown[] = [],
): Promise<T | null> {
  const filas = await consulta<T>(sql, parametros);
  return filas.length > 0 ? filas[0] : null;
}

/** INSERT / UPDATE / DELETE. Devuelve insertId y filas afectadas. */
export async function ejecuta(
  sql: string,
  parametros: unknown[] = [],
): Promise<{ insertId: number; afectadas: number }> {
  const [resultado] = await pool.query(sql, parametros);
  const r = resultado as mysql.ResultSetHeader;
  return { insertId: r.insertId, afectadas: r.affectedRows };
}

/** Ejecuta varias sentencias dentro de una transacción. */
export async function enTransaccion<T>(
  trabajo: (cx: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const cx = await pool.getConnection();
  try {
    await cx.beginTransaction();
    const resultado = await trabajo(cx);
    await cx.commit();
    return resultado;
  } catch (error) {
    await cx.rollback();
    throw error;
  } finally {
    cx.release();
  }
}
