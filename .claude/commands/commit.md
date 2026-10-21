---
description: Crea un commit siguiendo la especificación Conventional Commits
argument-hint: [contexto o alcance opcional]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

# Commit con Conventional Commits

Crea un commit de los cambios actuales siguiendo la especificación [Conventional Commits 1.0.0](https://www.conventionalcommits.org/es/v1.0.0/).

## Contexto

- Estado del repositorio: !`git status --short`
- Cambios en el área de preparación (staged): !`git diff --cached`
- Cambios sin preparar: !`git diff`
- Últimos commits (para respetar el estilo): !`git log --oneline -10 2>/dev/null || echo "(aún no hay commits)"`

Indicaciones adicionales del usuario: $ARGUMENTS

## Formato

```
<tipo>[ámbito opcional][!]: <descripción>

[cuerpo opcional]

[pie(s) opcional(es)]
```

### Tipos permitidos

| Tipo       | Cuándo usarlo                                                  |
| ---------- | -------------------------------------------------------------- |
| `feat`     | Nueva funcionalidad                                            |
| `fix`      | Corrección de un error                                         |
| `docs`     | Cambios solo de documentación                                  |
| `style`    | Formato que no afecta al significado (espacios, comas, etc.)   |
| `refactor` | Cambio de código que no corrige un error ni añade funcionalidad |
| `perf`     | Mejora de rendimiento                                          |
| `test`     | Añadir o corregir tests                                        |
| `build`    | Cambios en el sistema de build o dependencias (`package.json`) |
| `ci`       | Cambios en la configuración de integración continua            |
| `chore`    | Tareas de mantenimiento que no modifican `src` ni tests        |
| `revert`   | Revierte un commit anterior                                    |

### Reglas

1. La descripción va en **español**, en imperativo y minúscula inicial (`añade`, `corrige`, `migra`), sin punto final.
2. La primera línea no debe superar los **72 caracteres**.
3. El **ámbito** es opcional y va entre paréntesis; usa la capa o el módulo afectado (por ejemplo `routes`, `controllers`, `services`, `repositories`, `models`, `helpers`, `db`).
4. El **cuerpo** (separado por una línea en blanco) explica el *qué* y el *porqué*, no el *cómo*.
5. Un **cambio incompatible** se marca con `!` tras el tipo/ámbito (`feat(api)!: ...`) y/o con un pie `BREAKING CHANGE: <descripción>`.
6. Los pies usan el formato `Clave: valor` (por ejemplo `Refs: #12`, `Closes: #7`).

## Proceso

1. Analiza los cambios del contexto. Si no hay nada preparado, decide qué archivos corresponde incluir y añádelos con `git add <archivos>` indicando rutas concretas (nunca `git add -A` ni `git add .`).
2. No incluyas archivos sensibles (`.env`, credenciales, claves). Avisa al usuario si los detectas.
3. Si los cambios mezclan varias intenciones independientes (por ejemplo una funcionalidad y un arreglo no relacionado), propón dividirlos en **varios commits** y crea uno por cada intención.
4. Elige el tipo y el ámbito que mejor describan el cambio y redacta el mensaje según las reglas anteriores y muestraselo al usuario utilizando la tool `AskUserQuestion` para preguntarle si le parece bien el mensaje. Si no le parece bien, genera otro mensaje y le vuelves a preguntar. Cuando lo de por válido sigue con el paso 5.
5. Crea el commit con `git commit` usando un heredoc para respetar los saltos de línea. Termina el mensaje con la línea de atribución indicada en las instrucciones de la sesión, si la hay.
6. Ejecuta `git status` y muestra al usuario el hash y el mensaje del commit creado.

## Restricciones

- No hagas `git push`, ni `--amend`, ni `--no-verify`, ni modifiques la configuración de git, salvo que el usuario lo pida expresamente.
- Si un hook de pre-commit falla, corrige el problema y crea un commit **nuevo**; no uses `--amend`.
- Si no hay cambios que confirmar, informa al usuario y no crees un commit vacío.

## Ejemplos

```
feat(vendehumos): añade el endpoint de votos
```

```
fix(services): devuelve 404 al votar un vendehumo inexistente
```

```
refactor(repositories)!: migra el almacenamiento en memoria a SQLite

Sustituye el Map por node:sqlite con sentencias preparadas.

BREAKING CHANGE: los datos en memoria ya no se conservan entre reinicios.
```

```
docs: documenta la arquitectura en capas en CLAUDE.md
```
