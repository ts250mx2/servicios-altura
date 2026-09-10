import { leerSesion } from "@/lib/auth/sesion";
import { leerUpload } from "@/lib/importacion/archivos";

/**
 * Entrega los archivos de `uploads/` (PDF originales y fotos de evidencia).
 * Exige sesión aquí mismo, además del proxy: el patrón del proxy deja pasar
 * sin cookie cualquier ruta que termine en .png, y esto no debe depender de él.
 */
export async function GET(_peticion: Request, contexto: { params: Promise<{ ruta: string[] }> }) {
  const sesion = await leerSesion();
  if (!sesion) return new Response("Sesión requerida", { status: 401 });

  const { ruta } = await contexto.params;
  const archivo = await leerUpload(ruta);
  if (!archivo) return new Response("No encontrado", { status: 404 });

  return new Response(archivo.datos, {
    headers: {
      "Content-Type": archivo.tipo,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
