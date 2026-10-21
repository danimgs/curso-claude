---
name: implement-plan
description: Implementa un plan de docs/plans/ (generado con plan-feature) creando una rama desde development en un git worktree propio (uno por agente/app si se reparte entre varios agentes) y aplicando TDD estricto tarea a tarea, con un commit por tarea y marcando cada tarea como hecha en el plan. Úsala cuando el usuario pida implementar, desarrollar o ejecutar un plan. Requiere que se adjunte el plan.
argument-hint: <ruta del plan> [nº de ticket]
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git switch:*), Bash(git worktree:*), Bash(git rev-parse:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Bash(git diff:*), Bash(npx vitest:*), Bash(npm test:*), Bash(npm install:*), Bash(npm i:*)
---

# Implementar un plan con TDD estricto

Implementa el plan indicado: $ARGUMENTS

## Paso 0: requisitos de entrada

1. **El plan es obligatorio.** Debe venir adjunto o indicado como ruta (normalmente `docs/plans/<AAAA-MM-DD>-<slug>.md`). Si no se ha aportado, **detente y pídelo**; no elijas uno por tu cuenta ni implementes de memoria.
2. Lee el plan completo y `CLAUDE.md` (arquitectura por capas, convenciones, mensajes en español). Si el plan tiene dudas abiertas (sección 8) que bloqueen una decisión, pregúntalas al usuario antes de empezar.
3. Si el plan no tiene lista de tareas con `- [ ] **T<n>**`, detente e indica que hay que generarlo con `plan-feature`.
4. Comprueba que el árbol de trabajo está limpio (`git status --short`). Si hay cambios sin commitear que no sean el propio plan, avisa al usuario y pregunta cómo proceder (no los pierdas ni los mezcles con la implementación). Si el plan aparece como no versionado, se incluirá en el primer commit que lo modifique.

## Paso 1: crear la rama

### 1.1 Rama base `development`

1. Comprueba si existe `development` (local o `origin/development`): `git branch --list development` y `git branch -r --list origin/development`.
2. **Si no existe**, créala primero desde la rama principal: `main` si existe; si no, `master`. Ejemplo: `git switch -c development main`. Si no existe ninguna de las dos, detente y avisa.
3. Si existe solo en remoto, crea la local con seguimiento: `git switch development`.
4. **Nunca** trabajes directamente sobre `development`, `main` ni `master`.

### 1.2 Nombre de la rama

Formato obligatorio: `<tipo-cambio>/<num-ticket>-<breve-descripcion>`

- `tipo-cambio`: tipo de Conventional Commits derivado del campo **Tipo** del plan: `feature` → `feat`, `bug` → `fix`; si el plan lo indica de otra forma (`refactor`, `docs`, `chore`, `perf`, `test`…), úsalo. Si el cambio rompe compatibilidad, la rama sigue usando el tipo base (el `!` solo va en los commits).
- `num-ticket`: número del ticket. Sácalo del argumento, del plan o del mensaje del usuario. **Si no aparece en ninguno, pregúntalo**; no lo inventes.
- `breve-descripcion`: kebab-case, sin acentos, 2-5 palabras (normalmente el slug del plan sin la fecha ni el prefijo `fix-`).
- Ejemplo: `feat/123-asociar-vendehumo-usuario`.

Si la rama ya existe, no la sobrescribas: pregunta al usuario si continuar en ella (útil para reanudar un plan a medias).

### 1.3 Crear el git worktree

Los cambios **no** se hacen en el directorio de trabajo principal, sino en un **git worktree** dedicado, para no tocar el checkout del usuario.

1. Ubicación: `.claude/worktrees/<breve-descripcion>` (dentro del repositorio). Ejemplo: `.claude/worktrees/asociar-vendehumo-usuario`. Comprueba que `.claude/worktrees/` está en `.gitignore`; si no, avisa al usuario y propón añadirlo, para que los worktrees no aparezcan como no versionados.
2. Crea la rama y el worktree a la vez desde `development`: `git worktree add -b <rama> <ruta-worktree> development`. Si la rama ya existía (reanudación), usa `git worktree add <ruta-worktree> <rama>`; si ya hay un worktree para esa rama (`git worktree list`), reutilízalo.
3. Si el plan aún no está versionado en `development`, cópialo al worktree en la misma ruta (`docs/plans/...`) para poder marcar las tareas allí.
4. **A partir de aquí, todo (instalar dependencias, tests, ediciones, marcar tareas y commits) se hace dentro del worktree**: usa rutas absolutas del worktree o `git -C <ruta-worktree> ...`. Ejecuta `npm install` en el worktree si hace falta (cada worktree tiene su propio `node_modules`).
5. No borres el worktree al terminar salvo que el usuario lo pida (`git worktree remove <ruta>`).

### 1.4 Planes que afectan a varias aplicaciones (varios agentes)

Si el plan abarca varias aplicaciones (p. ej. API y frontend) **y el usuario pide que varios agentes las implementen, uno por app**:

1. Crea **un worktree y una rama por aplicación/agente**, todas desde `development`: rama `<tipo-cambio>/<num-ticket>-<breve-descripcion>-<app>` y worktree `.claude/worktrees/<breve-descripcion>-<app>`.
2. Reparte las tareas del plan por aplicación. Lanza un subagente por app (en paralelo si sus tareas son independientes) indicándole: su ruta de worktree, su rama, las tareas `T<n>` que le corresponden y que siga los pasos 2-4 de esta skill **trabajando solo dentro de su worktree** y sin tocar archivos de otras apps.
3. Cada agente marca en el plan de su worktree solo sus tareas y hace sus propios commits. Si hay dependencias entre apps (p. ej. el frontend necesita un endpoint nuevo), respeta el orden del plan: lanza primero el agente del que se depende o acuerda el contrato antes de empezar.
4. Al terminar, revisa el resultado de cada agente y resume al usuario las ramas y worktrees generados. No los fusiones entre sí salvo que se pida.

## Paso 2: preparar el entorno de pruebas

El proyecto puede no tener framework de tests (`npm test` es un placeholder). Comprueba `package.json` y las carpetas `test/`/`tests/`.

- El framework de tests es **vitest**. Si no está instalado, añádelo como devDependency (`npm install -D vitest`); es la única dependencia nueva permitida, no añadas otras (p. ej. supertest). Para probar HTTP, importa `src/app.js` (no abre puerto), arráncala con `app.listen(0)` y llama con `fetch`.
- El código de `src/` es CommonJS: los tests pueden ser ESM (`import { describe, it, expect } from 'vitest'`) e importar los módulos CJS (`import app from '../../src/app.js'`) o usar `createRequire`. Si vitest no resuelve `node:sqlite`, configura `test.server.dep****ternal` o `resolve.external` en `vitest.config.js` para tratarlo como módulo nativo.
- Usa `DB_PATH=:memory:` en los tests (y `JWT_SECRET` de prueba) para aislar la BBDD. Como `src/` usa módulos con estado (la conexión a SQLite se crea al importar), usa `vi.resetModules()` o `pool: 'forks'`/aislamiento por archivo para que cada archivo de test parta de una BBDD limpia.
- Ubicación: `test/`, reflejando `src/` (p. ej. `test/services/vendehumo.service.test.js`, `test/api/vendehumo.test.js`). Ejecución: `npx vitest run`. Nombre de archivos: `*.test.js`.
- Este andamiaje (vitest en `devDependencies`, `vitest.config.js` con `DB_PATH=:memory:` y `JWT_SECRET` de prueba en `test.env`, carpeta `test/`, script `test` de `package.json` → `vitest run`, y un test mínimo de `/health` que demuestre que funciona) se hace **en su propio commit previo** (`chore(test): ...`) antes de la primera tarea, y solo si no existe ya. Comprueba que `npx vitest run` arranca sin errores antes de continuar.
- Antes de la primera tarea, ejecuta la suite una vez para conocer la línea base. Si ya hay tests rotos, avisa al usuario.

## Paso 3: bucle por tarea (TDD estricto)

Procesa las tareas **en el orden del plan**, una por una y sin saltarte ninguna. Para cada tarea `T<n>`:

### 🔴 Rojo
1. Escribe primero **un test** que exprese el resultado verificable de la tarea (comportamiento, no implementación). No escribas código de producción todavía.
2. Ejecútalo (`npx vitest run <archivo>`) y **comprueba que falla, y que falla por la razón esperada** (aserción incumplida, no un error de sintaxis o de import). Si pasa sin tocar código, el test no sirve o la tarea ya estaba hecha: revísalo antes de seguir.

### 🟢 Verde
3. Escribe el **código mínimo** que haga pasar el test, en el archivo y capa que indica la tarea, respetando la arquitectura (`routes` → `controllers` → `services` → `repositories`) y las convenciones de `CLAUDE.md`.
4. Ejecuta **toda la suite** (`npx vitest run`): todo en verde, incluidos los tests anteriores.

### 🔵 Refactor
5. Limpia duplicación o nombres sin cambiar comportamiento; vuelve a ejecutar la suite en verde.

### Cierre de tarea
6. **Marca la tarea como hecha en el plan**: cambia `- [ ] **T<n>**` por `- [x] **T<n>**` en el archivo del plan (solo esa línea; no reescribas el resto). Si la tarea completa un punto de la sección "Documentación a actualizar", márcalo también.
7. **Haz un commit** con el test, el código y el plan actualizado juntos (usa `git add` de archivos concretos, nunca `git add -A`). Mensaje en **Conventional Commits** en español, estilo del historial (`feat(vendehumos): ...`), con `!` si rompe compatibilidad según el plan, y el pie de atribución que corresponda. Un commit = una tarea; el asunto debe ser coherente con la tarea.
8. Pasa a la siguiente tarea.

### Reglas del TDD estricto
- **Prohibido escribir código de producción sin un test rojo previo** que lo exija.
- Un test nuevo cada vez; no encadenes varios comportamientos en una misma tarea.
- No avances a la siguiente tarea con la suite en rojo ni dejes tests deshabilitados o saltados.
- No modifiques un test para que pase; si el test estaba mal, corrígelo y explica por qué en el mensaje del commit.
- Si el comportamiento de una tarea ya está cubierto por tests de una anterior (el test nace en verde), no fuerces código artificial: documenta que ya está cubierto, marca la tarea como hecha y haz commit solo del plan (y de tests adicionales si aportan).

### Tareas que no son de código
- **Verificación manual con `curl`** (p. ej. "probar con curl..."): conviértela en tests automatizados de integración que cubran los casos del "Plan de pruebas" del plan. El ciclo rojo/verde se aplica igual: si ya pasan, la tarea consiste en añadir esos tests y comprobar que son sensibles (p. ej. rompiendo temporalmente el código y viendo que fallan, sin dejar el cambio).
- **Documentación** (`CLAUDE.md`, `docs/`): no tiene test; actualízala en español, comprueba que describe lo realmente implementado y haz el commit (`docs: ...`).
- **Migraciones o scripts**: pruébalos con un test que parta de una BBDD temporal con el esquema antiguo.

## Paso 4: si algo se tuerce

- Si una tarea es más grande de lo previsto o el plan es incorrecto/incompleto (p. ej. contradice el código real), **detente y consúltalo** con el usuario; no improvises un cambio de diseño. Si se acuerda, anota el ajuste en el plan.
- Si un test no se puede poner en verde tras un intento razonable, no fuerces el commit: informa del bloqueo con la salida del test.
- Nunca uses `--no-verify`, `git push --force`, ni reescribas commits ya hechos sin permiso.

## Paso 5: cierre

1. Cuando todas las tareas estén en `[x]`, ejecuta la suite completa una última vez en cada worktree, y comprueba `git status` en cada uno (árbol limpio).
2. Cambia el campo **Estado** del plan a `completado` y haz un último commit (`docs(plan): marca el plan como completado`).
3. **No hagas push ni abras PR** salvo que el usuario lo pida.
4. Resume al usuario, en español: rama(s) y worktree(s) creados (con su ruta), tareas completadas (con sus commits), resultado de la suite, y cualquier desviación o duda pendiente.

