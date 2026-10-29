#!/bin/bash
# Recherche-Dienst einrichten (LinkedIn-Recherche im CRM, mit ChatGPT): lädt den Dienst von crm.steinerundco.de, legt den
# persönlichen Dienst-Schlüssel in den Schlüsselbund und lässt ihn per launchd bei jeder Anmeldung starten. Den Befehl mit
# Schlüssel erzeugt das CRM (Laufseite → „Recherche-Dienst einrichten“).
#
#   curl -fsSL https://crm.steinerundco.de/recherche-dienst/einrichten.sh | bash -s -- <dienst-schlüssel>
#   curl -fsSL https://crm.steinerundco.de/recherche-dienst/einrichten.sh | bash -s -- --aus      stoppen und entfernen
#
# Voraussetzungen: ChatGPT-App für Mac (bringt Codex und Node mit), Chrome mit der Erweiterung „ChatGPT for Chrome“.
set -euo pipefail

CRM="${CRM_URL:-https://crm.steinerundco.de}"
LABEL="de.steinerundco.recherche-dienst"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BASIS="$HOME/Library/Application Support/steinerundco-recherche"
LOGS="$HOME/Library/Logs/steinerundco-recherche"
ZIEL="gui/$(id -u)"
APP="/Applications/ChatGPT.app/Contents/Resources"

stoppen() {
  launchctl bootout "$ZIEL/$LABEL" 2>/dev/null || true
  # bootout kehrt sofort zurück; der alte Dienst meldet seine Agenten noch ab
  for _ in $(seq 1 30); do launchctl print "$ZIEL/$LABEL" >/dev/null 2>&1 || break; sleep 0.5; done
}

if [[ "${1:-}" == "--aus" ]]; then
  stoppen
  rm -f "$PLIST"
  security delete-generic-password -s steinerundco-recherche -a dienst >/dev/null 2>&1 || true
  echo "Recherche-Dienst gestoppt und entfernt."
  exit 0
fi

SCHLUESSEL="${1:-}"
[[ "$SCHLUESSEL" =~ ^rd_[0-9a-f]{64}$ ]] || { echo "Bitte den vollständigen Befehl aus dem CRM verwenden (Dienst-Schlüssel fehlt)." >&2; exit 2; }

NODE="$APP/cua_node/bin/node"
[[ -x "$NODE" ]] || NODE="$(command -v node || true)"
CODEX="$APP/codex-cli/bin/codex"
[[ -x "$CODEX" ]] || CODEX="$(command -v codex || true)"
if [[ -z "$NODE" || -z "$CODEX" ]]; then
  echo "Die ChatGPT-App für Mac fehlt: https://openai.com/chatgpt/download – installieren, anmelden, dann diesen Befehl erneut ausführen." >&2
  exit 3
fi

mkdir -p "$BASIS/arbeitsordner" "$LOGS" "$HOME/Library/LaunchAgents"
for f in dienst.mjs crm-mcp.mjs gemeinsam.mjs verbindung.json; do
  curl -fsSL "$CRM/recherche-dienst/$f" -o "$BASIS/$f.neu"
  mv "$BASIS/$f.neu" "$BASIS/$f"
done
printf '{ "type": "module" }\n' > "$BASIS/package.json"
security add-generic-password -U -s steinerundco-recherche -a dienst -w "$SCHLUESSEL"

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
    <key>CODEX_BIN</key><string>$CODEX</string>
    <key>RECHERCHE_PROBE</key><string>${RECHERCHE_PROBE:-0}</string>
    <key>PATH</key><string>$(dirname "$NODE"):/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LOGS/dienst.log</string>
  <key>StandardErrorPath</key><string>$LOGS/dienst.log</string>
</dict>
</plist>
EOF

stoppen
launchctl bootstrap "$ZIEL" "$PLIST"
echo "Recherche-Dienst läuft$([[ "${RECHERCHE_PROBE:-0}" == 1 ]] && echo ' (Probebetrieb)'). Im CRM steht gleich „Recherche-Dienst verbunden“."
if ! grep -qs "linkedin.com" "$HOME/.codex/browser/config.toml"; then
  echo
  echo "Noch einmalig nötig: In der ChatGPT-App bei Codex schreiben „Öffne https://www.linkedin.com/feed/ in Chrome“"
  echo "und linkedin.com dauerhaft erlauben. Sonst darf der Agent LinkedIn nicht öffnen."
fi
