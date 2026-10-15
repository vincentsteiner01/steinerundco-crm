# crm.steinerundco.de

CRM für Steiner & Co. – zwei Personen, drei Kanäle (LinkedIn · Telefon · E-Mail), eine „Heute“-Queue. Statische SPA (Vite + React + TypeScript + Tailwind v4) auf Supabase (Schema `crm`). Die eine Quelle für alles Fachliche ist `spec/BAUPLAN.md` (liegt im Projekt-Scratchpad, nicht im Repo).

## Start

```bash
nvm use                 # Node 24 (.nvmrc)
npm ci
# .env.development ist committet (öffentliche Werte); optional: cp .env.example .env.local für lokale Overrides
npm run dev             # http://127.0.0.1:8768
```

Weitere Scripts: `npm run typecheck` · `npm run lint` · `npm run test` / `test:ci` · `npm run build` (dann `node tools/pruefe-bundle.mjs dist`) · `npm run e2e` (nur lokal, Passcode aus dem Schlüsselbund: `E2E_PASSCODE="$(security find-generic-password -s crm-e2e -w)" npm run e2e`).

## Betrieb

- Datenbank: `npm run db:migrate:dry` zeigt offene Migrationen, `npm run db:migrate` spielt sie ein (Management-API, Token aus dem macOS-Schlüsselbund der Supabase CLI), `npm run db:query -- "select now()"` führt SQL aus. Nach jeder Migration `npm run types` (erzeugt `src/types/database.ts`, wird committet).
- Deploy: Push auf `main` → GitHub Action baut, prüft Budget und force-pusht `dist/` als Orphan-Branch `live` → Plesk zieht `live` als Docroot von `crm.steinerundco.de`.
- Keep-alive (täglich `rpc/ping`) und verschlüsseltes Wochen-Backup laufen als Actions (`.github/workflows/`). Secrets/Variablen: `SUPABASE_PUBLISHABLE_KEY` (Variable), `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE` (Secrets).
- Runbook (Supabase konfigurieren, Migrationen, Passcodes, GitHub, erster Login): BAUPLAN § 9.

## Struktur

`src/app` (Router, Shell, Palette, Tasten) · `src/components` (Primitive, Tabelle, Peek, Aktionen, Toast) · `src/data` (Supabase-Client, Query-Keys, Hooks, RPC-Wrapper) · `src/lib` (Format, Werktage, Platzhalter, Stufen, Gates, Tastatur) · `src/features/<modul>` (ein Ordner je Modul M1–M8, Seiten + `public.ts` + `befehle.ts` + `tasten.ts` + `ABNAHME.md`) · `src/texte/de.ts` (gemeinsame Wortlaute) · `supabase/` (Migrationen, Tests; `seed-privat/` ist ignoriert).

Design-Tokens und Komponentenmaße: `src/styles/tokens.css` (Kopie von `design/tokens.css`), visueller Vertrag `design/reference.html`.
