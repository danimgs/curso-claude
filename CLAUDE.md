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
npm test                   # vitest run, solo del paquete api
```

Test individual (desde `packages/api`):

```bash
npx vitest run src/services/order.service.test.ts
npx vitest run -t "nombre del test"
npm run test:watch
```

- Los frontends no tienen script de test ni de lint; solo `start`, `build` y `watch` (`ng`). Hacen proxy de `/api` a `localhost:3000`.
- Tras cambiar `web-shared` hay que reiniciar el servidor de desarrollo del frontend (Angular no detecta cambios en él).
- Credenciales de seed: la contraseña de cada usuario es su propio email (p. ej. `admin@resttek.com`).

## Arquitectura de la API (`packages/api`)

Conviven **dos estilos**; identifica cuál aplica antes de editar:

1. **Hexagonal + DDD, solo el contexto `employee`** (`src/contexts/employee/{domain,application,infrastructure}`). `Employee` es la única entidad de dominio real (constructor privado + `create()`, getters, value objects `Email` y `Role`). Casos de uso en `application/` con mocks en `application/mocks/`. `src/contexts/shared/` contiene `Email`, middlewares (auth JWT, `authorize()`) y `errorHandler`.
2. **Por capas, para `restaurant`, `dish`, `ingredient`, `order`**: `models/` (interfaces planas) → `repositories/` (interfaz + SQLite, mocks en `repositories/mocks/`) → `services/` (lógica y validación) → `controllers/` → `routes/` (composición de dependencias). Un fichero por dominio en cada carpeta.

Detalles que requieren leer varios ficheros:
- Los routers se montan en `src/app.ts` bajo `/api/v1/...`; hay rutas públicas (`/api/v1/public/restaurants[/:id/dishes]`) y rutas anidadas por restaurante.
- Alias de importación definidos en `tsconfig.json` (`@employee/*`, `@shared/*`, `@services/*`, `@routes/*`, etc.); Vitest los resuelve con `vite-tsconfig-paths`. Módulos ESM: los imports llevan extensión `.js`.
- tsconfig muy estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- Errores: `src/errors/AppError.ts` y `DomainErrors.ts`, traducidos a HTTP por `errorHandler`.
- JWT con `JWT_SECRET` (por defecto `super-secret-resttek-key`, definido por duplicado en `BcryptAuthService.ts` y `middlewares.ts`). La BD se elige por `NODE_ENV` en `config/database.ts`; las tablas se crean al arrancar. El fichero `resttek.db` vive en `packages/api`.
- Los clientes **son `Employee`** con `role = 'cliente'` y `restaurant_id = null` (no hay tabla de clientes; login y registro usan el mismo modelo).
- Al crear un pedido, **cada unidad es un `OrderItem`** con `quantity: 1`, para que cocina marque el estado por unidad.
- El filtrado por rol en los frontends es solo de navegación; la autorización real está en `authorize()` de la API.

## Arquitectura del frontend

- Angular 21: standalone components, signals, zoneless (sin `zone.js`), guards/interceptors funcionales. RxJS solo para HTTP.
- `@resttek/web-shared` (importado directamente desde `src/index.ts`, sin build) aporta auth (service, store, guard), interceptores `auth`/`error`, componentes login/register y tokens.
- **`web-admin` y `web-empleados`**: `core/layout` + `features/<feature>/{models,pages,services,store}` con rutas lazy. Patrón Store: servicio `providedIn: 'root'` con signals privadas expuestas con `asReadonly()`, que convierte el Observable del service con `firstValueFrom` y mantiene `loading`/`error`; tras crear/actualizar usa `.update()` en vez de recargar. Los componentes hablan solo con el store. `OrderStore` de `web-empleados` hace polling cada 30 s.
- **`web-clientes`** es distinta: modelos y servicios centralizados en `core/`, componente raíz `App` (no `AppComponent`), y los componentes usan los services directamente con `.subscribe()`. El único store es `CartStore` (local, vacía el carrito al cambiar de restaurante). `my-orders` hace polling cada 10 s con `setInterval`.

## Otros

- `scripts/seed-issues.sh` crea issues en GitHub desde `scripts/issues.json` (requiere `gh` y `jq`); ver `scripts/README.md`.
- El directorio no es un repositorio git.
