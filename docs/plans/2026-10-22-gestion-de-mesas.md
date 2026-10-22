# Plan: Gestión de mesas

- **Issue**: #5 — https://github.com/danimgs/curso-claude/issues/5
- **Tipo**: funcionalidad
- **Fecha**: 2026-10-22
- **Estado**: pendiente

## 1. Contexto

Hoy los pedidos tienen una columna `orders.table_id` (TEXT, opcional, sin clave foránea) que `web-clientes` siempre envía como `null` (`core/services/order.service.ts`). No existe ninguna entidad "mesa".

La issue pide:

1. **Clientes (`web-clientes`)**: al elegir restaurante, indicar el número de personas, ver las mesas **libres** con capacidad suficiente, elegir una y, al pulsar "Continuar", la mesa pasa a **ocupada** y se navega a la carta para enviar el pedido (que queda asociado a esa mesa).
2. **Administrador (`web-admin`)**: CRUD de mesas por restaurante. Campos: id, número, descripción, capacidad y estado (`libre`, `ocupada`, `reservada`).
3. **Empleados (`web-empleados`)**: ver el estado de las mesas, cambiarlo y ver el estado de los pedidos de las mesas ocupadas.

## 2. Alcance

### Incluido

- Tabla SQLite `tables` y dominio `table` por capas (model → repository + mock → service → controller → routes), siguiendo el patrón de `ingredient`.
- CRUD de mesas para el admin bajo `/api/v1/restaurants/:restaurantId/tables`.
- Cambio de estado por el personal (`PATCH /:id/status`).
- Listado público de mesas libres filtrado por número de personas y endpoint para que un cliente ocupe una mesa de forma atómica.
- Validación en `OrderService.create` de que `tableId`, si se envía, es una mesa del restaurante y está `ocupada`.
- Seed con mesas de ejemplo y el pedido de prueba apuntando a una mesa real.
- `web-admin`: feature `tables` (lista + formulario) y acceso desde el dashboard del restaurante.
- `web-empleados`: página `mesas` con estados editables y pedidos activos de cada mesa ocupada.
- `web-clientes`: página de selección de mesa, carrito con mesa y envío de `tableId` en el pedido.
- Documentación en `docs/` y `CLAUDE.md`.

### Fuera de alcance

- Liberar la mesa automáticamente al entregar/pagar el pedido: **la libera a mano el camarero o el gerente** (o el admin).
- Expiración de mesas ocupadas sin pedido: **la mesa sigue ocupada hasta que la libere el personal**.
- Sistema de reservas con fecha/hora (el estado `reservada` solo lo fija el personal o el admin).
- Unir mesas para grupos que no caben en ninguna: **no se juntan mesas**.
- Paginación de listados.
- Clave foránea en `orders.table_id` (la tabla ya existe y `CREATE TABLE IF NOT EXISTS` no la altera; ver riesgos).

## 3. Análisis del código afectado

| Capa | Archivo | Cambio necesario |
| ---- | ------- | ---------------- |
| config | `packages/api/src/config/database.ts` | Añadir `CREATE TABLE IF NOT EXISTS tables` en `runInitialMigrations()` |
| models | `packages/api/src/models/table.model.ts` (nuevo) | Interfaz `Table`, `TableStatusType` y `normalizeTableStatus()` |
| errors | `packages/api/src/errors/DomainErrors.ts` | `TableNotFoundError`, `InvalidTableStatusError`, `InvalidTableNumberError`, `InvalidCapacityError`, `InvalidTableDescriptionError`, `DuplicatedTableNumberError`, `TableNotAvailableError`, `TableOccupiedError`, `TableNotOccupiedError`, `InvalidPartySizeError` |
| errors | `packages/api/src/contexts/shared/infrastructure/http/errorHandler.ts` | `TableNotFoundError` en `NOT_FOUND_ERRORS`; nueva lista `CONFLICT_ERRORS` → 409 |
| repositories | `packages/api/src/repositories/table.repository.ts` (nuevo) | Interfaz `TableRepository` + `SqliteTableRepository` |
| repositories | `packages/api/src/repositories/mocks/MockTableRepository.ts` (nuevo) | Mock en memoria |
| services | `packages/api/src/services/table.service.ts` (+ `.test.ts`) (nuevo) | Validación, CRUD, cambio de estado, mesas disponibles, ocupar |
| services | `packages/api/src/services/order.service.ts` (+ tests) | Recibir `TableRepository` y validar `tableId` |
| controllers | `packages/api/src/controllers/table.controller.ts` (nuevo) | Handlers HTTP y `toJSON` |
| routes | `packages/api/src/routes/table.routes.ts`, `table.public.routes.ts` (nuevos), `order.routes.ts` | Composición y permisos |
| app | `packages/api/src/app.ts` | Montar los routers |
| seed | `packages/api/src/scripts/seed.ts` | Mesas de ejemplo |
| web-admin | `src/app/features/tables/**` (nuevo), `app.routes.ts`, `restaurant-dashboard.component.ts` | CRUD de mesas |
| web-empleados | `src/app/features/tables/**` (nuevo), `app.routes.ts`, `core/layout/shell.component.ts` | Página `mesas` |
| web-clientes | `core/models/table.model.ts`, `core/services/table.service.ts`, `features/tables/table-selection.component.ts` (nuevos), `core/store/cart.store.ts`, `core/services/order.service.ts`, `features/cart/cart.component.ts`, `features/menu/restaurant-menu.component.ts`, `features/restaurants/restaurant-list.component.ts`, `app.routes.ts` | Flujo personas → mesa → carta |
| docs | `docs/dominio/modelo-datos.md`, `docs/dominio/glosario.md`, `docs/arquitectura/arquitectura-api.md`, `CLAUDE.md` | Documentar mesas |

