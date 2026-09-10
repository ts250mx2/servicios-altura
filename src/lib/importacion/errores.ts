/**
 * Error cuyo mensaje se le puede enseñar al usuario tal cual (archivo que no es
 * una hoja de levantamiento, demasiadas páginas…). Cualquier otro error se
 * registra en el servidor y al cliente sólo le llega un texto genérico.
 */
export class ErrorDeImportacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeImportacion";
  }
}
