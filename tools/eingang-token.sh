#!/usr/bin/env bash
# Erzeugt (oder widerruft) den Eingangs-Schlüssel eines Mitglieds für das Apps Script „LinkedIn ins CRM“
# (tools/apps-script/ANLEITUNG.md). Läuft über tools/db-query.sh im Namen des Mitglieds (crm.eingang_token_erzeugen).
#
#   bash tools/eingang-token.sh vincent@steinerundco.de              neuer Schlüssel → Zwischenablage (der bisherige wird ungültig)
#   bash tools/eingang-token.sh --anzeigen vincent@steinerundco.de   wie oben, Schlüssel zusätzlich einmal im Terminal zeigen
#   bash tools/eingang-token.sh --widerrufen mike@steinerundco.de    alle Schlüssel des Mitglieds ungültig machen
#
# Selbst im eigenen Terminal ausführen – NICHT über Claude oder ein anderes Tool, dessen Ausgabe mitgeschrieben wird: Wer den
# Schlüssel hat, kann im Namen des Mitglieds Annahmen und Antworten ins CRM buchen. Deshalb verweigert das Skript ohne
# interaktives Terminal und legt den Schlüssel nur in die Zwischenablage (pbcopy), statt ihn auszugeben.
# Einfacher: in der Chrome-Erweiterung unter Einstellungen → „LinkedIn-Mails ins CRM“ → „Schlüssel erzeugen“.
# In der Datenbank liegt nur der SHA-256-Hash. Nur in die Skripteigenschaft CRM_SCHLUESSEL des eigenen Apps Scripts einfügen.
set -euo pipefail
cd "$(dirname "$0")/.."

MODUS="erzeugen"
ANZEIGEN="nein"
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --widerrufen) MODUS="widerrufen" ;;
    --anzeigen) ANZEIGEN="ja" ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
  shift
done
EMAIL="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
if [[ ! "$EMAIL" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]+$ ]]; then
  echo "Aufruf: bash tools/eingang-token.sh [--anzeigen | --widerrufen] <mitglied@steinerundco.de>" >&2
  exit 2
fi
if [[ "$MODUS" == "erzeugen" && ( ! -t 0 || ! -t 1 ) ]]; then
  echo "Bitte selbst in deinem eigenen Terminal ausführen (nicht über Claude) – sonst landet der Schlüssel in einem Protokoll." >&2
  exit 3
fi
if [[ "$MODUS" == "erzeugen" && "$ANZEIGEN" == "nein" ]] && ! command -v pbcopy >/dev/null 2>&1; then
  echo "pbcopy fehlt (kein Mac?) – mit --anzeigen aufrufen oder den Schlüssel in der Chrome-Erweiterung erzeugen." >&2
  exit 2
fi

# Eine Anweisung: set_config im Unterabfragen-Teil setzt auth.uid() auf das Mitglied, bevor die RPC läuft.
# Kein Mitglied mit dieser Adresse → keine Zeile.
if [[ "$MODUS" == "erzeugen" ]]; then
  AUFRUF="crm.eingang_token_erzeugen('Gmail (Apps Script)')::text"
else
  AUFRUF="crm.eingang_token_widerrufen()::text"
fi
SQL="select $AUFRUF as wert from (select set_config('request.jwt.claim.sub', m.user_id::text, true) from public.members m where m.email = '$EMAIL') s"

ANTWORT="$(bash tools/db-query.sh "$SQL")" || { echo "Datenbank-Aufruf fehlgeschlagen: $ANTWORT" >&2; exit 1; }
WERT="$(printf '%s' "$ANTWORT" | python3 -I -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["wert"] if isinstance(d,list) and d else "")')"
unset ANTWORT

if [[ -z "$WERT" ]]; then
  echo "Kein CRM-Mitglied mit der Adresse $EMAIL gefunden (public.members)." >&2
  exit 1
fi

if [[ "$MODUS" == "widerrufen" ]]; then
  echo "Widerrufen: $WERT Schlüssel von $EMAIL. Das Apps Script bekommt ab jetzt „401 – Schlüssel ungültig“."
  exit 0
fi

if command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$WERT" | pbcopy
  echo ""
  echo "Eingangs-Schlüssel für $EMAIL liegt jetzt in der Zwischenablage (43 Zeichen)."
fi
if [[ "$ANZEIGEN" == "ja" ]]; then
  printf '\nNur JETZT angezeigt, nirgends gespeichert:\n\n    %s\n' "$WERT"
fi
cat <<EOF

Direkt in die Skripteigenschaft CRM_SCHLUESSEL deines Apps Scripts einfügen (ANLEITUNG.md, Schritt 3) –
nicht in Dateien, Chats oder Git. Wer ihn hat, kann im Namen von $EMAIL LinkedIn-Ereignisse ins CRM schreiben.
Ein früherer Schlüssel dieses Mitglieds ist ab sofort ungültig. Danach die Zwischenablage mit etwas anderem überschreiben.

EOF
unset WERT
