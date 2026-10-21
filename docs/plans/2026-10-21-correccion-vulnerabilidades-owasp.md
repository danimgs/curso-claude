# Plan: Corrección de vulnerabilidades OWASP Top 10 (API y web-empleados)

- **Tipo**: bug
- **Fecha**: 2026-10-21
- **Estado**: en curso

## 1. Contexto

Una auditoría de solo lectura de `packages/api`, `packages/web-empleados` y `packages/web-shared` detectó 18 hallazgos en la API (3 críticos, 7 altos, 5 medios, 3 bajos; ids `S-xx`) y 10 en el frontend (ids `H-xx`). No hay XSS en el frontend y todas las consultas SQL de la API usan parámetros `?`.

Los problemas más graves, en la API:

- **S-03**: `JWT_SECRET` cae a `'super-secret-resttek-key'` si no hay variable de entorno. El valor está en el repositorio y duplicado en `middlewares.ts` y `BcryptAuthService.ts`. Cualquiera puede firmar un token `admin`.
- **S-01**: `authorize()` solo comprueba el rol. Nada compara `:restaurantId` con `req.user.restaurantId`, así que un `manager` del restaurante A puede editar o borrar platos e ingredientes del restaurante B.
- **S-02**: todas las rutas de `/orders` solo exigen `authenticate`. Un cliente puede listar pedidos activos de cualquier restaurante, leer cualquier pedido por id y cambiar el estado de cualquier ítem.

Comportamiento esperado: cada petición solo puede operar sobre datos de su propio restaurante (o propios, en el caso del cliente), con el rol adecuado. Los secretos no tienen valores por defecto en producción. Las entradas se validan. Los errores no filtran detalles internos.

Pasos para reproducir S-01/S-02: autenticarse como cualquier usuario, incluido un cliente recién registrado, y llamar a `GET /api/v1/orders/active?restaurantId=<otro>` o a `PATCH /api/v1/orders/<id>/items/<id>/status`. La API responde 200.

## 2. Alcance

### Incluido

- Todos los hallazgos `S-01` a `S-17` de la API, agrupados en las fases del apartado 4.
- Hallazgos del frontend `H-01` a `H-10` (`web-empleados` y `web-shared`).
- Tests de Vitest para la autorización, la validación y la configuración JWT.
- Actualización de `CLAUDE.md` y `docs/`.

### Fuera de alcance

- Migrar el token a cookie `HttpOnly` (H-02 opción ideal) y un sistema completo de refresh token revocable (S-08). Se aplica la mitigación corta: token de vida reducida y revalidación del usuario contra la BD. Queda como decisión abierta.
- Confirmación de email en el registro (S-11, opción avanzada) y CAPTCHA.
- `web-admin` y `web-clientes`. Comparten `web-shared`, así que se benefician de H-02, H-03 y H-06, pero no se auditaron.
- Despliegue: la CSP real y HSTS dependen del hosting. Aquí solo se deja la meta CSP y la documentación.

## 3. Análisis del código afectado

