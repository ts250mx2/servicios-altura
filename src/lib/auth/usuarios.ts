import bcrypt from "bcryptjs";
import { consultaUna, ejecuta } from "@/lib/db";
import type { Sesion } from "./sesion";

interface FilaUsuario {
  IdUsuario: number;
  Usuario: string;
  Login: string;
  ClaveHash: string;
  Perfil: Sesion["perfil"];
  EsVendedor: number;
  Status: number;
}

export async function autenticar(login: string, clave: string): Promise<Sesion | null> {
  const fila = await consultaUna<FilaUsuario>(
    "SELECT IdUsuario, Usuario, Login, ClaveHash, Perfil, EsVendedor, Status FROM tblUsuarios WHERE Login = ? LIMIT 1",
    [login.trim()],
  );
  if (!fila || fila.Status !== 1) return null;
  if (!(await bcrypt.compare(clave, fila.ClaveHash))) return null;

  await ejecuta("UPDATE tblUsuarios SET UltimoAcceso = NOW() WHERE IdUsuario = ?", [fila.IdUsuario]);

  return {
    idUsuario: fila.IdUsuario,
    usuario: fila.Usuario,
    login: fila.Login,
    perfil: fila.Perfil,
    esVendedor: fila.EsVendedor === 1,
  };
}

export async function hashClave(clave: string): Promise<string> {
  return bcrypt.hash(clave, 10);
}

/** Límite simple de intentos por minuto y por login, en memoria del proceso. */
const intentos = new Map<string, { conteo: number; desde: number }>();

export function demasiadosIntentos(login: string, maximo = 8): boolean {
  const ahora = Date.now();
  const actual = intentos.get(login);
  if (!actual || ahora - actual.desde > 60_000) {
    intentos.set(login, { conteo: 1, desde: ahora });
    return false;
  }
  actual.conteo += 1;
  return actual.conteo > maximo;
}
