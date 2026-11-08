const HttpError = require('../utils/HttpError');

/** Devuelve el texto recortado, o null si no es una cadena. */
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : null);

/** Comprueba que un campo de texto exista y tenga la longitud pedida. */
function exigirTexto(valor, nombre, min, max) {
  const t = texto(valor);
  if (t === null) throw new HttpError(400, `El campo "${nombre}" es obligatorio y debe ser texto.`);
  if (t.length < min || t.length > max) {
    throw new HttpError(400, `El campo "${nombre}" debe tener entre ${min} y ${max} caracteres.`);
  }
  return t;
}

/** Valida y normaliza el cuerpo de POST /register. */
function validarRegistro(req, res, next) {
  try {
    const cuerpo = req.body || {};
    const usuario = exigirTexto(cuerpo.usuario, 'usuario', 3, 30);
    if (!/^[A-Za-z0-9]+$/.test(usuario)) {
      throw new HttpError(400, 'El campo "usuario" solo admite letras y números.');
    }
    if (typeof cuerpo.password !== 'string' || cuerpo.password.length < 8) {
      throw new HttpError(400, 'El campo "password" es obligatorio y debe tener al menos 8 caracteres.');
    }
    req.body = { usuario, password: cuerpo.password };
    next();
  } catch (err) {
    next(err);
  }
}

/** Valida el cuerpo de POST /login. */
function validarLogin(req, res, next) {
  const cuerpo = req.body || {};
  if (texto(cuerpo.usuario) === null || texto(cuerpo.usuario) === '' ||
      typeof cuerpo.password !== 'string' || cuerpo.password === '') {
    return next(new HttpError(400, 'Los campos "usuario" y "password" son obligatorios.'));
  }
  req.body = { usuario: cuerpo.usuario.trim(), password: cuerpo.password };
  next();
}

/** Valida el cuerpo de POST /tareas (titulo y descripcion obligatorios). */
function validarTareaNueva(req, res, next) {
  try {
    const cuerpo = req.body || {};
    const titulo = exigirTexto(cuerpo.titulo, 'titulo', 3, 100);
    const descripcion = exigirTexto(cuerpo.descripcion, 'descripcion', 1, 500);
    const nueva = { titulo, descripcion };
    if (cuerpo.completada !== undefined) {
      if (typeof cuerpo.completada !== 'boolean') {
        throw new HttpError(400, 'El campo "completada" debe ser verdadero o falso.');
      }
      nueva.completada = cuerpo.completada;
    }
    req.body = nueva;
    next();
  } catch (err) {
    next(err);
  }
}

/** Valida el cuerpo de PUT /tareas/:id (al menos un campo válido). */
function validarTareaCambios(req, res, next) {
  try {
    const cuerpo = req.body || {};
    const cambios = {};
    if (cuerpo.titulo !== undefined) cambios.titulo = exigirTexto(cuerpo.titulo, 'titulo', 3, 100);
    if (cuerpo.descripcion !== undefined) cambios.descripcion = exigirTexto(cuerpo.descripcion, 'descripcion', 1, 500);
    if (cuerpo.completada !== undefined) {
      if (typeof cuerpo.completada !== 'boolean') {
        throw new HttpError(400, 'El campo "completada" debe ser verdadero o falso.');
      }
      cambios.completada = cuerpo.completada;
    }
    if (Object.keys(cambios).length === 0) {
      throw new HttpError(400, 'Envía al menos uno de los campos: titulo, descripcion, completada.');
    }
    req.body = cambios;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validarRegistro, validarLogin, validarTareaNueva, validarTareaCambios };