## 4. Diseño

### Esquema SQLite

```sql
CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    description TEXT,
    capacity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'libre',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(restaurant_id, number),
    FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
);
```

Nombres de campo en inglés (como el resto del código: `currentStock`, `unit`…) y valores de dominio en español (como `pendiente`, `kg`).

### Modelo (`table.model.ts`)

```ts
const VALID_TABLE_STATUSES = ['libre', 'ocupada', 'reservada'] as const
export type TableStatusType = typeof VALID_TABLE_STATUSES[number]
export interface Table {
    id: string; restaurantId: string; number: number; description: string | null
    capacity: number; status: TableStatusType; createdAt: string; updatedAt: string
}
export function normalizeTableStatus(value: string): TableStatusType // lanza InvalidTableStatusError
```

### Validaciones (`TableService`)

- `number`: entero ≥ 1 → si no, `InvalidTableNumberError` ("El número de mesa debe ser un entero mayor que 0").
- `capacity`: entero entre 1 y 20 → si no, `InvalidCapacityError` ("La capacidad debe ser un entero entre 1 y 20").
- `description`: opcional (`null` si viene vacía), texto de máx. 200 caracteres → si no, `InvalidTableDescriptionError` ("La descripción debe tener como máximo 200 caracteres").
- `status`: `normalizeTableStatus()`; por defecto `libre` al crear.
- Número repetido en el mismo restaurante → `DuplicatedTableNumberError` (409, "Ya existe una mesa con ese número en el restaurante"). Se comprueba en el servicio con `findByRestaurantAndNumber()`.
- Recurso de otro restaurante → `TableNotFoundError` (404), como en `IngredientService`.
- Borrar una mesa `ocupada` → `TableOccupiedError` (409, "No se puede eliminar una mesa ocupada").
- Personas (`partySize`) para el listado de disponibles: entero entre 1 y 20 → si no, `InvalidPartySizeError` (400).
- Ocupar: `UPDATE tables SET status = 'ocupada', updated_at = ? WHERE id = ? AND restaurant_id = ? AND status = 'libre'`; si `changes === 0` y la mesa existe → `TableNotAvailableError` (409, "La mesa ya no está disponible"); si no existe → 404. El `UPDATE` condicional evita que dos clientes ocupen la misma mesa a la vez.

`errorHandler`: nueva lista `CONFLICT_ERRORS = ['DuplicatedTableNumberError', 'TableNotAvailableError', 'TableOccupiedError', 'TableNotOccupiedError']` → 409.

### Repositorio (`TableRepository`)

```ts
findById(id): Promise<Table | null>
findByRestaurantId(restaurantId): Promise<Table[]>          // ORDER BY number
findByRestaurantAndNumber(restaurantId, number): Promise<Table | null>
findAvailable(restaurantId, minCapacity): Promise<Table[]>  // status='libre' AND capacity >= ? ORDER BY capacity, number
save(table): Promise<void>                                   // insert/update como SqliteIngredientRepository
occupyIfFree(id, restaurantId, updatedAt): Promise<boolean>  // UPDATE condicional, devuelve changes > 0
delete(id): Promise<void>
```

