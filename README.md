# Resttek

Plataforma de gestión de restaurantes: panel de administración, app para empleados (cocina, barra y salón) y app de pedidos para clientes, sobre una API Node.js.

Esta guía te lleva desde cero hasta tener el entorno funcionando y entender el flujo básico de la aplicación. Para el detalle de arquitectura y dominio, consulta [`docs/`](./docs).

---

## Requisitos Previos

| Herramienta | Versión mínima | Verificar |
| --- | --- | --- |
| **Node.js** | 22+ | `node --version` |
| **npm** | 10+ | `npm --version` |
| **Git** | 2.40+ | `git --version` |

---

## Setup Inicial

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd <nombre-repositorio>
```

### 2. Instalar dependencias de Node.js

El monorepo usa **npm workspaces**, así que un solo `install` desde la raíz instala todo:

```bash
npm install
```

Esto instala las dependencias de todos los paquetes: `api`, `web-admin`, `web-clientes`, `web-empleados` y `web-shared`.

### 3. Poblar la base de datos

La API usa SQLite. Las tablas se crean automáticamente al iniciar el servidor, pero necesitas datos de prueba:

```bash
npm run seed
```

Este comando ejecuta el script `packages/api/src/scripts/seed.ts`, que crea restaurantes, empleados, ingredientes, platos y pedidos de ejemplo.

---

## Arrancar el Entorno de Desarrollo

### API

```bash
# API Node.js (Express + TypeScript)
npm run dev:api
```

La API arranca en `http://localhost:3000`. Puedes verificar con:

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

### Frontends

Cada frontend se arranca de forma independiente. Todos hacen proxy de `/api` hacia `http://localhost:3000`:

```bash
# Terminal 2: Panel de Administración
npm run dev:admin       # → http://localhost:4200

# Terminal 3: App de Empleados
npm run dev:empleados   # → http://localhost:4201

# Terminal 4: App de Clientes
npm run dev:clientes    # → http://localhost:4202
```

---

## Puertos y Servicios

| Servicio | Puerto | URL |
| --- | --- | --- |
| API | 3000 | http://localhost:3000 |
| Web Admin | 4200 | http://localhost:4200 |
| Web Empleados | 4201 | http://localhost:4201 |
| Web Clientes | 4202 | http://localhost:4202 |

---

## Credenciales de Prueba

Tras ejecutar `npm run seed`, estas credenciales están disponibles. **La contraseña de cada usuario es su propio email.**

| Rol | Email (= contraseña) | Restaurante | Acceso |
| --- | --- | --- | --- |
| **Admin** | `admin@resttek.com` | — | web-admin |
| **Gerente** (`manager`) | `gerente1@resttek.com` | rest-1 | web-admin, web-empleados |
| **Gerente** (`manager`) | `gerente2@resttek.com` | rest-2 | web-admin, web-empleados |
| **Cocinero** | `cocinero1@resttek.com` | rest-1 | web-empleados (cocina) |
| **Cocinero** | `cocinero2@resttek.com` | rest-2 | web-empleados (cocina) |
| **Camarero** | `camarero1@resttek.com` | rest-1 | web-empleados (barra, salón) |
| **Camarero** | `camarero2@resttek.com` | rest-1 | web-empleados (barra, salón) |
| **Camarero** | `camarero3@resttek.com` | rest-2 | web-empleados (barra, salón) |
| **Cliente** | `cliente1@resttek.com` | — | web-clientes |
| **Cliente** | `cliente2@resttek.com` | — | web-clientes |

Por ejemplo, para entrar como admin: usuario `admin@resttek.com`, contraseña `admin@resttek.com`.

`seed` usa `INSERT OR IGNORE`, así que puedes ejecutarlo varias veces sin duplicar los datos de prueba. Al terminar imprime la lista completa de credenciales por consola.

---

## Primer Recorrido (Happy Path)

### Como Administrador

1. Accede a `http://localhost:4200`
2. Inicia sesión con las credenciales de admin
3. Navega al **Dashboard** → verás el listado de restaurantes
4. Entra en un restaurante → explora **Platos**, **Ingredientes**, **Empleados**
5. Prueba a crear un nuevo plato con ingredientes

### Como Cliente

1. Accede a `http://localhost:4202`
2. Regístrate con una cuenta nueva o usa las credenciales de cliente
3. Navega los restaurantes disponibles
4. Entra en un restaurante → ve la carta
5. Añade platos al carrito y realiza un pedido
6. Consulta el estado en **Mis Pedidos**

### Como Empleado

