/**
 * Alta o actualización de un usuario del dashboard.
 *   npm run usuario -- <login> <clave> ["Nombre Apellido"] [perfil]
 * Perfiles: administrador | ventas | operaciones | campo
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const PERFILES = ["administrador", "ventas", "operaciones", "campo"];

async function principal() {
  const [login, clave, nombre, perfil = "administrador"] = process.argv.slice(2);

  if (!login || !clave) {
    console.error('Uso: npm run usuario -- <login> <clave> ["Nombre Apellido"] [perfil]');
    process.exit(1);
  }
  if (!PERFILES.includes(perfil)) {
    console.error(`Perfil inválido. Usa uno de: ${PERFILES.join(", ")}`);
    process.exit(1);
  }

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "BDServiciosAltura",
  });

  const hash = await bcrypt.hash(clave, 10);
  const esVendedor = perfil === "ventas" ? 1 : 0;

  await conexion.query(
    `INSERT INTO tblUsuarios (Usuario, Login, ClaveHash, Perfil, EsVendedor)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE Usuario = VALUES(Usuario), ClaveHash = VALUES(ClaveHash),
                             Perfil = VALUES(Perfil), EsVendedor = VALUES(EsVendedor), Status = 1`,
    [nombre || login, login, hash, perfil, esVendedor],
  );

  await conexion.end();
  console.log(`Usuario "${login}" listo con perfil ${perfil}.`);
}

principal().catch((error) => {
  console.error("Falló el alta:", error.message);
  process.exit(1);
});