### Endpoints

Router de personal/admin `table.routes.ts` montado en `/api/v1/restaurants/:restaurantId/tables` (`mergeParams: true`):

| Método | Ruta | Middlewares | Respuesta |
| ------ | ---- | ----------- | --------- |
| POST | `/` | `authenticate, authorizeRestaurant, authorize(['admin'])` | 201 + mesa |
| GET | `/` | `authenticate, authorizeRestaurant, authorize(['admin','manager','camarero'])` | 200 + lista |
| GET | `/:id` | ídem | 200 / 404 |
| PUT | `/:id` | `authenticate, authorizeRestaurant, authorize(['admin'])` | 200 / 400 / 404 / 409 |
| DELETE | `/:id` | ídem | 204 / 404 / 409 |
| PATCH | `/:id/status` | `authenticate, authorizeRestaurant, authorize(['admin','manager','camarero'])` | 200 + mesa / 400 / 404 |
| POST | `/:id/occupy` | `authenticate, authorize(['cliente'])` (sin `authorizeRestaurant`: el cliente tiene `restaurantId = null`) | 200 + mesa / 404 / 409 |

Router público `table.public.routes.ts` montado en `/api/v1/public/restaurants/:restaurantId/tables`:

| GET | `/?partySize=4` | sin auth (como `dish.public.routes.ts`) | 200 + `[{ id, number, description, capacity }]` solo de mesas `libre` con `capacity >= partySize`; 400 si `partySize` inválido |

Contrato de creación/edición (`POST`/`PUT`): `{ "number": 3, "description": "Terraza", "capacity": 4, "status": "libre" }` (`status` opcional en POST). `PATCH /status`: `{ "status": "reservada" }`. El personal puede pasar entre cualquier estado; el cliente solo `libre → ocupada` vía `occupy`.

Respuesta (`toJSON`): `{ id, restaurantId, number, description, capacity, status, createdAt, updatedAt }`.

### Pedidos

`OrderService` recibe un cuarto parámetro `tableRepository: TableRepository`. En `create()`, si `tableId !== null`: la mesa debe existir y pertenecer a `restaurantId` (si no, `TableNotFoundError`, 404) y su estado debe ser `ocupada` (si no, `TableNotOccupiedError`, 409, "La mesa no está ocupada"). Si el personal libera la mesa mientras el cliente sigue en la carta, su siguiente pedido se rechaza con 409 y `web-clientes` le devuelve a la selección de mesa.

### Decisiones confirmadas en la revisión

- La mesa la libera a mano el camarero o el gerente (`PATCH /:id/status`); también puede hacerlo el admin.
- Ven y cambian el estado de las mesas `admin`, `manager` y `camarero`; el `cocinero` no.
- Un pedido con mesa exige que la mesa esté `ocupada`.
- Una mesa ocupada sin pedido no caduca: sigue ocupada hasta que la libere el personal.
- No se juntan mesas para grupos grandes.
- Se borra `resttek.db` y se vuelve a ejecutar `npm run seed` para eliminar los pedidos antiguos con `table_id = '5'`. `GET /orders/active` ya devuelve `tableId`, así que `web-empleados` cruza pedidos y mesas en cliente sin cambios en la API.

### Frontends

- **web-admin**: `features/tables/{models,services,store,pages/table-list,pages/table-form}` + `tables.routes.ts` (`''`, `new`, `:id/edit`) copiando el patrón de `ingredients`. Ruta `restaurants/:restaurantId/tables` en `app.routes.ts`; enlace "Mesas" en `restaurant-dashboard.component.ts`. `TableStore` con signals privadas, `asReadonly()`, `firstValueFrom` y `.update()` tras crear/editar/borrar.
- **web-empleados**: `features/tables/{models,services,store,pages/mesas}`. `TableStore` (`loadTables`, `updateStatus`, polling 30 s como `OrderStore`). La página `mesas` muestra una tarjeta por mesa (número, capacidad, estado con `<select>` para cambiarlo) y, en las `ocupada`, los pedidos de `OrderStore.orders()` con `tableId === mesa.id` y el estado de cada ítem. Ruta `mesas` con `roleGuard` `['camarero', 'manager']` y enlace en el menú del shell. El `restaurantId` sale del usuario autenticado (`AuthStore`).
- **web-clientes**: nueva ruta `restaurants/:id/table` → `TableSelectionComponent` (input personas 1-20, botón "Buscar mesas", lista de mesas seleccionables, botón "Continuar"). Al continuar llama a `TableService.occupy()`, guarda la mesa en `CartStore.setTable(restaurantId, table)` y navega a `/restaurants/:id`. `restaurant-list` enlaza a `/restaurants/:id/table`. `restaurant-menu` redirige a la selección si `cartStore.table()` no es de ese restaurante y muestra "Mesa N". `CartStore`: signal `_table`, `setTable()`, se borra al cambiar de restaurante; `clear()` vacía ítems pero conserva la mesa (para poder pedir de nuevo). `OrderService.createOrder(restaurantId, tableId, items)` y `cart.component.ts` envía `cartStore.table()?.id`. Si `occupy` devuelve 409 se muestra "La mesa ya no está disponible" y se recarga la lista.

