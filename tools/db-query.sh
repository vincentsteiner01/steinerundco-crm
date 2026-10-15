#!/usr/bin/env bash
# Führt SQL gegen das Supabase-Projekt aus – über die Management-API, ohne Datenbank-Passwort.
# Das Zugangstoken kommt aus dem macOS-Schlüsselbund der Supabase CLI (einmal `supabase login`).
#
#   bash tools/db-query.sh "select now()"          SQL direkt
#   bash tools/db-query.sh -f supabase/seed.sql     SQL aus Datei
#   SUPABASE_PROJECT_REF=… bash tools/db-query.sh … anderes Projekt
#
# Antwort ist JSON (Zeilen oder {"message": …} bei Fehlern). Exit-Code 1 bei Fehler.
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-ekaqkfgvisdngsskzbai}"

if [[ "${1:-}" == "-f" ]]; then
  [[ -f "${2:-}" ]] || { echo "Datei nicht gefunden: ${2:-}" >&2; exit 2; }
  SQL_FILE="$2"
else
  [[ -n "${1:-}" ]] || { echo "Aufruf: tools/db-query.sh \"<sql>\" | -f <datei.sql>" >&2; exit 2; }
  SQL_FILE="$(mktemp)"; printf '%s' "$1" > "$SQL_FILE"; trap 'rm -f "$SQL_FILE"' EXIT
fi

RAW="$(security find-generic-password -s "Supabase CLI" -a supabase -w 2>/dev/null || true)"
[[ -n "$RAW" ]] || { echo "Kein Supabase-Token im Schlüsselbund. Bitte einmal 'supabase login' ausführen." >&2; exit 3; }
TOKEN="$(printf '%s' "${RAW#go-keyring-base64:}" | base64 -d)"

# Token nur über eine temporäre curl-Konfigurationsdatei übergeben (taucht nicht in der Prozessliste auf).
CFG="$(mktemp)"; chmod 600 "$CFG"
BODY="$(mktemp)"
trap 'rm -f "$CFG" "$BODY" ${SQL_FILE_TMP:-}' EXIT
printf 'header = "Authorization: Bearer %s"\nheader = "Content-Type: application/json"\n' "$TOKEN" > "$CFG"
unset TOKEN RAW

python3 -I - "$SQL_FILE" "$BODY" <<'PY'
import json, sys, pathlib
sql = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
pathlib.Path(sys.argv[2]).write_text(json.dumps({"query": sql}), encoding="utf-8")
PY

HTTP="$(curl -s -o /dev/stdout -w '\n%{http_code}' -K "$CFG" -X POST \
  "https://api.supabase.com/v1/projects/$REF/database/query" --data-binary "@$BODY")"
CODE="${HTTP##*$'\n'}"
OUT="${HTTP%$'\n'*}"
printf '%s\n' "$OUT"
[[ "$CODE" == 2* ]] || { echo "HTTP $CODE" >&2; exit 1; }