| Capa | Archivo | Cambio necesario |
| ---- | ------- | ---------------- |
| config | `packages/api/src/config/env.ts` (nuevo) | Leer `JWT_SECRET`, `CORS_ORIGINS`, `NODE_ENV` en un solo lugar. Abortar el arranque en producción si falta el secreto o es el valor antiguo. |
| shared | `contexts/shared/infrastructure/http/middlewares.ts` | Usar el config central. `jwt.verify` con `algorithms`, `issuer` y `audience`. Tipar `req.user`. Añadir `authorizeRestaurant`. |
| employee | `contexts/employee/infrastructure/BcryptAuthService.ts` | Usar el config central. Firmar con `issuer`, `audience` y `expiresIn` reducido. |
| employee | `RegisterClientUseCase.ts`, `CreateEmployeeUseCase.ts`, `domain/Employee.ts`, `LoginUseCase.ts` | Política de contraseñas, email normalizado, bcrypt ficticio en login con usuario inexistente. |
| employee | `EmployeeController.ts`, `SqliteEmployeeRepository.ts` | Acotar `limit` (máx. 100), validar que el restaurante existe. |
| shared | `contexts/shared/infrastructure/http/errorHandler.ts` | Añadir `OrderNotFoundError` a los 404, manejar `SyntaxError` de JSON como 400, registrar los 500. |
| routes | `routes/order.routes.ts`, `dish.routes.ts`, `ingredient.routes.ts`, `restaurant.routes.ts` | Añadir `authorize` por rol y `authorizeRestaurant`. |
| controllers | `controllers/order.controller.ts`, `dish.controller.ts`, `ingredient.controller.ts`, `restaurant.controller.ts` | Pasar `restaurantId` y `user` al servicio. Usar `next(error)` en lugar de `error.message`. DTO público de restaurante. |
| services | `services/order.service.ts`, `dish.service.ts`, `ingredient.service.ts`, `restaurant.service.ts` | Validación de entrada, comprobación de pertenencia al restaurante, máquina de estados de ítems, transacción en `create`. |
| repositories | `repositories/order.repository.ts`, `dish.repository.ts`, `ingredient.repository.ts` | Métodos `findByIdAndRestaurant`, y transacción en la creación de pedidos. |
| app | `src/app.ts`, `src/server.ts` | `helmet`, `x-powered-by` desactivado, CORS con lista blanca, `express-rate-limit` en `/auth`, `dotenv`. |
| scripts | `src/scripts/seed.ts`, `.gitignore` | Bloquear el seed en producción, ignorar `*.db`. |
| frontend | `web-shared/src/lib/auth/auth.store.ts`, `auth.guard.ts`, `http/auth.interceptor.ts`, `http/error.interceptor.ts` | `try/catch` en `JSON.parse`, comprobar `exp`, filtrar el Bearer por prefijo de la API, tratar 401 y 403. |
| frontend | `web-empleados/src/app/app.routes.ts`, `core/layout/shell.component.ts` | `roleGuard` funcional con `data.roles`. |
| frontend | `web-empleados/.../order.store.ts`, `index.html` | Mensajes de error genéricos, meta CSP. |
| raíz | `package.json`, `package-lock.json` | Actualizaciones de `npm audit`. |

## 4. Diseño

El trabajo se divide en cuatro fases, en el orden recomendado por la auditoría.

### Fase 1: críticos (S-03, S-01, S-02)

- **Configuración central** (`config/env.ts`): exporta `JWT_SECRET`. En `NODE_ENV=production`, si falta o es `super-secret-resttek-key`, lanza un error y la API no arranca. En desarrollo y test mantiene un valor por defecto, con un `console.warn`. `server.ts` importa `dotenv/config` antes que nada.
- **`authorizeRestaurant`**: middleware en `middlewares.ts` para rutas con `:restaurantId`. Deja pasar si `user.role === 'admin'` o `user.restaurantId === req.params.restaurantId`. Si no, responde 403 `Forbidden: Insufficient permissions`.
- **Rutas de platos e ingredientes**: `authorize([...])` y después `authorizeRestaurant`. Los servicios y repositorios buscan por `(id, restaurantId)`. Si el recurso no pertenece al restaurante, devuelven 404, no 403, para no confirmar su existencia.
- **`GET /restaurants/:id`**: exige rol y restaurante, con el mismo middleware. Los clientes siguen usando `/public/restaurants`.
- **Pedidos**:
  - `GET /orders/active`: `authorize(['admin','manager','camarero','cocinero'])`. El `restaurantId` se deriva de `req.user` y el query param solo se acepta para `admin`. Con esto se resuelve H-05.
  - `PATCH /orders/:orderId/items/:itemId/status`: mismos roles, y el pedido debe ser del restaurante del usuario.
  - `GET /orders/:id`: permitido si `order.clientId === user.id` o si el usuario es personal del mismo restaurante (`admin` ve todos).

### Fase 2: autenticación y validación (S-04, S-05, S-06)

