# Abnahme M0 – Foundation

Stand 15.10.2026 · Integration (Lead-Agent) · Quelle BAUPLAN § 3.1.12, ux § 8.1/8.2/8.14 · Browser für die automatischen Prüfungen: Chromium 1.64 (Playwright, headless), jsdom (Vitest). Manuelle Prüfungen in Chrome/Safari stehen noch aus (unten „nicht prüfbar“).

## 1. Integration (was in diesem Schritt passiert ist)

- Shell ↔ Daten-Schicht: `RealtimeSync` in `app/providers.tsx` (`useRealtimeSync`, Kanal `crm:sync`, Status → Realtime-Punkt); Sidebar/Icon-Rail/Tab-Leiste zählen über `data/nav.ts → useNavZaehler` (einzige Implementierung, kein Stub mehr); Palette-Kontext `me` aus `useMe()` (View `crm.members`, Fallback Auth-Member bis geladen); Suchgruppen der Palette gefüllt (`app/befehle.ts → PALETTE_QUELLEN`: Leads = `useLeadSuche` mit Phase-Chip, Enter = Peek, ⌘↵ = Vollansicht; Leitfäden = `useTemplates`; Ansichten = `app/ansichten.ts`, 15 System-Keys aus ux § 3.2.3 → `/leads?ansicht=<key>`); `?`-Liste aus `app/tasten.ts`; `PeekOutlet` rendert `components/peek/PeekPanel` + `features/leads/public → LeadPanel` und hört auf `crm:peek` (Palette, Realtime-Toast).
- Auth: `authStore.uebernehmen` setzt bei vorhandener Session `laden` statt `anonym`, bis die Mitgliedschaft geprüft ist – kein Rücksprung nach `/anmelden` direkt nach dem Login (`?von=` bleibt wie § 1.5 Nr. 31).
- Duplikate entfernt: `components/ui/_datum.ts` (Übergangs-Helfer) gelöscht; Chip, DatePicker, SeitenKopf, InlineEdit, Später-Optionen, Wiedervorlage, Anmelden nutzen `lib/format`, `lib/zeit` (neu exportiert: `monatePlus`, `naechsterWochentag`), `lib/datumEingabe`, `lib/stufen`. Alle `TODO m0:`-Marker sind aufgelöst; die verbliebenen `STUB (M0)`-Marker stehen nur in `features/*` und sind die Verträge für M1–M8.
- Bundle (E22, F-02): initiales JS lag bei 221,4 kB. Zwei Maßnahmen: `data/env.ts` prüft ohne zod (Konflikt § 3.1.6 „zod“ ↔ E22, Kommentar in der Datei; zod bleibt Abhängigkeit für M7) und `PhoneTopbar` (Radix-Dropdown) wird nur unter 768 px geladen (`AppShell`, `useMediaQuery`). Jetzt 207,1 kB – 13 kB Luft für Shell-Änderungen.
- Tests ergänzt: `texte.test.ts` prüft zusätzlich `\d-\d` (Bereiche mit Halbgeviertstrich) und `\d %` (U+202F); `CommandPalette.test.tsx` läuft mit QueryClientProvider. Lint-Regel § 3.0 Nr. 12 (keine `li_/tel_/em_`-Literale, kein `enroll('…')` in `src/features/**`) steht in `lib/keyboard.verboten.test.ts`.
- E2E: `e2e/global-setup.ts` wirft ohne `E2E_PASSCODE` nicht mehr, sondern schreibt einen leeren `storageState`; `e2e/anmelden.spec.ts` prüft zwei Kacheln, `aria-pressed`, falschen Passcode → Fehlertext; `playwright.config.ts` unverändert (§ 3.1.1). `tests/zugriff.sh` (Anhang B, § 9.5 Nr. 4) neu.
- Screens: `scratchpad/crm/screenshots/m0-anmelden-{desktop,mobile}.png` gegen `reference.html#login` (dort `reference-login-*.png`). Deckungsgleich bis auf: Dateline in Langform „Donnerstag, 15. Oktober 2026 · KW 42“ (ux § 6.4 gilt vor dem Mock, Kommentar in `Anmelden.tsx`) und Lime-Fokusrahmen am automatisch fokussierten Passcode-Feld (Fokuszustand, gewollt). 390 px: kein horizontaler Scroll, `kbd` auf Touch ausgeblendet wie im Mock.

