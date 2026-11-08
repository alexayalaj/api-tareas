const fs = require('fs').promises;
const path = require('path');
const HttpError = require('../utils/HttpError');

/**
 * Carpeta de los archivos de datos. Se puede cambiar con DATA_DIR
 * (las pruebas usan una carpeta temporal).
 * @returns {string}
 */
function carpetaDatos() {
  return process.env.DATA_DIR || path.join(__dirname, '..');
}

// Cola de escritura por archivo: cada escritura espera a la anterior.
const colas = new Map();

/**
 * Lee un archivo JSON con fs.promises. Si no existe, lo crea con [].
 * @param {string} nombre Nombre del archivo (por ejemplo, tareas.json).
 * @returns {Promise<Array>}
 */
async function leerJSON(nombre) {
  const ruta = path.join(carpetaDatos(), nombre);
  let texto;
  try {
    texto = await fs.readFile(ruta, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      await escribirJSON(nombre, []);
      return [];
    }
    throw err;
  }
  try {
    const datos = JSON.parse(texto);
    if (!Array.isArray(datos)) throw new Error('no es un arreglo');
    return datos;
  } catch (err) {
    throw new HttpError(500, `El archivo ${nombre} está dañado y no es un JSON válido. Corrígelo o restáuralo.`);
  }
}

/**
 * Escribe un archivo JSON de forma atómica (archivo temporal + rename)
 * y en cola, para que dos peticiones simultáneas no se pisen.
 * @param {string} nombre
 * @param {Array} datos
 * @returns {Promise<void>}
 */
function escribirJSON(nombre, datos) {
  const ruta = path.join(carpetaDatos(), nombre);
  const anterior = colas.get(ruta) || Promise.resolve();
  const actual = anterior.catch(() => {}).then(async () => {
    const temporal = `${ruta}.tmp`;
    await fs.writeFile(temporal, JSON.stringify(datos, null, 2), 'utf8');
    await fs.rename(temporal, ruta);
  });
  colas.set(ruta, actual);
  return actual;
}

// Exclusión mutua: una operación leer-modificar-guardar a la vez.
let turno = Promise.resolve();

/**
 * Ejecuta una operación completa de leer, modificar y guardar sin que otra
 * petición se intercale. Evita perder datos cuando llegan dos peticiones a la vez.
 * @param {Function} operacion Función async con la operación.
 * @returns {Promise<*>} Resultado de la operación.
 */
function enExclusiva(operacion) {
  const resultado = turno.catch(() => {}).then(operacion);
  turno = resultado;
  return resultado;
}

/** @returns {Promise<Array>} Todas las tareas guardadas en tareas.json. */
const obtenerTareas = () => leerJSON('tareas.json');
/** @param {Array} tareas Lista completa que se guarda en tareas.json. */
const guardarTareas = (tareas) => escribirJSON('tareas.json', tareas);
/** @returns {Promise<Array>} Usuarios guardados en usuarios.json. */
const obtenerUsuarios = () => leerJSON('usuarios.json');
/** @param {Array} usuarios Lista completa que se guarda en usuarios.json. */
const guardarUsuarios = (usuarios) => escribirJSON('usuarios.json', usuarios);

module.exports = { obtenerTareas, guardarTareas, obtenerUsuarios, guardarUsuarios, enExclusiva };
