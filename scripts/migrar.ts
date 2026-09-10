/**
 * Crea la base y aplica sql/esquema.sql.
 *   npm run migrar
 * Es idempotente: todas las sentencias son CREATE ... IF NOT EXISTS / INSERT IGNORE.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

async function principal() {
  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  const ruta = path.join(process.cwd(), "sql", "esquema.sql");
  const guion = readFileSync(ruta, "utf8");

  console.log(`Aplicando ${ruta} …`);
  await conexion.query(guion);
  await conexion.end();

  console.log("Listo. Base y catálogos base creados.");
  console.log('Ahora crea un usuario:  npm run usuario -- admin TuClave "Nombre Apellido" administrador');
}

principal().catch((error) => {
  console.error("Falló la migración:", error.message);
  process.exit(1);
});
