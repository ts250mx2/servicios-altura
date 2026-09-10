/** Plomería común de las rutas que reciben un archivo por multipart (campo `archivo`). */

export interface ArchivoRecibido {
  nombre: string;
  tipo: string;
  bytes: Uint8Array;
}

/**
 * El campo `archivo` del multipart, o null si no viene nada usable. Ojo: con
 * `proxy.ts` presente, Next clona el cuerpo con un tope
 * (`experimental.proxyClientMaxBodySize` en next.config.ts); si el tope es menor
 * que el archivo, el multipart llega truncado y no se parsea.
 */
export async function recibirArchivo(peticion: Request): Promise<ArchivoRecibido | null> {
  try {
    const valor = (await peticion.formData()).get("archivo");
    if (!esArchivo(valor)) return null;
    return { nombre: valor.name, tipo: valor.type, bytes: new Uint8Array(await valor.arrayBuffer()) };
  } catch (error) {
    console.error(
      `No se pudo leer el multipart (content-length=${peticion.headers.get("content-length")}):`,
      error,
    );
    return null;
  }
}

/** `instanceof File` falla dentro del bundle de Next (otro realm); se revisa la forma. */
function esArchivo(valor: FormDataEntryValue | null): valor is File {
  return (
    typeof valor === "object" &&
    valor !== null &&
    typeof (valor as File).arrayBuffer === "function" &&
    typeof (valor as File).name === "string"
  );
}
