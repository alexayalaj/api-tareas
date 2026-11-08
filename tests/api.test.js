const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Entorno de pruebas: carpeta temporal para que tareas.json real no cambie.
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'api-tareas-'));
process.env.DATA_DIR = carpeta;
process.env.JWT_SECRET = 'clave-de-prueba';
process.env.JWT_EXPIRES_IN = '30m';
const tareasOriginal = fs.readFileSync(path.join(__dirname, '..', 'tareas.json'), 'utf8');
fs.writeFileSync(path.join(carpeta, 'tareas.json'), tareasOriginal);

const app = require('../server');
const jwt = require('jsonwebtoken');

let servidor;
let base;
let token;

test.before(async () => {
  await new Promise((resolve) => {
    servidor = app.listen(0, resolve);
  });
  base = `http://localhost:${servidor.address().port}`;
});

test.after(() => {
  servidor.close();
  const real = fs.readFileSync(path.join(__dirname, '..', 'tareas.json'), 'utf8');
  assert.strictEqual(real, tareasOriginal);
});

async function pedir(metodo, ruta, cuerpo, tok) {
  const encabezados = { 'Content-Type': 'application/json' };
  if (tok) encabezados.Authorization = `Bearer ${tok}`;
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: encabezados,
    body: typeof cuerpo === 'string' ? cuerpo : cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: r.status, json: await r.json() };
}

test('GET / es público', async () => {
  const r = await pedir('GET', '/');
  assert.strictEqual(r.status, 200);
});

test('registro correcto (201, sin hash) y usuario repetido (409)', async () => {
  const r = await pedir('POST', '/register', { usuario: 'alexis', password: 'Clave12345' });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.json.datos.usuario, 'alexis');
  assert.ok(!('passwordHash' in r.json.datos) && !('password' in r.json.datos));
  const repetido = await pedir('POST', '/register', { usuario: 'alexis', password: 'Otra123456' });
  assert.strictEqual(repetido.status, 409);
});

test('la contraseña se guarda cifrada', () => {
  const usuarios = JSON.parse(fs.readFileSync(path.join(carpeta, 'usuarios.json'), 'utf8'));
  assert.notStrictEqual(usuarios[0].passwordHash, 'Clave12345');
  assert.ok(usuarios[0].passwordHash.startsWith('$2'));
});

test('registro con datos inválidos (400)', async () => {
  assert.strictEqual((await pedir('POST', '/register', { usuario: 'ab', password: 'Clave12345' })).status, 400);
  assert.strictEqual((await pedir('POST', '/register', { usuario: 'bueno', password: 'corta' })).status, 400);
  assert.strictEqual((await pedir('POST', '/register', {})).status, 400);
});

test('login incorrecto (401) y correcto (200 con token)', async () => {
  assert.strictEqual((await pedir('POST', '/login', { usuario: 'alexis', password: 'mala' })).status, 401);
  assert.strictEqual((await pedir('POST', '/login', { usuario: 'noexiste', password: 'Clave12345' })).status, 401);
  assert.strictEqual((await pedir('POST', '/login', { usuario: 'alexis' })).status, 400);
  const r = await pedir('POST', '/login', { usuario: 'alexis', password: 'Clave12345' });
  assert.strictEqual(r.status, 200);
  assert.ok(r.json.datos.token);
  token = r.json.datos.token;
});

test('sin token 401; token alterado o expirado 403', async () => {
  assert.strictEqual((await pedir('GET', '/tareas')).status, 401);
  assert.strictEqual((await pedir('GET', '/tareas', null, token + 'x')).status, 403);
  const expirado = jwt.sign({ id: 'x', usuario: 'alexis' }, 'clave-de-prueba', { expiresIn: -10 });
  assert.strictEqual((await pedir('GET', '/tareas', null, expirado)).status, 403);
  for (const [m, ruta] of [['POST', '/tareas'], ['PUT', '/tareas/1'], ['DELETE', '/tareas/1']]) {
    assert.strictEqual((await pedir(m, ruta, {})).status, 401);
  }
});

