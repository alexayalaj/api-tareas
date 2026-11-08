/**
 * Error con código de estado HTTP, para que el middleware de errores
 * responda con el estado correcto.
 */
class HttpError extends Error {
  /**
   * @param {number} status Código de estado HTTP (400, 401, 403, 404, 409, 500...).
   * @param {string} message Mensaje claro para el cliente.
   */
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

module.exports = HttpError;
