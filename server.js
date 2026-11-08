/**
 * API de tareas internas de Nodo Sur Soluciones Digitales.
 * Configuración del servidor, rutas y lógica de autenticación.
 */
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { obtenerTareas, guardarTareas, obtenerUsuarios, guardarUsuarios, enExclusiva } = require('./datos/almacen');
const autenticarToken = require('./middleware/autenticar');
const { validarRegistro, validarLogin, validarTareaNueva, validarTareaCambios } = require('./middleware/validar');
const { registrarPeticion, noEncontrado, manejarErrores } = require('./middleware/errores');
const HttpError = require('./utils/HttpError');

const app = express();

/** Respuesta JSON uniforme { ok, mensaje, datos }. */
const responder = (res, status, mensaje, datos = null) =>
  res.status(status).json({ ok: true, mensaje, datos });

// Middleware global: primero el registro, después el análisis del cuerpo JSON.
app.use(registrarPeticion);
app.use(bodyParser.json());

app.get('/', (req, res) =>
  responder(res, 200, 'API de tareas de Nodo Sur', {
    rutas: ['POST /register', 'POST /login', 'GET /tareas', 'POST /tareas', 'PUT /tareas/:id', 'DELETE /tareas/:id'],
  })
);

// ---------- Autenticación ----------
app.post('/register', validarRegistro, async (req, res, next) => {
  try {
    const { usuario, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const nuevo = await enExclusiva(async () => {
      const usuarios = await obtenerUsuarios();
      if (usuarios.some((u) => u.usuario.toLowerCase() === usuario.toLowerCase())) {
        throw new HttpError(409, 'Ese nombre de usuario ya está registrado.');
      }
      const registro = { id: crypto.randomUUID(), usuario, passwordHash, fechaRegistro: new Date().toISOString() };
      usuarios.push(registro);
      await guardarUsuarios(usuarios);
      return registro;
    });
    responder(res, 201, 'Usuario registrado', { id: nuevo.id, usuario: nuevo.usuario, fechaRegistro: nuevo.fechaRegistro });
  } catch (err) {
    next(err);
  }
});

app.post('/login', validarLogin, async (req, res, next) => {
  try {
    const { usuario, password } = req.body;
    const usuarios = await obtenerUsuarios();
    const encontrado = usuarios.find((u) => u.usuario.toLowerCase() === usuario.toLowerCase());
    const valido = encontrado && (await bcrypt.compare(password, encontrado.passwordHash));
    if (!valido) throw new HttpError(401, 'Usuario o contraseña incorrectos.');

    const expiresIn = process.env.JWT_EXPIRES_IN || '30m';
    const token = jwt.sign({ id: encontrado.id, usuario: encontrado.usuario }, process.env.JWT_SECRET, { expiresIn });
    responder(res, 200, 'Inicio de sesión correcto', { token, expiraEn: expiresIn });
  } catch (err) {
    next(err);
  }
});

// ---------- Tareas (todas protegidas) ----------
app.get('/tareas', autenticarToken, async (req, res, next) => {
  try {
    responder(res, 200, 'Tareas obtenidas', await obtenerTareas());
  } catch (err) {
    next(err);
  }
});

app.post('/tareas', autenticarToken, validarTareaNueva, async (req, res, next) => {
  try {
    const ahora = new Date().toISOString();
    const nueva = {
      id: crypto.randomUUID(),
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      completada: req.body.completada || false,
      creadaPor: req.usuario.usuario,
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    };
    await enExclusiva(async () => {
      const tareas = await obtenerTareas();
      tareas.push(nueva);
      await guardarTareas(tareas);
    });
    responder(res, 201, 'Tarea creada', nueva);
  } catch (err) {
    next(err);
  }
});

app.put('/tareas/:id', autenticarToken, validarTareaCambios, async (req, res, next) => {
  try {
    const actualizada = await enExclusiva(async () => {
      const tareas = await obtenerTareas();
      const indice = tareas.findIndex((t) => t.id === req.params.id);
      if (indice === -1) throw new HttpError(404, 'No existe una tarea con ese id.');
      tareas[indice] = { ...tareas[indice], ...req.body, fechaActualizacion: new Date().toISOString() };
      await guardarTareas(tareas);
      return tareas[indice];
    });
    responder(res, 200, 'Tarea actualizada', actualizada);
  } catch (err) {
    next(err);
  }
});

app.delete('/tareas/:id', autenticarToken, async (req, res, next) => {
  try {
    const eliminada = await enExclusiva(async () => {
      const tareas = await obtenerTareas();
      const indice = tareas.findIndex((t) => t.id === req.params.id);
      if (indice === -1) throw new HttpError(404, 'No existe una tarea con ese id.');
      const [quitada] = tareas.splice(indice, 1);
      await guardarTareas(tareas);
      return quitada;
    });
    responder(res, 200, 'Tarea eliminada', eliminada);
  } catch (err) {
    next(err);
  }
});

// El catch-all y el middleware de errores van al final.
app.use(noEncontrado);
app.use(manejarErrores);

module.exports = app;

if (require.main === module) {
  if (!process.env.JWT_SECRET) {
    console.error('Falta JWT_SECRET. Copia .env.example a .env y escribe una clave secreta.');
    process.exit(1);
  }
  const PORT = process.env.PORT || 3000;
  const servidor = http.createServer(app);
  servidor.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`El puerto ${PORT} está ocupado. Cierra el otro proceso o cambia PORT en .env.`);
    } else {
      console.error(err.stack);
    }
    process.exit(1);
  });
  servidor.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}