## 2. F-01 … F-11 (BAUPLAN § 3.1.12)

| ID   | Status        | Nachweis / Grund                                                                                                                                                            |
| ---- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | ja            | `npm run build` → `dist/` mit `.htaccess`, `sw.js`, `manifest.webmanifest`, `workbox-*.js`, 42 Precache-Einträge                                                            |
| F-02 | ja            | `node tools/pruefe-bundle.mjs dist`: JS 207,1 kB / 220 · CSS 9,6 kB / 30 · größter Routen-Chunk 8,5 kB / 80 · Fonts 112,9 kB / 180 – „Bundle-Budget eingehalten.“           |
| F-03 | ja            | `bash tools/db-migrate.sh --dry-run` → viermal „bereits“, „fertig“; zweiter Lauf der Migrationen laut DB-Agent fehlerfrei (PGlite + live)                                   |
| F-04 | ja            | `npm run types` heute erneut ausgeführt: kein Diff zu `src/types/database.ts` (114 527 Bytes)                                                                               |
| F-05 | ja (Code)     | alle 18 Seiten-Stubs rendern `SeitenKopf` + `EmptyState` mit `LEER.kommtMit('M<N>')`; `public.ts`-Stubs „Kommt mit M<N>.“; im Browser erst nach gesetztem Passcode sichtbar |
| F-06 | ja (DB-Agent) | `supabase/tests/undo.sql` live grün (eine Transaktion, `rollback`); hier nicht erneut gegen das Live-Projekt gefahren                                                       |
| F-07 | ja            | `POST rest/v1/rpc/ping` mit Publishable Key, ohne Session → HTTP 200 `"pong"`; `GET rest/v1/leads` anon → 401                                                               |
| F-08 | nicht prüfbar | manuelle Prüfung jeder ⌘/⌥-Kombination in Chrome **und** Safari fehlt; Vorlage `src/app/TASTEN-PRUEFUNG.md` liegt bereit (Lead/Vincent, ≈ 10 min)                           |
| F-09 | ja (DB-Agent) | `supabase/tests/gates.sql` live grün                                                                                                                                        |
| F-10 | ja (DB-Agent) | `supabase/tests/gates.sql` (Firmensperre) live grün; Runbook § 9.2 (Enrollments der gesperrten Firma stoppen) noch offen → Lead                                             |
| F-11 | ja (DB-Agent) | `supabase/tests/rueckruf.sql` live grün                                                                                                                                     |

## 3. L-01 … L-07 (ux § 8.1, mit § 1.5 Nr. 3/4/31/39)

| ID                 | Status        | Nachweis / Grund                                                                                                                                                    |
| ------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-01 (`/anmelden`) | ja            | Playwright: Überschrift „Wer bist du?“, Kacheln Vincent/Mike sichtbar, Klick setzt `aria-pressed`; `V`/`M` über `useHotkeys` + Fokus ins Feld (`Anmelden.test.tsx`) |
| L-02               | ja            | `Anmelden.test.tsx`: 9 Zeichen → „Mindestens 10 Zeichen.“ ohne `signInWithPassword`-Aufruf                                                                          |
| L-03               | ja            | Playwright gegen das Live-Projekt: falscher Passcode → „Passcode stimmt nicht – versuch es nochmal.“, Text bleibt im Feld (`Anmelden.test.tsx`)                     |
| L-04               | ja            | `Anmelden.test.tsx`: 5 Fehlversuche → Button „Nochmal in 30 s“, Countdown, danach frei                                                                              |
| L-05               | nicht prüfbar | Verhalten gebaut (`bleibenStorage`, `data/supabase.test.ts` grün), echter Browser-Neustart braucht einen gesetzten Passcode (§ 9.3)                                 |
| L-06 (`?von=`)     | ja            | `RequireAuth` → `/anmelden?von=%2Fleads%3Flead%3D42`; `Anmelden.test.tsx`: Rücksprung, `//evil` und `https://…` → `/heute`                                          |
| L-07               | ja            | `localStorage['crm.person']`, Fokus im Feld (`Anmelden.test.tsx`)                                                                                                   |

