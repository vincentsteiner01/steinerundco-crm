#!/usr/bin/env bash
# Zugriffs-Smoke nach dem Deploy (BAUPLAN § 9.5 Nr. 4): anon darf `leads` nicht lesen (401/403), `rpc/ping` liefert 200.
#   bash tests/zugriff.sh https://crm.steinerundco.de
set -euo pipefail
URL="${1:-https://crm.steinerundco.de}"
SUPA="https://ekaqkfgvisdngsskzbai.supabase.co"
KEY="$(grep '^VITE_SUPABASE_KEY=' .env.production | cut -d= -f2-)"

leads="$(curl -s -o /dev/null -w '%{http_code}' "$SUPA/rest/v1/leads?select=id&limit=1" -H "apikey: $KEY" -H "Accept-Profile: crm")"
ping="$(curl -s -o /dev/null -w '%{http_code}' "$SUPA/rest/v1/rpc/ping" -H "apikey: $KEY" -H "Accept-Profile: crm")"
shell="$(curl -s -o /dev/null -w '%{http_code}' "$URL/anmelden")"

fehler=0
pruefe() { if [[ "$2" == "$3" ]]; then echo "ok    $1 → $2"; else echo "FEHLT $1 → $2 (erwartet $3)"; fehler=1; fi; }
if [[ "$leads" == "401" || "$leads" == "403" ]]; then echo "ok    anon leads → $leads"; else echo "FEHLT anon leads → $leads (erwartet 401/403)"; fehler=1; fi
pruefe "anon rpc/ping" "$ping" "200"
pruefe "SPA $URL/anmelden" "$shell" "200"
curl -sI "$URL/" | grep -iE 'content-security|cache-control|x-robots' || { echo "FEHLT Sicherheits-Header (.htaccess, Plesk: nginx-Statik aus – § 9.6 Nr. 4)"; fehler=1; }
exit "$fehler"