## 5. Lista de tareas

> Cada tarea debe poder completarse en 5-10 minutos. Si una es mayor, se divide.

**API**

- [ ] **T1** (~5 min) — Añadir `CREATE TABLE IF NOT EXISTS tables` (esquema de la sección 4) en `runInitialMigrations()` · `packages/api/src/config/database.ts`
- [ ] **T2** (~5 min) — Crear `Table`, `TableStatusType` y `normalizeTableStatus()` (lanza `InvalidTableStatusError`) · `packages/api/src/models/table.model.ts`
- [ ] **T3** (~5 min) — Añadir los errores `TableNotFoundError`, `InvalidTableStatusError`, `InvalidTableNumberError`, `InvalidCapacityError`, `InvalidTableDescriptionError`, `DuplicatedTableNumberError`, `TableNotAvailableError`, `TableOccupiedError`, `TableNotOccupiedError`, `InvalidPartySizeError` con mensajes en español · `packages/api/src/errors/DomainErrors.ts`
- [ ] **T4** (~5 min) — Registrar `TableNotFoundError` como 404 y crear `CONFLICT_ERRORS` → 409 · `packages/api/src/contexts/shared/infrastructure/http/errorHandler.ts`
- [ ] **T5** (~5 min) — Definir la interfaz `TableRepository` y crear `MockTableRepository` (incluido `occupyIfFree` y `findAvailable`) · `packages/api/src/repositories/table.repository.ts`, `packages/api/src/repositories/mocks/MockTableRepository.ts`
- [ ] **T6** (~10 min) — Implementar `SqliteTableRepository` (mapeo de filas, `save` insert/update, `findAvailable`, `occupyIfFree` con `UPDATE ... AND status = 'libre'`) · `packages/api/src/repositories/table.repository.ts`
- [ ] **T7** (~10 min) — TDD: tests de `TableService.create` (valores por defecto, número/capacidad/descripción/estado inválidos, número duplicado) e implementación de `create` + `buildTable` · `packages/api/src/services/table.service.ts`, `table.service.test.ts`
- [ ] **T8** (~10 min) — TDD: `update`, `delete` (404 si es de otro restaurante, 409 si está ocupada), `findById`, `findByRestaurantId` · `packages/api/src/services/table.service.ts`, `table.service.test.ts`
- [ ] **T9** (~10 min) — TDD: `updateStatus`, `findAvailable(restaurantId, partySize)` (valida `partySize`) y `occupy` (404 / 409 / ok) · `packages/api/src/services/table.service.ts`, `table.service.test.ts`
- [ ] **T10** (~10 min) — Crear `TableController` (`create`, `getAll`, `getById`, `update`, `delete`, `updateStatus`, `occupy`, `getAvailable`, `toJSON` y `toPublicJSON`) · `packages/api/src/controllers/table.controller.ts`
- [ ] **T11** (~10 min) — Crear `table.routes.ts` y `table.public.routes.ts` con los permisos de la sección 4 y montarlos en `app.ts` · `packages/api/src/routes/table.routes.ts`, `packages/api/src/routes/table.public.routes.ts`, `packages/api/src/app.ts`
- [ ] **T12** (~10 min) — TDD: inyectar `TableRepository` en `OrderService`, validar `tableId` en `create()` (`TableNotFoundError` si no existe o es de otro restaurante, `TableNotOccupiedError` si no está `ocupada`), actualizar los constructores en los tests existentes y en `order.routes.ts` · `packages/api/src/services/order.service.ts`, `order.service.create.test.ts`, `order.service.test.ts`, `packages/api/src/routes/order.routes.ts`
- [ ] **T13** (~5 min) — Añadir al seed 6 mesas en `rest-1` y 4 en `rest-2` (capacidades 2/4/6, la mesa 5 de `rest-1` `ocupada`) y usar el id real de esa mesa en el pedido de ejemplo en lugar de `'5'` · `packages/api/src/scripts/seed.ts`
- [ ] **T14** (~5 min) — Borrar `packages/api/resttek.db`, ejecutar `npm run seed`, `npm test` y las peticiones de la sección 6 contra `npm run dev:api` · —