test('CRUD completo de tareas', async () => {
  const lista = await pedir('GET', '/tareas', null, token);
  assert.strictEqual(lista.status, 200);
  assert.strictEqual(lista.json.datos.length, 5);

  const creada = await pedir('POST', '/tareas', { titulo: '  Nueva tarea ', descripcion: 'Descripción de prueba' }, token);
  assert.strictEqual(creada.status, 201);
  assert.strictEqual(creada.json.datos.titulo, 'Nueva tarea');
  assert.strictEqual(creada.json.datos.completada, false);
  assert.strictEqual(creada.json.datos.creadaPor, 'alexis');
  const id = creada.json.datos.id;

  const act = await pedir('PUT', `/tareas/${id}`, { completada: true }, token);
  assert.strictEqual(act.status, 200);
  assert.strictEqual(act.json.datos.completada, true);
  assert.strictEqual(act.json.datos.titulo, 'Nueva tarea');

  const borrada = await pedir('DELETE', `/tareas/${id}`, null, token);
  assert.strictEqual(borrada.status, 200);
  const final = await pedir('GET', '/tareas', null, token);
  assert.strictEqual(final.json.datos.length, 5);
});

test('validaciones 400 en tareas', async () => {
  assert.strictEqual((await pedir('POST', '/tareas', { titulo: 'ab', descripcion: 'x' }, token)).status, 400);
  assert.strictEqual((await pedir('POST', '/tareas', { titulo: 'Título válido' }, token)).status, 400);
  assert.strictEqual((await pedir('POST', '/tareas', { titulo: 123, descripcion: 'x' }, token)).status, 400);
  assert.strictEqual((await pedir('PUT', '/tareas/abc', {}, token)).status, 400);
  assert.strictEqual((await pedir('PUT', '/tareas/abc', { completada: 'si' }, token)).status, 400);
});

test('404 de tarea inexistente y de ruta inexistente', async () => {
  assert.strictEqual((await pedir('PUT', '/tareas/no-existe', { titulo: 'Título nuevo' }, token)).status, 404);
  assert.strictEqual((await pedir('DELETE', '/tareas/no-existe', null, token)).status, 404);
  assert.strictEqual((await pedir('GET', '/ruta-que-no-existe')).status, 404);
});

test('JSON mal formado responde 400', async () => {
  const r = await pedir('POST', '/login', '{"usuario": "alexis", ', null);
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.json.ok, false);
});

test('dos POST simultáneos no pierden datos', async () => {
  const antes = (await pedir('GET', '/tareas', null, token)).json.datos.length;
  const [a, b] = await Promise.all([
    pedir('POST', '/tareas', { titulo: 'Simultánea A', descripcion: 'a' }, token),
    pedir('POST', '/tareas', { titulo: 'Simultánea B', descripcion: 'b' }, token),
  ]);
  assert.strictEqual(a.status, 201);
  assert.strictEqual(b.status, 201);
  const despues = (await pedir('GET', '/tareas', null, token)).json.datos.length;
  assert.strictEqual(despues, antes + 2);
});

test('archivo corrupto responde 500 con mensaje claro', async () => {
  const ruta = path.join(carpeta, 'tareas.json');
  const bueno = fs.readFileSync(ruta, 'utf8');
  fs.writeFileSync(ruta, '[ {"roto": ');
  const r = await pedir('GET', '/tareas', null, token);
  assert.strictEqual(r.status, 500);
  assert.match(r.json.mensaje, /dañado/);
  fs.writeFileSync(ruta, bueno);
});

test('el JSON de tareas queda válido', () => {
  const datos = JSON.parse(fs.readFileSync(path.join(carpeta, 'tareas.json'), 'utf8'));
  assert.ok(Array.isArray(datos));
});

test('crypto disponible para ids únicos', () => {
  assert.notStrictEqual(crypto.randomUUID(), crypto.randomUUID());
});
