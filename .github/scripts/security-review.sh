#!/usr/bin/env bash
# Revisión de seguridad de los cambios de una PR con Claude Code en modo headless.
# Falla (exit 1) si hay hallazgos de severidad crítica o alta, o si Claude no
# devuelve un resultado válido.
#
# Variables: ANTHROPIC_API_KEY (obligatoria), BASE_REF (rama destino de la PR),
# CLAUDE_MODEL, CLAUDE_MAX_BUDGET_USD.
set -euo pipefail

: "${ANTHROPIC_API_KEY:?Falta el secreto ANTHROPIC_API_KEY}"
: "${BASE_REF:?Falta BASE_REF (rama destino de la PR)}"
MODEL="${CLAUDE_MODEL:-claude-opus-5-5}"
BUDGET="${CLAUDE_MAX_BUDGET_USD:-5}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

DIR=.security-review
mkdir -p "$DIR"

git diff --name-only "origin/$BASE_REF...HEAD" > "$DIR/files.txt"
git diff "origin/$BASE_REF...HEAD" -- . ':(exclude)package-lock.json' > "$DIR/pr.diff"

if [ ! -s "$DIR/pr.diff" ]; then
  echo "### Revisión de seguridad: sin cambios que revisar" >> "$SUMMARY"
  exit 0
fi

# Solo herramientas de lectura. Con --permission-mode dontAsk se deniega todo lo
# que requiera aprobación, incluida la lectura fuera del directorio de trabajo.
claude -p "$(cat .github/claude/security-review.md)" \
  --model "$MODEL" \
  --output-format json \
  --json-schema "$(cat .github/claude/security-review.schema.json)" \
  --permission-mode dontAsk \
  --disallowedTools "Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch,Task,Agent" \
  --max-budget-usd "$BUDGET" \
  --no-session-persistence \
  > "$DIR/result.json" || true

if ! jq -e '.subtype == "success" and .structured_output != null' "$DIR/result.json" > /dev/null 2>&1; then
  echo "::error::Claude no devolvió un resultado válido (subtype: $(jq -r '.subtype // "desconocido"' "$DIR/result.json" 2>/dev/null || echo 'sin salida'))"
  echo "### Revisión de seguridad: error al ejecutar Claude" >> "$SUMMARY"
  exit 1
fi

jq '.structured_output' "$DIR/result.json" > "$DIR/report.json"

# Escapa el texto del modelo para los comandos de workflow (evita que inyecte comandos).
escape() { sed -e 's/%/%25/g' | sed -e ':a;N;$!ba;s/\r/%0D/g;s/\n/%0A/g'; }

jq -c '.findings[]' "$DIR/report.json" | while read -r f; do
  sev=$(jq -r '.severity' <<< "$f")
  level=warning; [[ "$sev" == critica || "$sev" == alta ]] && level=error
  file=$(jq -r '.file | gsub("[,:\n\r]"; "_")' <<< "$f")
  line=$(jq -r '.line // 1' <<< "$f")
  msg=$(jq -r '"[\(.severity)] \(.title): \(.description) Recomendación: \(.recommendation)"' <<< "$f" | escape)
  echo "::$level file=$file,line=$line::$msg"
done

{
  echo "### Revisión de seguridad (Claude, $MODEL)"
  echo
  jq -r '.summary' "$DIR/report.json"
  echo
  if jq -e '.findings | length > 0' "$DIR/report.json" > /dev/null; then
    echo "| Severidad | Categoría | Fichero | Hallazgo | Recomendación |"
    echo "| --- | --- | --- | --- | --- |"
    jq -r '.findings[] | [.severity, .category, "\(.file):\(.line // "-")", "**\(.title)**: \(.description)", .recommendation]
      | map(gsub("\\|"; "\\|") | gsub("\n"; " ")) | "| " + join(" | ") + " |"' "$DIR/report.json"
  else
    echo "Sin hallazgos."
  fi
  echo
  echo "Coste: $(jq -r '.total_cost_usd // "?"' "$DIR/result.json") USD"
} >> "$SUMMARY"

blocking=$(jq '[.findings[] | select(.severity == "critica" or .severity == "alta")] | length' "$DIR/report.json")
if [ "$blocking" -gt 0 ]; then
  echo "::error::$blocking hallazgo(s) de severidad crítica o alta. Corrígelos antes de fusionar."
  exit 1
fi
