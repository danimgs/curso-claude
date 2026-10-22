# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Resttek: plataforma de gestión de restaurantes. Monorepo con npm workspaces (`packages/*`): una API Express 5 + TypeScript + SQLite (`api`) y tres apps Angular 21 (`web-admin`, `web-empleados`, `web-clientes`) más una librería compartida (`web-shared`). La documentación del proyecto está en español, en `docs/` (arquitectura, dominio y `revisiones/` con inconsistencias conocidas entre docs y código).

## Comandos

Todo se ejecuta desde la raíz:

```bash
npm install                # un solo install para todos los workspaces
npm run seed               # datos de prueba (idempotente, INSERT OR IGNORE)
npm run dev:api            # API en :3000 (tsx watch); /health para comprobar
npm run dev:admin          # :4200
npm run dev:empleados      # :4201
npm run dev:clientes       # :4202
npm test                   # vitest run de api y web-shared
```

Test individual (desde `packages/api`):

```bash
npx vitest run src/services/order.service.test.ts
npx vitest run -t "nombre del test"
npm run test:watch
```

- Los frontends no tienen script de test ni de lint; solo `start`, `build` y `watch` (`ng`). Hacen proxy de `/api` a `localhost:3000`. Los únicos tests de frontend están en `web-shared` (vitest en Node, sin DOM): `npm test -w @resttek/web-shared`.
- `@angular/build` está fijado a `21.2.6` en las tres apps: desde la 21.2.27 exige que los assets estén dentro del workspace root y las apps cargan `../web-shared/src/lib/assets`. Para subirlo hay que mover esos assets. Instalar con `npm ci`.
- Tras cambiar `web-shared` hay que reiniciar el servidor de desarrollo del frontend (Angular no detecta cambios en él).
- Credenciales de seed: la contraseña de cada usuario es su propio email (p. ej. `admin@resttek.com`). El seed se niega a ejecutarse con `NODE_ENV=production`. Esas contraseñas no cumplen la política de registro (mínimo 10 caracteres, distinta del email) porque el seed hashea directamente; sirven solo para desarrollo.

## Arquitectura de la API (`packages/api`)

Conviven **dos estilos**; identifica cuál aplica antes de editar:

1. **Hexagonal + DDD, solo el contexto `employee`** (`src/contexts/employee/{domain,application,infrastructure}`). `Employee` es la única entidad de dominio real (constructor privado + `create()`, getters, value objects `Email` y `Role`). Casos de uso en `application/` con mocks en `application/mocks/`. `src/contexts/shared/` contiene `Email`, middlewares (auth JWT, `authorize()`) y `errorHandler`.
2. **Por capas, para `restaurant`, `dish`, `ingredient`, `order`, `table`**: `models/` (interfaces planas) → `repositories/` (interfaz + SQLite, mocks en `repositories/mocks/`) → `services/` (lógica y validación) → `controllers/` → `routes/` (composición de dependencias). Un fichero por dominio en cada carpeta.

Detalles que requieren leer varios ficheros:
- Los routers se montan en `src/app.ts` bajo `/api/v1/...`; hay rutas públicas (`/api/v1/public/restaurants[/:id/dishes]` y `/api/v1/public/restaurants/:id/tables?partySize=`) y rutas anidadas por restaurante.
- Alias de importación definidos en `tsconfig.json` (`@employee/*`, `@shared/*`, `@services/*`, `@routes/*`, etc.); Vitest los resuelve con `vite-tsconfig-paths`. Módulos ESM: los imports llevan extensión `.js`.
- tsconfig muy estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- Errores: `src/errors/AppError.ts` y `DomainErrors.ts`, traducidos a HTTP por `errorHandler`.
- Seguridad (detalle en `docs/arquitectura/seguridad.md`): `JWT_SECRET` se lee solo en `config/env.ts`; en producción es obligatorio y la API no arranca sin él ni con el valor de desarrollo. El JWT es HS256 con `issuer`/`audience` y dura 1 h (`JWT_EXPIRES_IN_SECONDS`). `authenticate` revalida el empleado en la BD en cada petición y toma de ahí el rol y el `restaurantId`. `authorizeRestaurant` limita las rutas con `:restaurantId` al admin o al personal de ese restaurante; un recurso de otro restaurante se trata como inexistente (404). CORS usa la lista `CORS_ORIGINS` (separada por comas; por defecto los puertos 4200-4202 en desarrollo y ninguno en producción). Los logs son JSON con pino (`LOG_LEVEL`).
- La BD se elige por `NODE_ENV` en `config/database.ts`; las tablas se crean al arrancar. El fichero `resttek.db` vive en `packages/api`.
- Los clientes **son `Employee`** con `role = 'cliente'` y `restaurant_id = null` (no hay tabla de clientes; login y registro usan el mismo modelo).
- Al crear un pedido, **cada unidad es un `OrderItem`** con `quantity: 1`, para que cocina marque el estado por unidad.
- **Mesas** (`table`, contrato en `docs/api/openapi-mesas.yaml`): estados `libre`/`ocupada`/`reservada`. El admin hace el CRUD; admin, manager y camarero ven y cambian el estado (el cocinero no). `POST /restaurants/:restaurantId/tables/:id/occupy` es solo para `cliente` y **no usa `authorizeRestaurant`** (el cliente no tiene restaurante): un `UPDATE ... AND status = 'libre'` comprueba el restaurante y evita que dos clientes ocupen la misma mesa. Un pedido con `tableId` exige que la mesa sea del restaurante y esté `ocupada` (404 / 409); `orders.table_id` no tiene FK. La mesa no se libera sola: la libera el personal. Flujo de `web-clientes`: restaurante → número de personas → mesa libre → "Continuar" (ocupa la mesa) → carta → pedido con `tableId`.
- `errorHandler` traduce a 409 los nombres de `CONFLICT_ERRORS` (errores de mesas). Los errores de dominio responden `{ error, message }`; los 401/403 de los middlewares solo `{ error }`.
- El filtrado por rol en los frontends es solo de navegación (`roleGuard`, menús); la autorización real está en `authorize()` y `authorizeRestaurant` de la API. `GET /orders/active` deduce el restaurante del token: el cliente no envía `restaurantId`.

## Arquitectura del frontend

- Angular 21: standalone components, signals, zoneless (sin `zone.js`), guards/interceptors funcionales. RxJS solo para HTTP.
- `@resttek/web-shared` (importado directamente desde `src/index.ts`, sin build) aporta auth (service, store, guard), interceptores `auth`/`error`, componentes login/register y tokens.
- **`web-admin` y `web-empleados`**: `core/layout` + `features/<feature>/{models,pages,services,store}` con rutas lazy. Patrón Store: servicio `providedIn: 'root'` con signals privadas expuestas con `asReadonly()`, que convierte el Observable del service con `firstValueFrom` y mantiene `loading`/`error`; tras crear/actualizar usa `.update()` en vez de recargar. Los componentes hablan solo con el store. `OrderStore` de `web-empleados` hace polling cada 30 s.
- **`web-clientes`** es distinta: modelos y servicios centralizados en `core/`, componente raíz `App` (no `AppComponent`), y los componentes usan los services directamente con `.subscribe()`. El único store es `CartStore` (local, vacía el carrito al cambiar de restaurante). `my-orders` hace polling cada 10 s con `setInterval`.

## Otros

- `scripts/seed-issues.sh` crea issues en GitHub desde `scripts/issues.json` (requiere `gh` y `jq`); ver `scripts/README.md`.
- El directorio no es un repositorio git.