## 4. S-01 … S-07 (ux § 8.2; S-05 Präsenz = v1.1 Nr. 6, S-08 = v1.1 Nr. 13 – beide nicht Teil von M0)

| ID                | Status     | Nachweis / Grund                                                                                                                                                                                                                                |
| ----------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-01              | ja (Shell) | alle Routen aus § 3.1.4 im Router, `*` → „Seite nicht gefunden“ mit Link zu Heute; Dev-Server liefert `/anmelden` und `/heute` als SPA-Hülle (HTTP 200). Rendern hinter `RequireAuth` erst mit Passcode prüfbar                                 |
| S-02              | ja (Test)  | `keyboard.test.tsx`: Akkorde 800 ms, in Eingabefeldern inaktiv; `GlobaleTasten` bindet G H/L/P/T/M/K/F/I/E; < 100 ms im Browser noch nicht gemessen                                                                                             |
| S-03              | ja         | `ShortcutHilfe` aus `app/tasten.ts` (globale + alle `features/*/tasten.ts`), durchsuchbar; `keyboard.verboten.test.ts` prüft jede Registry-Taste gegen `VERBOTEN`                                                                               |
| S-04              | ja (Code)  | `useNavZaehler`: heute = `faellig` (inkl. überfällig) der angemeldeten Person aus `v_today_queue`; Realtime invalidiert `qk.nav` bei leads/enrollments/tasks (`realtime.test.ts`); 2-s-Messung erst mit zwei angemeldeten Geräten (§ 9.5 Nr. 2) |
| S-05              | –          | v1.1 (Präsenz), kein M0-Kriterium                                                                                                                                                                                                               |
| S-06 (nur Banner) | ja         | `OfflineBanner` über `navigator.onLine` + `online`/`offline`-Events, 36 px, Amber-Punkt; Mutationen offline sperren liegt bei den Modulen (§ 1.5 Nr. 11)                                                                                        |
| S-07              | ja (Code)  | Palette-Treffer → `peekOeffnen` → `crm:peek` → `PeekOutlet` setzt `?lead=`; Esc schließt (`PeekPanel.test.tsx`); Cursor-Wiederherstellung ist Sache der Liste (M1/M2)                                                                           |

## 5. TY-01 … TY-06 (ux § 8.14, E26)

| ID    | Status           | Nachweis / Grund                                                                                                                                       |
| ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TY-01 | ja               | `texte.test.ts`: kein `"`/`'` in `de.ts` (Lint über alle Strings inkl. Funktionen)                                                                     |
| TY-02 | ja               | `texte.test.ts`: kein `-`, `--`, `...`, neu auch kein `\d-\d`                                                                                          |
| TY-03 | ja (Komponenten) | `tnum` + `font-mono` in Zählern, Chips, Dateline, Tabellenzellen (`SpaltenMeta.mono`); `fmtProzent` mit U+202F (`format.test.ts`), `de.ts` ohne `\d %` |
| TY-04 | ja               | `fmtDatumKurz` → `Mi 14.10.`, `fmtDatum` → `14.10.2026`, `fmtZeit` → `09:41` (`format.test.ts`)                                                        |
| TY-05 | ja               | `texte.test.ts`: kein `!`, kein „erfolgreich“; keine Emojis im Code (Review)                                                                           |
| TY-06 | ja               | `texte.test.ts`: kein „OK“, „Snooze“, „Owner“; Buttons der Shell: Anmelden, Abmelden, Schließen, Rückgängig, Erneut versuchen                          |

