const jwt = require('jsonwebtoken');
const HttpError = require('../utils/HttpError');

/**
 * Protege una ruta: exige el encabezado Authorization con "Bearer <token>".
 * Sin token responde 401; con token inválido o expirado, 403.
 * Deja el usuario en req.usuario.
 */
function autenticarToken(req, res, next) {
  const encabezado = req.headers['authorization'];
  if (!encabezado) return next(new HttpError(401, 'Token requerido'));

  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : encabezado;
  jwt.verify(token, process.env.JWT_SECRET, (err, datos) => {
    if (err) return next(new HttpError(403, 'Token inválido o expirado'));
    req.usuario = { id: datos.id, usuario: datos.usuario };
    next();
  });
}

module.exports = autenticarToken;