- **Rate limiting**: `express-rate-limit` sobre `/api/v1/auth` (p. ej. 10 intentos por 15 min por IP en login, y límite propio en registro).
- **Contraseñas**: mínimo 10 caracteres, y no puede ser igual al email. Se aplica en `Employee.create` o en un value object `Password`, con error de dominio nuevo `WeakPasswordError` (400). El email se normaliza con `trim().toLowerCase()` en el value object `Email`.
- **Pedidos**:
  - `items` debe ser un array no vacío con un máximo de 50 elementos.
  - `quantity` es un entero entre 1 y 20.
  - `notes` tiene un máximo de 200 caracteres.
  - Cada `dishId` debe existir, estar disponible y pertenecer al `restaurantId` del pedido, y el restaurante debe existir.
  - La creación del pedido y de sus ítems va en una transacción, sin devolver `error.message`.

### Fase 3: configuración, dependencias y frontend (S-09, S-10/H-01, S-08, H-04)

- `helmet()`, `app.disable('x-powered-by')`, CORS con `CORS_ORIGINS` (lista separada por comas; en desarrollo `http://localhost:4200-4202`), `express.json({ limit: '100kb' })`.
- JWT: `expiresIn` de 1 h (valor configurable), con `algorithms: ['HS256']`, `issuer: 'resttek'` y `audience: 'resttek-web'`. `authenticate` revalida contra la BD que el empleado sigue existiendo (con su rol y `restaurantId` actuales) para cubrir despidos y degradaciones.
- Dependencias: `npm audit fix` y actualización de `@angular/*` y `vite` dentro de 21.x. Evaluar `sqlite3@6` aparte, por ser un cambio incompatible.
- `roleGuard` funcional que lee `route.data['roles']` y redirige si no coincide. Se aplica a `/cocina`, `/barra` y `/salon`.

### Fase 4: resto (S-07, S-11 a S-17, H-02, H-03, H-06 a H-10)

- `listEmployees`: `limit` máximo 100. `POST /employees` valida que el restaurante exista.
- Login: bcrypt contra un hash ficticio si el email no existe, para igualar los tiempos.
- DTO público de restaurante con `id`, `name`, `address` y `logoUrl`.
- Controladores de pedidos con `next(error)` y `errorHandler` unificado. Logger estructurado para login ok/ko, 401, 403 y 500.
- Validación de tipos con `Number.isFinite` en `price` y `currentStock`. `logoUrl` solo con `https:` mediante `new URL()`.
- Máquina de estados de ítem: `pendiente → preparando → listo → entregado`, sin retrocesos.
- Seed bloqueado en producción y `*.db` en `.gitignore`.
- Frontend: `JSON.parse` con `try/catch`. Comprobación de `exp` en el store y el guard. Interceptor de error que limpia sesión en 401 y maneja el 403. Bearer solo hacia `/api/`. Mensajes de error por código de estado. Meta CSP en `index.html`. `npm ci` y `npm audit` documentados para CI.

Las validaciones de la Fase 2 y 4 se implementan con funciones propias en los servicios (los frontends y la API no usan librería de esquemas hoy). Ver dudas abiertas sobre dependencias nuevas.

## 5. Lista de tareas

> Cada tarea debe poder completarse en 5-10 minutos. Si una es mayor, se divide.

### Fase 1: críticos

> T1 a T11 se implementaron y verificaron antes de adoptar el flujo TDD con un commit por tarea (80 tests y 21 comprobaciones HTTP en verde). Van en el commit inicial del repositorio. El flujo TDD estricto empieza en T12.