## 6. FOUNDATION-WUNSCH

Zum M0-Zeitpunkt keine Datei vorhanden. Nach M1–M8 (Integration 15.10.2026): alle Wünsche in den neun `src/features/*/FOUNDATION-WUNSCH.md` sind mit Status markiert (erledigt · bewusst nicht · offen/Migration) – Übersicht und Gesamtabnahme in `src/features/ABNAHME-GESAMT.md`.

## 7. Prüfläufe (15.10.2026, Node 24.22.0)

- `npm run typecheck` → ohne Befund
- `npm run lint` → ohne Befund (`oxlint --deny-warnings src`)
- `npm run test:ci` → 25 Dateien, 258 Tests grün
- `npm run build` → ok; `node tools/pruefe-bundle.mjs dist` → „Bundle-Budget eingehalten.“ (JS 207,1 kB)
- `npx playwright test --project=chromium-desktop` → 1 passed (falscher Passcode), 1 skipped (`E2E_PASSCODE` fehlt)
- `bash tools/db-migrate.sh --dry-run` → 4× „bereits“ · `npm run types` → kein Diff · `rpc/ping` anon → 200

## 8. Was der Lead jetzt tun muss

1. **Commit** `git add -A && git commit -m "M0 Foundation"` (§ 9.4). Vorher kurz prüfen: `git status` zeigt nur Repo-Dateien; `e2e/.auth/`, `test-results/`, `dist/`, `supabase/seed-privat/` sind ignoriert.
2. **Passcodes** (Vincent, § 9.3): `bash tools/passcode-setzen.sh vincent@steinerundco.de` und `… mike@steinerundco.de` – erst danach sind L-05, S-01 (hinter RequireAuth), S-04 (2 s) und der zweite E2E-Fall prüfbar (`E2E_PASSCODE="$(security find-generic-password -s crm-e2e -w)" npm run e2e`).
3. **Runbook § 9.2 Rest**: Enrollments der gesperrten Firma stoppen (Update-Statement + Kontrolle `= 0`), Sheet-Volltexte als `import_batches`-Zeile ablegen (§ 1.5 Nr. 46), Block B (B1–B6) mit Vincent/Mike klären.
4. **GitHub** (§ 9.4): `gh repo create vincentsteiner01/steinerundco-crm --public --source . --remote origin --push`, Workflow-Berechtigungen, `SUPABASE_PUBLISHABLE_KEY` als Variable, Secret Scanning, ersten Deploy-Lauf starten (erzeugt Branch `live`); später `SUPABASE_DB_URL` + `BACKUP_PASSPHRASE` als Secrets (Vincent liefert Pooler-String).
5. **Plesk/IONOS** (Vincent, § 9.6 Nr. 1–6): DNS `crm` → 217.160.186.173, Subdomain mit Docroot `crm.steinerundco.de`, Let’s Encrypt + 301, nginx-Statik **aus** (sonst keine CSP-Header), Git-Deploy aus Branch `live`, Webhook in GitHub. Danach `bash tests/zugriff.sh https://crm.steinerundco.de`.
6. **F-08** manuell in Chrome und Safari durchgehen und `src/app/TASTEN-PRUEFUNG.md` ausfüllen (Browser, Version, Datum).
7. **Abnahme § 9.5** nach dem ersten Login: Queue-Zahlen (Antworten 3 · Überfällig ≈ 21 · Heute ≈ 43), Realtime auf zwei Geräten, Passcode ändern, Voll-Backup, PWA auf dem iPhone.
8. Beim Hochziehen von M1–M8: Budget im Blick behalten (13 kB Luft im initialen JS; alles, was in `app/shell/*` oder `providers.tsx` neu importiert wird, zählt), `PALETTE_QUELLEN`-Verträge (`ausfuehren(ctx, vollansicht)`) und `SYSTEM_ANSICHTEN`-Keys mit M2 abgleichen.