1. Accede a `http://localhost:4201`
2. Inicia sesión como cocinero → accedes a la vista de **Cocina**
3. Verás los pedidos pendientes → marca un ítem como "Preparando" → "Listo"
4. Inicia sesión como camarero → accedes a **Barra** y **Salón**
5. En Salón, entrega los ítems que están listos

---

## Estructura de Desarrollo Día a Día

```
Terminal 1: npm run dev:api          (deja corriendo)
Terminal 2: npm run dev:admin        (o el frontend que necesites)
Terminal 3: (libre para git, tests, etc.)
```

### Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch (desarrollo activo)
cd packages/api && npm run test:watch
```

---

## Problemas Comunes

### "Database is not initialized"

La API no se ha arrancado correctamente. Verifica que el puerto 3000 no esté ocupado:

```bash
lsof -i :3000
```

### "Cannot find module @resttek/web-shared"

Ejecuta `npm install` desde la raíz del monorepo. Los workspaces necesitan estar linkeados.

### Los cambios en web-shared no se reflejan

Angular no detecta cambios en librerías externas al workspace automáticamente. Reinicia el servidor de desarrollo del frontend.

### Error de CORS

Asegúrate de acceder al frontend por el proxy (puerto del frontend, no directamente al 3000). La API tiene CORS habilitado, pero el proxy es la forma recomendada.

---

## Entorno local no versionado

Todo el código y el historial están en GitHub. Esta sección recoge lo que **solo existía en el equipo local** (revisado el 2026-10-22) y cómo recuperarlo en un equipo nuevo.

### Ficheros locales que no se suben (y cómo regenerarlos)

| Fichero | Qué es | Cómo recuperarlo |
| ------- | ------ | ---------------- |
| `packages/api/resttek.db` | Base de datos SQLite de desarrollo | `npm run seed` (crea las tablas, incluida `tables`, y los datos de prueba) |
| `node_modules/`, `dist/`, `.angular/` | Dependencias y artefactos de build | `npm ci` y `npm run build -w <app>` |
| `.claude/worktrees/*` | Copias de trabajo de ramas (una por agente/app) | `git worktree add .claude/worktrees/<nombre> <rama>` |
| `.claude/settings.local.json` | Configuración personal de Claude Code | Ver más abajo |
| `.DS_Store` | Ficheros de macOS | No hace falta |

Si la base de datos local es anterior a la gestión de mesas (issue #5), bórrala y vuelve a sembrar: `rm packages/api/resttek.db && npm run seed`.

### Configuración personal de Claude Code

`.claude/settings.local.json` (ignorado por git) solo activa los servidores MCP del proyecto definidos en `.mcp.json`:

```json
{
  "skillOverrides": {},
  "enabledMcpjsonServers": ["context7", "slack"]
}
```

Instrucciones globales del usuario en `~/.claude/CLAUDE.md` (fuera del repositorio):

```text
La documentación la tienes que escribir en español.
Siempre que hables conmigo, hazlo en español y empieza con la frase "A sus ordenes, mi señor".
```

### Credenciales y servicios externos

Ninguno de estos valores está en el repositorio; hay que volver a configurarlos:

- **GitHub CLI**: `gh auth login` (lo usan las skills `plan-feature` e `implement-plan` y `scripts/seed-issues.sh`).
- **Slack (MCP)**: variables de entorno `SLACK_BOT_TOKEN` y `SLACK_TEAM_ID` en el perfil de la shell; `.mcp.json` las lee con `${...}`. Las skills publican en el canal `planes-ed8` (`C0CAKE90QFR`).
- **CI de GitHub Actions** (`.github/workflows/ci.yml`): secreto del repositorio `CLAUDE_CODE_OAUTH_TOKEN` para la revisión de seguridad con Claude. Opcionales: variables `CLAUDE_SECURITY_MODEL` y `CLAUDE_SECURITY_MAX_BUDGET_USD`.
- **Protección de ramas**: para que el CI bloquee el merge en `development` y `main`, marca como checks obligatorios `Tests (api y web-shared)`, `Build web-admin`, `Build web-empleados`, `Build web-clientes` y `Revisión de seguridad (Claude)`.

### Ramas y pendientes

- La rama local `fix/001-correccion-vulnerabilidades-owasp` nunca se subió, pero está fusionada en `development`: no se pierde nada.
- Las ramas de la issue #5 (`feat/5-gestion-mesas-*`) y `ci/workflow-pull-requests` están fusionadas en `development` y se pueden borrar.
- Pendiente de la issue #5: la prueba visual de los tres frontends (tarea T32 de `docs/plans/2026-10-22-gestion-de-mesas.md`). Las comprobaciones de la API y los flujos por HTTP ya se hicieron.