- [x] **T1** (~10 min) — Crear el módulo de configuración con `JWT_SECRET`, que aborta en producción si falta o es el valor antiguo · `packages/api/src/config/env.ts`
- [x] **T2** (~5 min) — Sustituir la constante duplicada por el import de `env.ts` en `middlewares.ts` y `BcryptAuthService.ts`, y cargar `dotenv/config` al inicio de `server.ts` · `packages/api/src/contexts/shared/infrastructure/http/middlewares.ts`, `packages/api/src/contexts/employee/infrastructure/BcryptAuthService.ts`, `packages/api/src/server.ts`
- [x] **T3** (~5 min) — Tipar `req.user` (`id`, `role`, `restaurantId`) en `AuthRequest`, sustituyendo `any` · `middlewares.ts`
- [x] **T4** (~10 min) — Añadir el middleware `authorizeRestaurant` (admin o `restaurantId` coincidente, si no 403) y su test · `middlewares.ts`, `middlewares.test.ts`
- [x] **T5** (~10 min) — Añadir `findByIdAndRestaurant` y `deleteByIdAndRestaurant` en los repositorios de platos e ingredientes, y en sus mocks · `repositories/dish.repository.ts`, `repositories/ingredient.repository.ts`, `repositories/mocks/`
- [x] **T6** (~10 min) — Hacer que los servicios de platos e ingredientes busquen y modifiquen por `(id, restaurantId)` y devuelvan el error de no encontrado si no coincide, con tests · `services/dish.service.ts`, `services/ingredient.service.ts`
- [x] **T7** (~10 min) — Pasar `req.params.restaurantId` desde los controladores de platos e ingredientes a los métodos `getById`, `update` y `delete` del servicio · `controllers/dish.controller.ts`, `controllers/ingredient.controller.ts`
- [x] **T8** (~5 min) — Añadir `authorizeRestaurant` a las rutas de platos e ingredientes y `authorize` + `authorizeRestaurant` a `GET /restaurants/:id` · `routes/dish.routes.ts`, `routes/ingredient.routes.ts`, `routes/restaurant.routes.ts`
- [x] **T9** (~10 min) — Restringir `GET /orders/active` y `PATCH …/status` a roles de personal, derivando `restaurantId` de `req.user` (el query param solo para admin) · `routes/order.routes.ts`, `controllers/order.controller.ts`
- [x] **T10** (~10 min) — Comprobar en `order.service.ts` que el pedido pertenece al restaurante del usuario al cambiar el estado de un ítem, con tests · `services/order.service.ts`, `services/order.service.test.ts`
- [x] **T11** (~10 min) — Restringir `GET /orders/:id` al cliente propietario o al personal del mismo restaurante, con tests · `controllers/order.controller.ts`, `services/order.service.ts`

### Fase 2: autenticación y validación

- [x] **T12** (~5 min) — Instalar `express-rate-limit` y aplicarlo a `/api/v1/auth` (login y registro con límites distintos) · `packages/api/package.json`, `src/app.ts`
- [x] **T13** (~10 min) — Crear `WeakPasswordError` (400) en `DomainErrors.ts` y su traducción en `errorHandler` · `src/errors/DomainErrors.ts`, `errorHandler.ts`
- [x] **T14** (~10 min) — Validar la contraseña (mín. 10 caracteres, distinta del email) y normalizar el email en `Email` con `trim().toLowerCase()`, con tests · `contexts/shared/domain/Email.ts`, `contexts/employee/application/RegisterClientUseCase.ts`, `CreateEmployeeUseCase.ts`
- [x] **T15** (~10 min) — Validar `items` (array de 1 a 50), `quantity` (entero de 1 a 20) y `notes` (máx. 200 caracteres) en la creación de pedidos, con tests · `services/order.service.ts`
- [x] **T16** (~10 min) — Validar que el restaurante existe y que cada `dishId` pertenece al restaurante y está disponible al crear el pedido · `services/order.service.ts`, `repositories/dish.repository.ts`
- [x] **T17** (~10 min) — Insertar el pedido y sus ítems en una transacción SQLite en el repositorio de pedidos · `repositories/order.repository.ts`
- [ ] **T18** (~5 min) — Reemplazar el `catch` con `error.message` por `next(error)` en `createOrder` y `updateItemStatus` · `controllers/order.controller.ts`

### Fase 3: configuración, dependencias y frontend