**web-admin**

- [ ] **T15** (~5 min) — Crear el modelo `Table`/`TableStatus` y `TableService` (CRUD contra `/restaurants/:restaurantId/tables`) · `packages/web-admin/src/app/features/tables/models/table.model.ts`, `services/table.service.ts`
- [ ] **T16** (~10 min) — Crear `TableStore` (signals, `load`, `create`, `update`, `remove` con `.update()`) · `packages/web-admin/src/app/features/tables/store/table.store.ts`
- [ ] **T17** (~10 min) — Crear `TableListComponent` (tabla con número, descripción, capacidad, estado, editar y eliminar con confirmación) · `packages/web-admin/src/app/features/tables/pages/table-list/table-list.component.ts`
- [ ] **T18** (~10 min) — Crear `TableFormComponent` (alta/edición con validación: número ≥ 1, capacidad 1-20, descripción ≤ 200, estado) · `packages/web-admin/src/app/features/tables/pages/table-form/table-form.component.ts`
- [ ] **T19** (~5 min) — Crear `tables.routes.ts`, registrar `restaurants/:restaurantId/tables` y añadir el enlace "Mesas" en el dashboard del restaurante · `packages/web-admin/src/app/features/tables/tables.routes.ts`, `app.routes.ts`, `features/restaurants/pages/restaurant-dashboard/restaurant-dashboard.component.ts`

**web-empleados**

- [ ] **T20** (~10 min) — Crear modelo, `TableService` (`getTables`, `updateStatus`) y `TableStore` con polling 30 s · `packages/web-empleados/src/app/features/tables/{models,services,store}/`
- [ ] **T21** (~10 min) — Crear `MesasComponent`: tarjetas por mesa con estado y `<select>` para cambiarlo · `packages/web-empleados/src/app/features/tables/pages/mesas/mesas.component.ts`
- [ ] **T22** (~10 min) — Mostrar en las mesas ocupadas los pedidos activos de `OrderStore` con `tableId === mesa.id` y el estado de cada ítem (iniciar/parar polling de ambos stores) · `mesas.component.ts`
- [ ] **T23** (~5 min) — Añadir la ruta `mesas` (`roleGuard` camarero/manager) y el enlace en el menú del shell · `packages/web-empleados/src/app/app.routes.ts`, `core/layout/shell.component.ts`

**web-clientes**

- [ ] **T24** (~5 min) — Crear el modelo `Table` y `TableService` (`getAvailable(restaurantId, partySize)`, `occupy(restaurantId, tableId)`) · `packages/web-clientes/src/app/core/models/table.model.ts`, `core/services/table.service.ts`
- [ ] **T25** (~5 min) — Añadir `_table`, `table`, `setTable()` a `CartStore`; borrar la mesa al cambiar de restaurante y conservarla en `clear()` · `packages/web-clientes/src/app/core/store/cart.store.ts`
- [ ] **T26** (~10 min) — Crear `TableSelectionComponent` (personas, buscar, seleccionar, "Continuar" → `occupy`, manejo de 409 y lista vacía "No hay mesas libres para N personas") · `packages/web-clientes/src/app/features/tables/table-selection.component.ts`
- [ ] **T27** (~5 min) — Registrar la ruta `restaurants/:id/table` y enlazarla desde `restaurant-list` · `packages/web-clientes/src/app/app.routes.ts`, `features/restaurants/restaurant-list.component.ts`
- [ ] **T28** (~5 min) — En `restaurant-menu`, redirigir a la selección si no hay mesa de ese restaurante y mostrar "Mesa N" · `packages/web-clientes/src/app/features/menu/restaurant-menu.component.ts`
- [ ] **T29** (~10 min) — Enviar `tableId` en `OrderService.createOrder` y desde `cart.component.ts`; mostrar la mesa en el resumen; ante un 409 `TableNotOccupiedError`, borrar la mesa del `CartStore` (conservando los ítems), mostrar "Tu mesa ha sido liberada, elige otra" y navegar a `/restaurants/:id/table` · `packages/web-clientes/src/app/core/services/order.service.ts`, `features/cart/cart.component.ts`

