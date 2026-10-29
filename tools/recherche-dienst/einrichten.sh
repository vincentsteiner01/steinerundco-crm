#!/usr/bin/env bash
# Richtet den Recherche-Dienst auf diesem Mac ein: launchd startet ihn bei der Anmeldung und nach einem Absturz neu.
# Dienst und Regeln werden nach ~/Library/Application Support/steinerundco-recherche kopiert (launchd darf ~/Documents nicht
# ohne Freigabe lesen) – nach Änderungen an regeln.ts deshalb erneut ausführen.
#
#   bash tools/recherche-dienst/einrichten.sh <member-id>           einrichten oder aktualisieren
#   RECHERCHE_PROBE=1 bash tools/recherche-dienst/einrichten.sh …   Probebetrieb: Agenten lesen nur die Laufseite
#   bash tools/recherche-dienst/einrichten.sh --aus                 stoppen und entfernen
#
# Voraussetzungen: Supabase CLI angemeldet (Schlüsselbund), Claude-Desktop-App, Claude-Erweiterung in Chrome.
set -euo pipefail

LABEL="de.steinerundco.recherche-dienst"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BASIS="$HOME/Library/Application Support/steinerundco-recherche"
LOGS="$HOME/Library/Logs/steinerundco-recherche"
ZIEL="gui/$(id -u)"

if [[ "${1:-}" == "--aus" ]]; then
  launchctl bootout "$ZIEL/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Recherche-Dienst gestoppt und entfernt."
  exit 0
fi

MEMBER="${1:-}"
[[ "$MEMBER" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] || {
  echo "Aufruf: einrichten.sh <member-id> | --aus" >&2
  exit 2
}
NODE="$(command -v node)" || { echo "node nicht gefunden" >&2; exit 3; }
HIER="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$BASIS/arbeitsordner" "$LOGS" "$HOME/Library/LaunchAgents"
cp "$HIER/dienst.mjs" "$BASIS/dienst.mjs"
cp "$HIER/../../src/features/recherche/regeln.ts" "$BASIS/regeln.ts"
printf '{ "type": "module" }\n' > "$BASIS/package.json"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$BASIS/dienst.mjs</string></array>
  <key>WorkingDirectory</key><string>$BASIS</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>RECHERCHE_MEMBER</key><string>$MEMBER</string>
    <key>RECHERCHE_PROBE</key><string>${RECHERCHE_PROBE:-0}</string>
    <key>RECHERCHE_MODELL</key><string>${RECHERCHE_MODELL:-opus}</string>
    <key>RECHERCHE_BUDGET_USD</key><string>${RECHERCHE_BUDGET_USD:-40}</string>
    <key>PATH</key><string>$(dirname "$NODE"):/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LOGS/dienst.log</string>
  <key>StandardErrorPath</key><string>$LOGS/dienst.log</string>
</dict>
</plist>
EOF

launchctl bootout "$ZIEL/$LABEL" 2>/dev/null || true
# bootout kehrt sofort zurück; der alte Dienst meldet seine Agenten noch ab – erst danach neu laden
for _ in $(seq 1 30); do launchctl print "$ZIEL/$LABEL" >/dev/null 2>&1 || break; sleep 0.5; done
launchctl bootstrap "$ZIEL" "$PLIST"
echo "Recherche-Dienst läuft$([[ "${RECHERCHE_PROBE:-0}" == 1 ]] && echo ' (Probebetrieb)'). Protokoll: $LOGS/dienst.log"
