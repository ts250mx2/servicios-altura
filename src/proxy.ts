import { NextResponse, type NextRequest } from "next/server";
import { NOMBRE_COOKIE, verificarToken } from "@/lib/auth/sesion";

const PUBLICAS = ["/login", "/api/auth/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(NOMBRE_COOKIE)?.value;
  const sesion = token ? await verificarToken(token) : null;

  if (!sesion) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });
    }
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.searchParams.set("regresar", pathname);
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|icon.svg|.*\\.png$).*)"],
};
