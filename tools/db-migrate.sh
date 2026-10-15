#!/usr/bin/env bash
# Spielt alle noch nicht angewendeten Migrationen aus supabase/migrations/ ein (Reihenfolge = Dateiname)
# und trägt sie wie die Supabase CLI in supabase_migrations.schema_migrations ein.
#   bash tools/db-migrate.sh            alle offenen Migrationen
#   bash tools/db-migrate.sh --dry-run  nur anzeigen
set -euo pipefail
cd "$(dirname "$0")/.."
DRY="${1:-}"

APPLIED="$(bash tools/db-query.sh "select version from supabase_migrations.schema_migrations" \
  | python3 -I -c 'import json,sys; d=json.load(sys.stdin); print("\n".join(r["version"] for r in d) if isinstance(d,list) else "")')"

for FILE in supabase/migrations/*.sql; do
  NAME="$(basename "$FILE" .sql)"
  VERSION="${NAME%%_*}"
  LABEL="${NAME#*_}"
  if grep -qx "$VERSION" <<<"$APPLIED"; then
    echo "  bereits   $NAME"; continue
  fi
  echo "  anwenden  $NAME"
  [[ "$DRY" == "--dry-run" ]] && continue
  RESULT="$(bash tools/db-query.sh -f "$FILE")" || { echo "$RESULT"; echo "FEHLER in $NAME" >&2; exit 1; }
  # Migration wie die CLI protokollieren (statements als ein Eintrag)
  python3 -I - "$FILE" "$VERSION" "$LABEL" <<'PY' > /tmp/.crm-migration-record.sql
import sys, pathlib
sql = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").replace("'", "''")
print(f"insert into supabase_migrations.schema_migrations (version, name, statements) values ('{sys.argv[2]}', '{sys.argv[3]}', array['{sql}']) on conflict do nothing")
PY
  bash tools/db-query.sh -f /tmp/.crm-migration-record.sql > /dev/null
  rm -f /tmp/.crm-migration-record.sql
done
echo "fertig"
