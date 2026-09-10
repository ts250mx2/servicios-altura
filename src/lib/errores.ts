/**
 * Error cuyo mensaje se le puede decir al usuario tal cual: folio repetido,
 * importación ya aplicada, cliente sin nombre… Las rutas lo convierten en la
 * respuesta HTTP con su `estado`; cualquier otro error se registra y al cliente
 * sólo le llega un texto genérico.
 */
export class ErrorDeNegocio extends Error {
  constructor(mensaje: string, readonly estado = 409) {
    super(mensaje);
    this.name = "ErrorDeNegocio";
  }
}
