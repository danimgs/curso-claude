---
name: plan-feature
description: Planifica cómo implementar una nueva funcionalidad o corregir un bug y genera un plan detallado en docs/plans con una lista de tareas de 5-10 minutos. Úsala cuando el usuario pida planificar, diseñar o preparar una funcionalidad o la corrección de un bug antes de programarla.
argument-hint: <descripción de la funcionalidad o del bug>
---

# Planificar una funcionalidad o un bug

Genera un plan detallado en `docs/plans/` para la funcionalidad o el bug descrito. **Esta skill solo planifica: no modifica código de `src/`.**

Petición del usuario: $ARGUMENTS

## Proceso

1. **Entiende la petición.** Si `$ARGUMENTS` está vacío o es ambiguo (falta el comportamiento esperado, o en un bug cómo reproducirlo), pregunta al usuario con `AskUserQuestion` antes de seguir. No preguntes lo que puedas deducir del código.
2. **Explora el código afectado.** Lee `CLAUDE.md` y los archivos relevantes de `src/` (routes, controllers, services, repositories, models, helpers). Si la funcionalidad toca un GET de listado, lee también `docs/api/api-pagination.md`. En un bug, localiza la causa raíz antes de planificar la corrección.
3. **Diseña la solución** respetando la arquitectura en capas (`routes → controllers → services → repositories → SQLite`), SQLite con `node:sqlite` sin ORM ni dependencias externas, y las convenciones (código, mensajes de error y campos en español).
4. **Redacta el plan** a partir de la plantilla [assets/plantilla-plan.md](assets/plantilla-plan.md). Respeta sus secciones y su orden; no añadas ni elimines secciones (si una no aplica, indícalo con "No aplica").
5. **Guárdalo** en `docs/plans/<AAAA-MM-DD>-<slug>.md`, con la fecha de hoy y un slug en minúsculas, sin acentos y con guiones (por ejemplo `2026-10-15-busqueda-por-nombre.md`). Crea la carpeta `docs/plans/` si no existe. Si el archivo ya existe, no lo sobrescribas: pregunta al usuario.
6. **Avisa por Slack** según "Aviso por Slack" una vez guardado el plan.
7. **Resume** al usuario la ruta del plan, el número de tareas y las dudas abiertas.

## Aviso por Slack

Cuando el plan esté guardado, envía un mensaje al canal `planes-ed8` (ID `C0CAKE90QFR`) para avisar de que ya se puede revisar:

- Usa la herramienta `mcp__slack__slack_post_message` (si no está cargada, cárgala con `ToolSearch` y `select:mcp__slack__slack_post_message`). Si el ID no funcionase, búscalo por nombre con `mcp__slack__slack_list_channels`.
- Mensaje en español, breve, con la ruta del plan y el número de tareas. Ejemplo: `📝 El plan ya está listo para revisar: docs/plans/2026-10-15-busqueda-por-nombre.md (8 tareas).`
- Si el envío falla, no interrumpas la skill: indícalo al usuario en el resumen final junto con el error.

## Reglas de la lista de tareas

- Cada tarea debe poder hacerse en **5-10 minutos**. Si estimas más, divídela; si es trivial (menos de 5 min), agrúpala con otra relacionada.
- Cada tarea es **concreta y verificable**: un verbo en infinitivo, el resultado esperado y el archivo afectado.
- Ordénalas por dependencia, siguiendo el flujo de capas de abajo arriba: models → repositories → services → controllers → routes → documentación.
- Incluye siempre las tareas de verificación (peticiones de ejemplo con el resultado esperado) y, si cambia el comportamiento de la API, la actualización de `CLAUDE.md` o de `docs/`.
- Numéralas `T1`, `T2`, … con su estimación entre paréntesis y formato de casilla `- [ ]`.

## Reglas generales

- Todo el plan se escribe en **español**.
- Sé específico: nombra archivos, funciones, campos, códigos HTTP y mensajes de error reales del proyecto. Nada de tareas vagas como "implementar la lógica".
- No inventes comportamiento que el usuario no haya pedido; lo que quede abierto va a "Riesgos y dudas abiertas".