- [ ] **T19** (~5 min) — Instalar `helmet` y aplicarlo, desactivar `x-powered-by` y fijar el límite de `express.json` en 100 kb · `packages/api/package.json`, `src/app.ts`
- [ ] **T20** (~10 min) — Configurar CORS con lista blanca desde `CORS_ORIGINS` (por defecto los puertos 4200-4202 en desarrollo) · `src/config/env.ts`, `src/app.ts`
- [ ] **T21** (~10 min) — Firmar el JWT con `issuer`, `audience` y `expiresIn` configurable (por defecto 1 h), y verificarlo con `algorithms: ['HS256']`, `issuer` y `audience` · `BcryptAuthService.ts`, `middlewares.ts`
- [ ] **T22** (~10 min) — Revalidar en `authenticate` que el empleado existe y usar su rol y `restaurantId` actuales, con test de empleado eliminado · `middlewares.ts`
- [ ] **T23** (~10 min) — Ejecutar `npm audit fix`, actualizar `@angular/*` y `vite` dentro de 21.x, y confirmar que compilan los tres frontends y pasan los tests de la API · `package.json`, `package-lock.json`
- [ ] **T24** (~10 min) — Crear `roleGuard` funcional que lea `route.data['roles']` y redirija si no coincide · `packages/web-shared/src/lib/auth/role.guard.ts`, `packages/web-shared/src/index.ts`
- [ ] **T25** (~5 min) — Aplicar `roleGuard` con los roles permitidos a `/cocina`, `/barra` y `/salon` · `packages/web-empleados/src/app/app.routes.ts`
- [ ] **T26** (~10 min) — Dejar de enviar `restaurantId` desde el cliente en las consultas de pedidos activos, ya que la API lo deriva del token · `web-empleados/src/app/features/orders/services/order.service.ts`, páginas `cocina`, `barra` y `salon`

### Fase 4: resto

- [ ] **T27** (~5 min) — Acotar `limit` de `listEmployees` a un máximo de 100 · `EmployeeController.ts`, `SqliteEmployeeRepository.ts`
- [ ] **T28** (~10 min) — Validar que el restaurante existe en `POST /employees` y en el alta de empleados de un restaurante · `CreateEmployeeUseCase.ts`
- [ ] **T29** (~5 min) — Ejecutar siempre una comparación bcrypt contra un hash ficticio cuando el email no existe en login · `LoginUseCase.ts`
- [ ] **T30** (~10 min) — Devolver un DTO público (`id`, `name`, `address`, `logoUrl`) en `/public/restaurants`, sin email, teléfono ni propietario · `controllers/restaurant.controller.ts`
- [ ] **T31** (~10 min) — Añadir `OrderNotFoundError` a los 404 del `errorHandler`, tratar `SyntaxError` de JSON como 400 y registrar los 500 · `errorHandler.ts`
- [ ] **T32** (~10 min) — Validar `price` y `currentStock` con `Number.isFinite`, longitud de `name` y que los ingredientes sean un array del mismo restaurante · `services/dish.service.ts`, `services/ingredient.service.ts`
- [ ] **T33** (~5 min) — Validar `logoUrl` con `new URL()` aceptando solo `https:` · `services/restaurant.service.ts`
- [ ] **T34** (~10 min) — Instalar `pino` y registrar login ok/ko, respuestas 401/403 y altas de empleados · `packages/api/package.json`, `src/app.ts`, `middlewares.ts`, `LoginUseCase.ts`
- [ ] **T35** (~10 min) — Implementar la máquina de estados de ítems (`pendiente → preparando → listo → entregado`) rechazando transiciones inválidas, con tests · `services/order.service.ts`
- [ ] **T36** (~5 min) — Bloquear el seed si `NODE_ENV=production` y añadir `*.db` a `.gitignore` · `src/scripts/seed.ts`, `.gitignore`
- [ ] **T37** (~5 min) — Envolver `JSON.parse` de `auth_user` en `try/catch` y tipar el usuario · `packages/web-shared/src/lib/auth/auth.store.ts`
- [ ] **T38** (~10 min) — Comprobar `exp` del JWT en el store y en `authGuard`, limpiando la sesión si caducó · `auth.store.ts`, `auth.guard.ts`
- [ ] **T39** (~10 min) — Reescribir `error.interceptor.ts`: limpiar sesión siempre en 401, tratar el 403, y proteger con `isRedirecting` solo la navegación · `packages/web-shared/src/lib/http/error.interceptor.ts`
- [ ] **T40** (~5 min) — Enviar el Bearer solo a URLs que empiecen por el prefijo de la API · `packages/web-shared/src/lib/http/auth.interceptor.ts`
- [ ] **T41** (~10 min) — Mostrar mensajes genéricos según el código HTTP en `OrderStore` en lugar de `err.message` · `web-empleados/src/app/features/orders/store/order.store.ts`
- [ ] **T42** (~5 min) — Añadir una meta CSP (`default-src 'self'`) a `index.html` · `packages/web-empleados/src/index.html`
- [ ] **T43** (~10 min) — Actualizar `CLAUDE.md` (secreto JWT obligatorio en producción, `CORS_ORIGINS`, autorización por restaurante, contraseña mínima del seed, `npm ci`) y crear `docs/arquitectura/seguridad.md` · `CLAUDE.md`, `docs/arquitectura/seguridad.md`

