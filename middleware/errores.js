const HttpError = require('../utils/HttpError');

/** Registra con console.log método, ruta, estado y duración de cada petición. */
function registrarPeticion(req, res, next) {
  const inicio = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio} ms)`);
  });
  next();
}

/** Catch-all: cualquier ruta no definida responde 404. */
function noEncontrado(req, res, next) {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/** Middleware de errores (4 parámetros): respuesta JSON uniforme. */
// eslint-disable-next-line no-unused-vars
function manejarErrores(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.status || 500;
  let mensaje = err.message;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    mensaje = 'El cuerpo de la petición no es un JSON válido.';
  }
  if (status >= 500) {
    console.error(err.stack);
    mensaje = err instanceof HttpError ? err.message : 'Error interno del servidor.';
    status = 500;
  }
  res.status(status).json({ ok: false, mensaje, datos: null });
}

module.exports = { registrarPeticion, noEncontrado, manejarErrores };