**Documentación y verificación**

- [ ] **T30** (~10 min) — Documentar la tabla `tables`, la relación con `orders.table_id`, los estados de mesa y los endpoints · `docs/dominio/modelo-datos.md`, `docs/dominio/glosario.md`, `docs/arquitectura/arquitectura-api.md`
- [ ] **T31** (~5 min) — Añadir a `CLAUDE.md` el dominio `table`, la ruta pública de mesas, que `occupy` no usa `authorizeRestaurant` y el flujo de cliente personas → mesa → carta · `CLAUDE.md`
- [ ] **T32** (~10 min) — Probar de punta a punta los tres frontends (sección 6) · —

## 6. Verificación

- [ ] `npm test` en verde (nuevos tests de `table.service.test.ts` y tests de pedidos actualizados).
- [ ] `POST /api/v1/restaurants/rest-1/tables` como `admin@resttek.com` con `{ "number": 10, "capacity": 4, "description": "Terraza" }` → 201 con `status: "libre"`.
- [ ] Repetir con `number: 10` → 409 `DuplicatedTableNumberError`.
- [ ] `{ "number": 0, "capacity": 4 }` → 400 `InvalidTableNumberError`; `{ "number": 11, "capacity": 25 }` → 400 `InvalidCapacityError`; `status: "rota"` → 400 `InvalidTableStatusError`.
- [ ] `GET /api/v1/restaurants/rest-2/tables` con un manager de `rest-1` → 403; `PUT /api/v1/restaurants/rest-1/tables/<id-de-mesa-de-rest-2>` como admin → 404.
- [ ] `PATCH /api/v1/restaurants/rest-1/tables/<id>/status` como camarero de `rest-1` con `{ "status": "reservada" }` → 200; como cocinero → 403.
- [ ] `GET /api/v1/public/restaurants/rest-1/tables?partySize=5` → solo mesas `libre` con `capacity >= 5`; `partySize=0` o `abc` → 400 `InvalidPartySizeError`.
- [ ] `POST /api/v1/restaurants/rest-1/tables/<id>/occupy` como cliente → 200 `status: "ocupada"`; repetir → 409 `TableNotAvailableError`; como camarero → 403.
- [ ] `DELETE` de una mesa ocupada → 409 `TableOccupiedError`; de una libre → 204.
- [ ] `POST /api/v1/orders` con `tableId` inexistente o de otro restaurante → 404 `TableNotFoundError`; con una mesa `libre` o `reservada` → 409 `TableNotOccupiedError`; con la mesa ocupada → 201 y `GET /orders/active` devuelve ese `tableId`.
- [ ] web-clientes: con la mesa ocupada y productos en el carrito, el camarero la libera; al confirmar el pedido aparece "Tu mesa ha sido liberada, elige otra" y se vuelve a la selección de mesa con el carrito intacto.
- [ ] web-admin: crear, editar y borrar mesas desde "Mesas" del restaurante.
- [ ] web-clientes: restaurante → 3 personas → solo aparecen mesas libres de capacidad ≥ 3 → Continuar → carta con "Mesa N" → pedido creado con `tableId`; la mesa ya no aparece como libre.
- [ ] web-empleados (camarero): la mesa aparece `ocupada` con su pedido y el estado de los ítems; cambiarla a `libre` funciona.

## 7. Riesgos y dudas abiertas

Las dudas de la primera versión están resueltas (ver "Decisiones confirmadas en la revisión" en la sección 4). Quedan estos riesgos:

- **Mesa liberada con el cliente aún pidiendo**: como el pedido exige mesa `ocupada`, si el personal libera la mesa antes de tiempo el cliente tiene que elegir mesa otra vez (lo cubre T29).
- **Mesas abandonadas**: al no caducar, una mesa ocupada sin pedido depende de que el personal la libere; la página `mesas` de `web-empleados` permite detectarlas (ocupadas sin pedidos activos).
- **Clave foránea en `orders.table_id`**: no se añade porque `CREATE TABLE IF NOT EXISTS` no altera la tabla existente; la integridad la garantiza `OrderService`.
- **Concurrencia**: `occupyIfFree` es un `UPDATE` condicional, suficiente con la conexión única de SQLite del proyecto.