## 6. Verificación

- [x] `NODE_ENV=production` sin `JWT_SECRET`: la API no arranca y muestra un error claro.
- [ ] Token firmado con `super-secret-resttek-key` y rol `admin`: `GET /api/v1/employees` devuelve 401.
- [x] `manager` del restaurante A: `PUT /api/v1/restaurants/<B>/dishes/<id>` devuelve 403, y `DELETE` de un plato de B bajo la URL de A devuelve 404.
- [x] `cliente`: `GET /api/v1/orders/active` devuelve 403, y `GET /api/v1/orders/<pedido ajeno>` devuelve 403 o 404.
- [x] `camarero` del restaurante A: `PATCH` del estado de un ítem del restaurante B devuelve 403 o 404.
- [ ] 11 `POST /api/v1/auth/login` seguidos desde una IP: el último devuelve 429.
- [ ] `POST /auth/register` con contraseña `1` devuelve 400, y con `Admin@resttek.com` ya existente como `admin@resttek.com` devuelve 400 de email duplicado.
- [ ] `POST /orders` con `quantity: 1000000`, con un plato de otro restaurante o con `items: "x"` devuelve 400.
- [ ] `GET /api/v1/employees?limit=99999999` devuelve como máximo 100 empleados.
- [ ] `GET /api/v1/public/restaurants` no incluye `email`, `phone` ni datos del propietario.
- [ ] Las respuestas incluyen las cabeceras de `helmet` y no incluyen `X-Powered-By`.
- [ ] Un navegador desde un origen no permitido recibe un error CORS.
- [ ] `npm test` pasa y `npm audit` no muestra críticas en dependencias de producción.
- [ ] Frontend: un `camarero` que escribe `/cocina` es redirigido, un token caducado en `localStorage` lleva a `/login` y un `auth_user` corrupto no deja la app en blanco.
- [ ] Frontend: un fallo 500 muestra un mensaje genérico, sin URL de la API.

## 7. Riesgos y dudas abiertas

- **Dependencias nuevas**: el plan añade `helmet`, `express-rate-limit` y `pino`, y la skill indica no usar dependencias externas para SQLite. Hay que confirmar si se aceptan para la capa HTTP o si se prefiere una implementación propia.
- **Contraseñas del seed**: con una política mínima de 10 caracteres y distinta del email, las credenciales de seed (`<email>` como contraseña) dejan de cumplir. Hay que decidir entre cambiar el seed (y la nota de `CLAUDE.md`) o aplicar la política solo en registro y altas.
- **S-08 y H-02**: no se implementa un refresh token revocable ni la cookie `HttpOnly`. Habría que decidirlo aparte, porque afecta a los cuatro frontends.
- **Compatibilidad del frontend**: T9 y T26 cambian el contrato de `GET /orders/active`. Deben desplegarse juntos, o la API debe seguir aceptando el parámetro para `admin`.
- **Rotación del secreto**: al fijar `issuer` y `audience` (T21), los tokens emitidos antes quedan invalidados y los usuarios deben volver a iniciar sesión.
- **Actualización de dependencias**: `npm audit fix` puede introducir cambios incompatibles en Angular o `sqlite3@6`. Se debe compilar y probar tras T23.
- **docs/api/api-pagination.md** no existe en el repositorio, así que no se pudo consultar para T27.
- **Dev server**: los avisos de `vite` solo afectan al servidor de desarrollo. No exponerlo fuera de localhost.
