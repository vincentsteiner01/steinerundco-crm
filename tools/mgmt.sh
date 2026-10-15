#!/usr/bin/env bash
# Supabase Management-API mit dem CLI-Token aus dem macOS-Schlüsselbund (architektur § 6.3).
# bash tools/mgmt.sh GET  /v1/projects/ekaqkfgvisdngsskzbai/postgrest
# bash tools/mgmt.sh PATCH /v1/projects/ekaqkfgvisdngsskzbai/postgrest '{"db_schema":"public,graphql_public,crm"}'
set -euo pipefail
METHOD="${1:?GET|PATCH|POST}"; PFAD="${2:?/v1/...}"; JSON="${3:-}"
RAW="$(security find-generic-password -s "Supabase CLI" -a supabase -w 2>/dev/null || true)"
[[ -n "$RAW" ]] || { echo "Kein Supabase-Token im Schlüsselbund – einmal 'supabase login'." >&2; exit 3; }
TOKEN="$(printf '%s' "${RAW#go-keyring-base64:}" | base64 -d)"
CFG="$(mktemp)"; chmod 600 "$CFG"; trap 'rm -f "$CFG"' EXIT
printf 'header = "Authorization: Bearer %s"\nheader = "Content-Type: application/json"\n' "$TOKEN" > "$CFG"
unset TOKEN RAW
# Antwort ausgeben, aber Geheimnisse (z. B. jwt_secret der PostgREST-Konfiguration) nie anzeigen.
filtern() {
  python3 -I -c '
import json, sys
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print(raw); sys.exit(0)
def clean(o):
    if isinstance(o, dict):
        return {k: ("<verborgen>" if any(s in k.lower() for s in ("secret", "password", "token")) else clean(v)) for k, v in o.items()}
    if isinstance(o, list):
        return [clean(x) for x in o]
    return o
print(json.dumps(clean(d), ensure_ascii=False))
'
}
if [[ -n "$JSON" ]]; then
  curl -sS -K "$CFG" -X "$METHOD" "https://api.supabase.com$PFAD" --data-binary "$JSON" | filtern
else
  curl -sS -K "$CFG" -X "$METHOD" "https://api.supabase.com$PFAD" | filtern
fi
