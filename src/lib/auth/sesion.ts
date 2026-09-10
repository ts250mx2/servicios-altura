import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const NOMBRE_COOKIE = "sa_sesion";
const DURACION = "12h";

export interface Sesion {
  idUsuario: number;
  usuario: string;
  login: string;
  perfil: "administrador" | "ventas" | "operaciones" | "campo";
  esVendedor: boolean;
}

function llave(): Uint8Array {
  const secreto = process.env.JWT_SECRET;
  if (!secreto || secreto.length < 16) {
    throw new Error("Falta JWT_SECRET en .env (cadena larga y aleatoria).");
  }
  return new TextEncoder().encode(secreto);
}

export async function firmarSesion(sesion: Sesion): Promise<string> {
  return new SignJWT({ ...sesion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(DURACION)
    .sign(llave());
}

export async function leerSesion(): Promise<Sesion | null> {
  const galleta = (await cookies()).get(NOMBRE_COOKIE);
  if (!galleta) return null;
  return verificarToken(galleta.value);
}

export async function verificarToken(token: string): Promise<Sesion | null> {
  try {
    const { payload } = await jwtVerify(token, llave());
    return payload as unknown as Sesion;
  } catch {
    return null;
  }
}

export async function guardarCookie(token: string): Promise<void> {
  (await cookies()).set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function borrarCookie(): Promise<void> {
  (await cookies()).delete(NOMBRE_COOKIE);
}

export { NOMBRE_COOKIE };

/** Para páginas de servidor: exige sesión o revienta (el proxy ya redirigió). */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await leerSesion();
  if (!sesion) throw new Error("Sesión requerida");
  return sesion;
}
