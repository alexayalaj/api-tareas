# API de tareas — Nodo Sur Soluciones Digitales

API RESTful hecha con Node.js y Express.js para gestionar las tareas internas del equipo de Nodo Sur.
Las tareas se guardan en `tareas.json` y los usuarios en `usuarios.json` (ambos con `fs.promises`).
Las rutas de tareas están protegidas con JSON Web Token (JWT) y las contraseñas se cifran con bcryptjs.

Repositorio: https://github.com/alexayalaj/api-tareas

## Requisitos

- Node.js 20.6 o superior (se usa `--env-file`, nativo de Node, sin `dotenv`).
- Postman o curl para probar la API.

## Instalación

```bash
npm install
cp .env.example .env
```

Abre `.env` y escribe una clave secreta en `JWT_SECRET` (cualquier texto largo y difícil de adivinar).
El archivo `.env` no se sube a Git.

## Ejecución

| Comando | Qué hace |
|---|---|
| `npm start` | Inicia el servidor en el puerto 3000 |
| `npm run dev` | Igual, pero se reinicia al guardar cambios |
| `npm run debug` | Inicia con `--inspect` para depurar (`chrome://inspect`) |
| `npm test` | Corre las pruebas automáticas (`node:test`) |

Al iniciar debe aparecer: `Servidor escuchando en http://localhost:3000`.

## Endpoints

Todas las respuestas tienen la forma `{ "ok": true|false, "mensaje": "...", "datos": ... }`.

| Método y ruta | Acceso | Éxito | Errores |
|---|---|---|---|
| GET `/` | público | 200 | — |
| POST `/register` | público | 201 | 400, 409 |
| POST `/login` | público | 200 (token) | 400, 401 |
| GET `/tareas` | token | 200 | 401, 403 |
| POST `/tareas` | token | 201 | 400, 401, 403 |
| PUT `/tareas/:id` | token | 200 | 400, 401, 403, 404 |
| DELETE `/tareas/:id` | token | 200 | 401, 403, 404 |
| cualquier otra | — | — | 404 |

El token se envía en el encabezado `Authorization: Bearer <token>` y dura 30 minutos.

## Ejemplos con curl

```bash
curl -X POST http://localhost:3000/register -H "Content-Type: application/json" \
  -d '{"usuario":"alexis","password":"Clave12345"}'

curl -X POST http://localhost:3000/login -H "Content-Type: application/json" \
  -d '{"usuario":"alexis","password":"Clave12345"}'

curl http://localhost:3000/tareas -H "Authorization: Bearer <token>"

curl -X POST http://localhost:3000/tareas -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Nueva tarea","descripcion":"Descripción de la tarea"}'
```

La colección de Postman está en `docs/API_Tareas.postman_collection.json`.

## Estructura

```
server.js            configuración, rutas y lógica de autenticación
datos/almacen.js     lectura y escritura de JSON con fs.promises
middleware/          autenticación, validaciones y manejo de errores
utils/HttpError.js   error con código de estado HTTP
tests/               pruebas automáticas
tareas.json          tareas de ejemplo
```

## Depuración

1. `npm run debug`: debe mostrar `Debugger listening on ws://`.
2. En Chrome abre `chrome://inspect`, pulsa *inspect* en el destino de Node y coloca un breakpoint
   en `server.js`.
3. El registro de cada petición (método, ruta, estado y milisegundos) sale en la terminal con `console.log`.
