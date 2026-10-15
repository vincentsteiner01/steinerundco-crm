#!/usr/bin/env bash
# Feedback aus der App lesen und beantworten (für Claude) – Tabelle crm.feedback, Migration 6.
# Läuft über tools/db-query.sh (Management-API, Token aus dem Schlüsselbund, RLS wird als postgres umgangen).
#
#   bash tools/feedback.sh liste [neu|in_arbeit|erledigt|abgelehnt|offen|alle]   neueste zuerst (Standard: offen = neu + in_arbeit)
#   bash tools/feedback.sh zeige <id>                                          alles zu einer Meldung (id oder die ersten ≥ 4 Zeichen)
#   bash tools/feedback.sh status <id> <neu|in_arbeit|erledigt|abgelehnt> ["<antwort>"]
#                                                                              Status setzen, optional Antwort an Vincent/Mike
#                                                                              (antwort_at setzt der Trigger; die App zeigt sie live + Toast)
#   bash tools/feedback.sh bild <id>                                           wo der Screenshot liegt und wie man ihn ansieht
#
# Screenshots liegen im privaten Bucket „crm-feedback“. Mit dem CLI-Token kommt man per SQL nur an die Metadaten
# (storage.objects), nicht an die Bilddaten – angesehen werden sie in der App: /feedback?id=<id> (eingeloggt, im
# eingebauten Browser; Signed URL 2 min). `zeige` druckt dafür Route, Viewport und die Konsolen-Einträge.
set -euo pipefail
cd "$(dirname "$0")/.."

BEFEHL="${1:-}"
APP_LOKAL="http://localhost:8768"
APP_LIVE="https://crm.steinerundco.de"

hilfe() { sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; }

# SQL ausführen und JSON zurückgeben (SQL in einer temporären Datei, nie in der Prozessliste)
sql() {
  local DATEI; DATEI="$(mktemp)"
  printf '%s' "$1" > "$DATEI"
  local OUT
  if ! OUT="$(bash tools/db-query.sh -f "$DATEI")"; then rm -f "$DATEI"; echo "$OUT" >&2; exit 1; fi
  rm -f "$DATEI"
  printf '%s' "$OUT"
}

# Literal für SQL: einfache Anführungszeichen verdoppeln
literal() { python3 -I -c 'import sys; print("'"'"'" + sys.argv[1].replace("'"'"'", "'"'"''"'"'") + "'"'"'")' "$1"; }

# id oder Präfix (≥ 4 Hex-Zeichen) → genau eine UUID
id_aufloesen() {
  local ROH="${1:-}"
  [[ "$ROH" =~ ^[0-9a-fA-F-]{4,36}$ ]] || { echo "Ungültige ID „$ROH“ – erwartet: UUID oder die ersten ≥ 4 Zeichen." >&2; exit 2; }
  local OUT
  OUT="$(sql "select id from crm.feedback where id::text like lower('$ROH') || '%' order by created_at desc limit 2")"
  python3 -I - "$OUT" "$ROH" <<'PYCODE'
import json, sys
d = json.loads(sys.argv[1])
if not d: sys.exit("Keine Meldung mit ID " + sys.argv[2])
if len(d) > 1: sys.exit("ID " + sys.argv[2] + " ist mehrdeutig – mehr Zeichen angeben")
print(d[0]["id"])
PYCODE
}

