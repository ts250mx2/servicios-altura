import { NextResponse } from "next/server";
import { z } from "zod";
import { enTransaccion } from "@/lib/db";
import { leerSesion } from "@/lib/auth/sesion";
import { tarjetasTablero } from "@/lib/consultas/proyectos";
import { ErrorDeNegocio } from "@/lib/errores";
import { COLUMNAS, cambiosParaColumna, columnaDe } from "@/lib/tablero/columnas";
import { aplicarCambios, refrescarTarjeta } from "@/lib/tablero/mover";

const Entrada = z.object({
  clave: z.string().regex(/^[LC]\d+$/),
  destino: z.enum(COLUMNAS.map((c) => c.clave) as [string, ...string[]]),
});

/** Mueve una tarjeta del tablero a otra columna cambiando los estatus que haga falta. */
export async function POST(peticion: Request) {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ mensaje: "Sesión expirada" }, { status: 401 });

  const cuerpo = Entrada.safeParse(await peticion.json().catch(() => null));
  if (!cuerpo.success) return NextResponse.json({ mensaje: "Movimiento inválido." }, { status: 400 });
  const destino = cuerpo.data.destino as (typeof COLUMNAS)[number]["clave"];

  const pintada = (await tarjetasTablero()).find((t) => t.clave === cuerpo.data.clave);
  if (!pintada) return NextResponse.json({ mensaje: "La tarjeta ya no existe." }, { status: 404 });

  try {
    const cambios = await enTransaccion(async (cx) => {
      // La decisión se toma con los estatus recién leídos y bloqueados, no con los del tablero pintado.
      const tarjeta = await refrescarTarjeta(cx, pintada);
      if (columnaDe(tarjeta) === destino) return null;
      const decision = cambiosParaColumna(tarjeta, destino);
      if (!decision.ok) throw new ErrorDeNegocio(decision.motivo);
      await aplicarCambios(cx, tarjeta, decision.cambios);
      const columna = COLUMNAS.find((c) => c.clave === destino)!;
      await cx.query(
        "INSERT INTO tblBitacora (IdUsuario, Entidad, IdEntidad, Accion, Detalle) VALUES (?, ?, ?, 'ESTATUS', ?)",
        [
          sesion.idUsuario,
          tarjeta.levantamiento ? "LEVANTAMIENTO" : "COTIZACION",
          tarjeta.levantamiento?.id ?? tarjeta.cotizacion?.id ?? null,
          `Movido a «${columna.titulo}» desde el tablero`,
        ],
      );
      return decision.cambios;
    });
    return cambios ? NextResponse.json({ ok: true, cambios }) : NextResponse.json({ ok: true, sinCambio: true });
  } catch (error) {
    if (error instanceof ErrorDeNegocio) return NextResponse.json({ mensaje: error.message }, { status: error.estado });
    console.error("Error al mover tarjeta:", error);
    return NextResponse.json({ mensaje: "No se pudo mover la tarjeta." }, { status: 500 });
  }
}
