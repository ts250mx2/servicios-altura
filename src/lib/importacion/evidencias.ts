import path from "node:path";
import sharp from "sharp";
import { carpetaEvidencias, guardarArchivo, urlEvidencia } from "./archivos";
import { extraerFotos } from "./imagenes-pdf";

/** Las fotos de celular vienen de 3 200 a 4 080 px; para la galería basta con esto. */
const LADO_MAXIMO = 1600;
const CALIDAD_JPEG = 82;

/** Extrae las fotos del PDF, las reduce a tamaño web y devuelve sus rutas públicas. */
export async function guardarEvidencias(idImportacion: number, bytes: Uint8Array): Promise<string[]> {
  const fotos = await extraerFotos(bytes);
  const rutas: string[] = [];
  for (const [indice, foto] of fotos.entries()) {
    const nombre = `${indice + 1}.jpg`;
    const reducida = await sharp(Buffer.from(foto.jpeg))
      .rotate()
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: CALIDAD_JPEG })
      .toBuffer();
    await guardarArchivo(path.join(carpetaEvidencias(idImportacion), nombre), new Uint8Array(reducida));
    rutas.push(urlEvidencia(idImportacion, nombre));
  }
  return rutas;
}