case "$BEFEHL" in
  liste)
    FILTER="${2:-offen}"
    case "$FILTER" in
      offen) WHERE="f.status in ('neu', 'in_arbeit')" ;;
      alle) WHERE="true" ;;
      neu|in_arbeit|erledigt|abgelehnt) WHERE="f.status = '$FILTER'" ;;
      *) echo "Unbekannter Filter „$FILTER“ – neu · in_arbeit · erledigt · abgelehnt · offen · alle" >&2; exit 2 ;;
    esac
    OUT="$(sql "select f.id, f.status, f.art, coalesce(m.display_name, '–') as von,
                       to_char(f.created_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') as erstellt,
                       f.route, f.viewport, f.titel, f.beschreibung, f.antwort is not null as beantwortet,
                       f.screenshot_path is not null as bild, jsonb_array_length(f.konsole) as konsole
                  from crm.feedback f left join public.members m on m.user_id = f.member_id
                 where $WHERE order by f.created_at desc limit 100")"
    python3 -I - "$OUT" "$FILTER" <<'PYCODE'
import json, sys
d = json.loads(sys.argv[1])
if not d:
    print("Keine Meldungen (" + sys.argv[2] + ")."); sys.exit(0)
def kurz(s, n):
    s = " ".join((s or "").split())
    return s if len(s) <= n else s[: n - 1] + "…"
print(f"{'ID':<9} {'STATUS':<10} {'ART':<7} {'VON':<8} {'ERSTELLT':<12} {'SEITE':<22} {'BILD':<4} {'KONS':>4}  TITEL / BESCHREIBUNG")
for r in d:
    text = kurz((r["titel"] + " – " if r["titel"] else "") + r["beschreibung"], 70)
    print(f"{r['id'][:8]:<9} {r['status']:<10} {r['art']:<7} {kurz(r['von'], 8):<8} {r['erstellt']:<12} {kurz(r['route'] or '–', 22):<22} "
          f"{('ja' if r['bild'] else '–'):<4} {r['konsole']:>4}  {text}{'  [beantwortet]' if r['beantwortet'] else ''}")
print(f"\n{len(d)} Meldung(en) · Details: bash tools/feedback.sh zeige <id>")
PYCODE
    ;;

  zeige)
    ID="$(id_aufloesen "${2:-}")"
    OUT="$(sql "select f.*, coalesce(m.display_name, '–') as von, coalesce(n.display_name, '–') as notiz_von_name,
                       to_char(f.created_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') as erstellt_de,
                       to_char(f.antwort_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') as antwort_de,
                       to_char(f.notiz_at at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') as notiz_de,
                       (select (o.metadata->>'size')::bigint from storage.objects o where o.bucket_id = 'crm-feedback' and o.name = f.screenshot_path) as bild_bytes
                  from crm.feedback f
                  left join public.members m on m.user_id = f.member_id
                  left join public.members n on n.user_id = f.notiz_von
                 where f.id = '$ID'")"
    python3 -I - "$OUT" "$APP_LOKAL" "$APP_LIVE" <<'PYCODE'
import json, sys
r = json.loads(sys.argv[1])[0]
lokal, live = sys.argv[2], sys.argv[3]
def zeile(k, v):
    print(f"{k:<13} {v if v not in (None, '') else '–'}")
zeile("ID", r["id"])
zeile("Status", r["status"])
zeile("Art", r["art"])
zeile("Von", r["von"] + " · " + r["erstellt_de"])
zeile("Titel", r["titel"])
zeile("Seite", r["route"])
zeile("URL", r["url"])
zeile("Viewport", r["viewport"])
zeile("Browser", r["user_agent"])
zeile("Version", r["app_version"])
if r["screenshot_path"]:
    groesse = f" ({round(r['bild_bytes'] / 1024)} kB)" if r["bild_bytes"] else " (Objekt fehlt im Bucket)"
    zeile("Screenshot", "crm-feedback/" + r["screenshot_path"] + groesse)
    zeile("", "ansehen: " + lokal + "/feedback?id=" + r["id"] + "  ·  " + live + "/feedback?id=" + r["id"])
else:
    zeile("Screenshot", "ohne Bild")
print("\nBeschreibung\n" + "\n".join("  " + z for z in r["beschreibung"].splitlines()))
k = r["konsole"] or []
print(f"\nKonsole ({len(k)})")
for e in k:
    print(f"  {e.get('zeit', '')[11:19]}  {e.get('art', ''):<9} {' '.join(str(e.get('text', '')).split())[:400]}")
if not k: print("  –")
if r["notiz"]:
    print(f"\nNotiz von {r['notiz_von_name']} · {r['notiz_de']}\n" + "\n".join("  " + z for z in r["notiz"].splitlines()))
if r["antwort"]:
    print(f"\nAntwort (Claude) · {r['antwort_de']}\n" + "\n".join("  " + z for z in r["antwort"].splitlines()))
PYCODE
    ;;

  status)
    ID="$(id_aufloesen "${2:-}")"
    NEU="${3:-}"
    [[ "$NEU" =~ ^(neu|in_arbeit|erledigt|abgelehnt)$ ]] || { echo "Status muss neu · in_arbeit · erledigt · abgelehnt sein." >&2; exit 2; }
    SET="status = '$NEU'"
    if [[ $# -ge 4 ]]; then SET="$SET, antwort = $(literal "$4")"; fi
    OUT="$(sql "update crm.feedback set $SET where id = '$ID' returning id, status, antwort_at")"
    python3 -I - "$OUT" <<'PYCODE'
import json, sys
r = json.loads(sys.argv[1])[0]
print("Gespeichert: " + r["id"][:8] + " → " + r["status"] + (" · Antwort " + r["antwort_at"][:16].replace("T", " ") + " UTC" if r["antwort_at"] else ""))
PYCODE
    ;;

  bild)
    ID="$(id_aufloesen "${2:-}")"
    OUT="$(sql "select f.id, f.screenshot_path, f.route, f.viewport,
                       (select (o.metadata->>'size')::bigint from storage.objects o where o.bucket_id = 'crm-feedback' and o.name = f.screenshot_path) as bytes
                  from crm.feedback f where f.id = '$ID'")"
    python3 -I - "$OUT" "$APP_LOKAL" "$APP_LIVE" <<'PYCODE'
import json, sys
r = json.loads(sys.argv[1])[0]
lokal, live = sys.argv[2], sys.argv[3]
if not r["screenshot_path"]:
    print("Meldung " + r["id"][:8] + " hat keinen Screenshot."); sys.exit(0)
print("Objekt:    crm-feedback/" + r["screenshot_path"] + (f" ({round(r['bytes'] / 1024)} kB)" if r["bytes"] else " (fehlt im Bucket)"))
print("Kontext:   " + (r["route"] or "–") + " · " + (r["viewport"] or "–"))
print("Ansehen:   " + lokal + "/feedback?id=" + r["id"] + "  (eingebauter Browser, eingeloggt)")
print("           " + live + "/feedback?id=" + r["id"])
print("Hinweis:   Die Bilddaten liegen im privaten Storage – per SQL/CLI-Token nicht lesbar; die App lädt sie über eine Signed URL (2 min).")
PYCODE
    ;;

  ""|-h|--help|hilfe) hilfe ;;
  *) echo "Unbekannter Befehl „$BEFEHL“." >&2; hilfe; exit 2 ;;
esac
