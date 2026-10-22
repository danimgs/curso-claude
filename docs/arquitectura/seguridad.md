# Seguridad

Resumen de las medidas de seguridad de Resttek y de lo que queda pendiente. Nace de una auditoría OWASP Top 10 de la API y de `web-empleados`; el plan completo está en `docs/plans/2026-10-21-correccion-vulnerabilidades-owasp.md`.

## Autenticación

- **Secreto JWT**: `JWT_SECRET` se lee solo en `packages/api/src/config/env.ts`. En `NODE_ENV=production` la API no arranca si falta o si es el valor de desarrollo (`super-secret-resttek-key`). En desarrollo y test se usa ese valor con un aviso.
- **Token**: HS256 con `issuer: resttek` y `audience: resttek-web`; `authenticate` rechaza cualquier otro algoritmo, emisor o audiencia. Dura 1 hora (`JWT_EXPIRES_IN_SECONDS`).
- **Revalidación**: en cada petición `authenticate` consulta al empleado en la BD y usa su **rol y `restaurantId` actuales**, no los del token. Un empleado despedido, degradado o trasladado pierde los permisos al instante.
- **Contraseñas**: mínimo 10 caracteres y distinta del email (`WeakPasswordError`, 400). El email se normaliza a minúsculas y sin espacios, así que `A@x.com` y `a@x.com` son la misma cuenta.
- **Fuerza bruta**: `express-rate-limit` en `/api/v1/auth/login` (10 intentos por 15 minutos y por IP) y `/api/v1/auth/register` (20 por hora). Responde 429.
- **Enumeración**: si el email no existe, el login compara igualmente contra un hash ficticio para igualar los tiempos.

## Autorización

- `authorize(roles)` comprueba el rol. `authorizeRestaurant` comprueba que el usuario es admin o pertenece al restaurante de `:restaurantId`; si no, 403.
- Los servicios buscan platos e ingredientes por `(id, restaurantId)`: un recurso de otro restaurante devuelve **404**, no 403, para no confirmar que existe.
- Pedidos: `GET /orders/active` y el `PATCH` del estado de un ítem son solo para personal. El restaurante sale del token (solo el admin puede indicarlo por query). `GET /orders/:id` lo ven el cliente propietario, el personal de ese restaurante y el admin; para el resto, 404.
- Los ítems de un pedido solo avanzan (`pendiente`, `preparando`, `listo`, `entregado`); retroceder da `InvalidStatusTransitionError` (400).
- `GET /public/restaurants[/:id]` es público y solo devuelve `id`, `name`, `address`, `phone` y `logoUrl`.

## Validación de entrada

- Pedidos: `items` es una lista de 1 a 50; `quantity` es un entero de 1 a 20; `notes` tiene como máximo 200 caracteres; el restaurante debe existir y cada plato debe ser de ese restaurante y estar disponible. El pedido y sus ítems se guardan en una transacción.
- Platos e ingredientes: `price` y `currentStock` deben ser números finitos; el nombre es texto de hasta 100 caracteres; los ingredientes de un plato deben existir y ser del mismo restaurante.
- `logoUrl` solo acepta URLs `https` (hasta 2048 caracteres).
- `GET /employees`: `limit` máximo 100 (un valor inválido usa 10) y `offset` no negativo. Al crear un empleado, el restaurante debe existir.
- `express.json` admite como máximo 100 kb; un JSON mal formado da 400 y uno demasiado grande 413.

## Transacciones con una sola conexión

`Database` usa una única conexión SQLite compartida. `Database.transaction(fn)` serializa las transacciones y hace que las consultas de otras peticiones **esperen** mientras hay una abierta, para que ninguna se cuele dentro ni se revierta con ella. Dentro de `fn` se usa el ejecutor `tx`, no `Database`.

## Configuración HTTP y registro

- `helmet`, sin `X-Powered-By`.
- CORS con lista blanca (`CORS_ORIGINS`, separada por comas). Sin la variable: puertos 4200-4202 de localhost en desarrollo y **ningún** origen en producción.
- `errorHandler` devuelve el nombre y el mensaje de los errores de dominio y un 500 genérico para el resto, que se registra.
- Logs JSON con pino (`LOG_LEVEL`; en tests, `silent`). Se registran `login_ok`, `login_failed`, `auth_rejected` (401), `forbidden` (403), `employee_created` y `unhandled_error`. Nunca se registran contraseñas, la cabecera `Authorization` ni la query string.

## Frontend

- `roleGuard` (`web-shared`) restringe `/cocina`, `/barra` y `/salon` por rol y redirige a la pantalla de inicio del rol. Es solo navegación.
- `AuthStore` valida la sesión guardada en `localStorage` y la descarta si está corrupta o el token ha caducado (`exp`, leído sin verificar la firma). `authGuard` lo comprueba en cada navegación.
- `errorInterceptor`: un 401 limpia siempre la sesión y redirige a `/login` una sola vez; un 403 no cierra la sesión.
- `authInterceptor` envía el Bearer solo a URLs que cuelgan de `API_URL`.
- Los errores HTTP se muestran con textos fijos por código de estado (`httpErrorMessage`), sin la URL ni el detalle del servidor.
- `web-empleados` lleva una meta CSP. En producción se desactiva `inlineCritical`, porque su `onload` inline la bloquearía.

## Pendiente y limitaciones conocidas

- **Token en `localStorage`**: un XSS futuro podría leerlo. Lo ideal es una cookie `HttpOnly; Secure; SameSite` con protección CSRF, que afecta a los cuatro frontends.
- **Sin refresh token ni revocación explícita**: la revalidación en la BD cubre despidos y cambios de rol, pero no hay logout en el servidor.
- **Cabeceras del hosting**: `frame-ancestors` y HSTS no se pueden fijar con una meta; deben ir en la cabecera del servidor de producción.
- **CSP**: solo en `web-empleados`, comprobada en el build y no en un navegador. Falta en `web-admin` y `web-clientes`.
- **Dependencias**: `npm audit` baja de 44 a 18 avisos. Quedan los que exigen saltos mayores: `sqlite3@6` (`tar` y `node-gyp`, solo en la instalación), `vitest@5` (solo desarrollo) y las herramientas de Angular. Subir `@angular/build` exige mover los assets compartidos (ver `CLAUDE.md`). No exponer `ng serve` fuera de localhost.
- **Seed**: con contraseñas iguales al email, solo para desarrollo; está bloqueado en producción.
- `web-admin` y `web-clientes` no se auditaron; se benefician de los cambios de `web-shared`.
