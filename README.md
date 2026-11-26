# crm.steinerundco.de

Internes CRM für Steiner & Co. – zwei Personen, ein Board. Seit dem Neustart am 25.11.2026 bewusst einfach: Leads als Karten auf einem Board, Leitfäden zum Kopieren und der E-Mail-Bereich. Statische SPA (Vite + React + TypeScript + Tailwind v4) auf Supabase (Schema `crm`).

## Bereiche

| Bereich       | Adresse                                                                   | Was dort passiert                                                                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Leads         | `/leads`                                                                  | Board mit vier Listen: Angeschrieben · Gespräch vereinbart · Im Geschäft · Verloren. Jede Person ist eine Karte; Knöpfe oder Ziehen verschieben sie, „Lead hinzufügen“ legt eine neue an. Ein Klick auf die Karte öffnet das Lead-Blatt (`?lead=<id>`, auf jeder Seite). |
| Leitfäden     | `/leitfaeden`                                                             | Eigene Texte mit Platzhaltern schreiben, ändern, kopieren. „Löschen“ archiviert nur.                                                                                                                                                                                     |
| E-Mail        | `/email/kampagnen` · `/email/antworten` · `/email/postfaecher` · `/email` | Kampagnen über eigene Postfächer, Antworten an einem Ort, Postfächer und Einzelmails (Composer unter `/email/verfassen`).                                                                                                                                                |
| Team          | `/team`                                                                   | Je Person eine Karte mit der Zahl ihrer Board-Karten je Liste.                                                                                                                                                                                                           |
| Einstellungen | `/einstellungen/<bereich>`                                                | Profil · Passcode · Sperrliste · Feiertage · Export & Backup.                                                                                                                                                                                                            |
| Hilfe         | `/hilfe`                                                                  | Sieben kurze Themen, durchsuchbar.                                                                                                                                                                                                                                       |

Alte Adressen (`/heute`, `/pipeline`, `/telefon/…`, `/kpis`, `/import` …) leiten auf das Board um.

## Start

```bash
nvm use                 # Node 24 (.nvmrc)
npm ci
# .env.development ist committet (öffentliche Werte); optional: cp .env.example .env.local für lokale Overrides
npm run dev             # http://127.0.0.1:8768
```

Weitere Scripts: `npm run typecheck` · `npm run lint` · `npm run test` / `test:ci` · `npm run build` (dann `node tools/pruefe-bundle.mjs dist`) · `npm run e2e` (nur lokal, Passcode aus dem Schlüsselbund: `E2E_PASSCODE="$(security find-generic-password -s crm-e2e -w)" npm run e2e`).

Vor dem Push prüft `tools/pruefe-personendaten.py`, dass keine echten Personendaten im Repository landen (einmalig einrichten: `git config core.hooksPath tools/hooks`).

## Betrieb

- Datenbank: `npm run db:migrate:dry` zeigt offene Migrationen, `npm run db:migrate` spielt sie ein (Management-API, Token aus dem macOS-Schlüsselbund der Supabase CLI), `npm run db:query -- "select now()"` führt SQL aus. Nach jeder Migration `npm run types` (erzeugt `src/types/database.ts`, wird committet).
- Deploy: Push auf `main` → GitHub Action baut, prüft Budget und force-pusht `dist/` als Orphan-Branch `live` → Plesk zieht `live` als Docroot von `crm.steinerundco.de`.
- Keep-alive (täglich `rpc/ping`) und verschlüsseltes Wochen-Backup laufen als Actions (`.github/workflows/`). Secrets/Variablen: `SUPABASE_PUBLISHABLE_KEY` (Variable), `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE` (Secrets).
- Runbook (Supabase konfigurieren, Migrationen, Passcodes, GitHub, erster Login): BAUPLAN § 9 – das alte Planungsdokument liegt nicht im Repository. Was heute gebraucht wird, steht in den Punkten darüber; Passcodes setzt `tools/passcode-setzen.sh`.

## Struktur

- `src/app` – Router, Hülle (Sidebar, Icon-Rail, Tab-Leiste), Navigation, Pfade.
- `src/features/<bereich>` – `board` (Leads), `leitfaeden`, `email` (Einzelmails, Composer), `mailing` (Kampagnen, Antworten, Postfächer), `team`, `einstellungen`, `hilfe`, `auth`. `heute` und `sequenzen` haben keine eigene Seite mehr; dort liegt nur noch, was E-Mail › Fällig und der Composer benutzen.
- `src/components` – Bausteine (`ui`), Tabelle, Aktionen, Toast, Platzhalter-Chips.
- `src/data` – Supabase-Client, Query-Keys, Hooks, RPC-Wrapper. `src/lib` – Format, Werktage, Platzhalter, Gates, Tastatur.
- `src/texte/de.ts` – gemeinsame Wortlaute. `src/styles/tokens.css` – Design-Tokens.
- `supabase/` – Migrationen, Edge Functions, Tests (`seed-privat/` ist ignoriert). `tools/` – Datenbank- und Prüfskripte. `e2e/` – Playwright (nur lokal).

## Archiv

Beim Neustart wurde nichts gelöscht.

- **Code:** Der Tag `archiv-crm-v1` und der Branch `archiv/crm-v1` enthalten das vollständige alte CRM (Heute, Pipeline, Telefon, KPIs, Import, Recherche, Browser-Erweiterung …). Eine alte Datei lesen: `git show archiv-crm-v1:<pfad>`.
- **Daten:** Das Datenbank-Schema `crm_archiv` ist eine eingefrorene Kopie aller Tabellen vom 25.11.2026. Mitglieder haben darauf keinen Zugriff.
- **Alte Leads:** Sie stehen weiter in `crm.leads`, haben aber `board_liste = null` und erscheinen deshalb nicht auf dem Board. Wer eine dieser Personen mit ihrem LinkedIn-Link neu hinzufügt, bekommt denselben Lead zurück.
- **Alte Leitfäden:** Sie sind archiviert (`crm.templates.archiviert_at`) und erscheinen nicht mehr unter Leitfäden.
- **Recherche-Dienst:** Wer ihn auf seinem Rechner eingerichtet hatte, schaltet ihn dort einmal ab – sonst fragt er weiter alle zehn Sekunden die Datenbank ab. Die Adresse `crm.steinerundco.de/recherche-dienst/…` gibt es seit dem Neustart nicht mehr, die Skripte liegen im Tag.
  - Mac: `git show archiv-crm-v1:public/recherche-dienst/einrichten.sh | bash -s -- --aus`. Von Hand: `launchctl bootout gui/$(id -u)/de.steinerundco.recherche-dienst`, die Datei `~/Library/LaunchAgents/de.steinerundco.recherche-dienst.plist` löschen, `security delete-generic-password -s steinerundco-recherche -a dienst`.
  - Windows: `einrichten.ps1` aus demselben Tag mit `-Aus` ausführen. Von Hand: im Autostart-Ordner `Steiner-Recherche-Dienst.vbs` und `Steiner-Recherche-Dienst.cmd` löschen, `%LOCALAPPDATA%\steinerundco-recherche\schluessel.dpapi` löschen, neu anmelden.
