import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticar, demasiadosIntentos } from "@/lib/auth/usuarios";
import { firmarSesion, guardarCookie } from "@/lib/auth/sesion";

const Entrada = z.object({
  login: z.string().min(1).max(40),
  clave: z.string().min(1).max(200),
});

export async function POST(peticion: Request) {
  const cuerpo = Entrada.safeParse(await peticion.json().catch(() => null));
  if (!cuerpo.success) {
    return NextResponse.json({ mensaje: "Datos incompletos." }, { status: 400 });
  }

  const { login, clave } = cuerpo.data;

  if (demasiadosIntentos(login)) {
    return NextResponse.json(
      { mensaje: "Demasiados intentos. Espera un minuto." },
      { status: 429 },
    );
  }

  try {
    const sesion = await autenticar(login, clave);
    if (!sesion) {
      return NextResponse.json({ mensaje: "Usuario o contraseña incorrectos." }, { status: 401 });
    }
    await guardarCookie(await firmarSesion(sesion));
    return NextResponse.json({ ok: true, usuario: sesion.usuario });
  } catch (error) {
    console.error("Error al autenticar:", error);
    return NextResponse.json(
      { mensaje: "No se pudo consultar la base. Revisa la configuración." },
      { status: 500 },
    );
  }
}
