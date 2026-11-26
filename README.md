# crm.steinerundco.de

Internes CRM für Steiner & Co. – zwei Personen, ein Board. Seit dem Neustart am 25.11.2026 bewusst einfach: Leads als Karten auf einem Board, Leitfäden zum Kopieren, der E-Mail-Bereich, (seit 26.11.2026 wieder) die KPIs und der Reiter „Ziele“ (OKR). Statische SPA (Vite + React + TypeScript + Tailwind v4) auf Supabase (Schema `crm`).

## Bereiche

| Bereich       | Adresse                                                                   | Was dort passiert                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leads         | `/leads`                                                                  | Board mit vier Listen: Angeschrieben · Gespräch vereinbart · Im Geschäft · Verloren. Jede Person ist eine Karte; Knöpfe oder Ziehen verschieben sie, „Lead hinzufügen“ legt eine neue an. Ein Klick auf die Karte öffnet das Lead-Blatt (`?lead=<id>`, auf jeder Seite).                                                                                                                       |
| Leitfäden     | `/leitfaeden`                                                             | Eigene Texte mit Platzhaltern schreiben, ändern, kopieren. „Löschen“ archiviert nur.                                                                                                                                                                                                                                                                                                           |
| E-Mail        | `/email/kampagnen` · `/email/antworten` · `/email/postfaecher` · `/email` | Kampagnen über eigene Postfächer, Antworten an einem Ort, Postfächer und Einzelmails (Composer unter `/email/verfassen`).                                                                                                                                                                                                                                                                      |
| KPIs          | `/kpis`                                                                   | Zahlen je Person oder fürs Team: Vernetzungen versendet · Angenommen · Angeschrieben · Gespräch vereinbart · Im Geschäft · Verloren, dazu E-Mails gesendet · Antworten – für Monat, Woche, 7 oder 30 Tage, mit Vergleich zum Zeitraum davor. Die Vernetzungen trägt jede Person einmal am Tag von Hand ein („Meine Vernetzungen“), alles andere zählt aus den Board-Zügen.                     |
| Ziele         | `/ziele`                                                                  | OKR: oben die großen Ziele (Jahr, Quartal), darunter die Ziele des Monats mit ihren Key Results – Zielwert für den ganzen Zeitraum, je Woche oder je Tag, fürs Team oder je Person. Die meisten Key Results zählt das CRM selbst (DMs, Vernetzungen, E-Mails, Neukunden), der Rest wird von Hand gezählt; dazu To-dos je Key Result. Balken mit Soll-Strich, Ampel, „Heute“ und „Diese Woche“. |
| Team          | `/team`                                                                   | Je Person eine Karte mit der Zahl ihrer Board-Karten je Liste.                                                                                                                                                                                                                                                                                                                                 |
| Einstellungen | `/einstellungen/<bereich>`                                                | Profil · Passcode · Sperrliste · Feiertage · Export & Backup.                                                                                                                                                                                                                                                                                                                                  |
| Hilfe         | `/hilfe`                                                                  | Neun kurze Themen, durchsuchbar.                                                                                                                                                                                                                                                                                                                                                               |

Alte Adressen (`/heute`, `/pipeline`, `/telefon/…`, `/umsatz`, `/import` …) leiten auf das Board um. `/kpis` ist seit dem 26.11.2026 wieder eine echte Seite, `/ziele` ist am selben Tag neu dazugekommen.

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
- `src/features/<bereich>` – `board` (Leads), `leitfaeden`, `email` (Einzelmails, Composer), `mailing` (Kampagnen, Antworten, Postfächer), `kpis` (Kennzahlen, Tageszähler), `okr` (Reiter „Ziele“: Seite und Rechenregeln), `team`, `einstellungen`, `hilfe`, `auth`. `heute` und `sequenzen` haben keine eigene Seite mehr; dort liegt nur noch, was E-Mail › Fällig und der Composer benutzen.
- `src/components` – Bausteine (`ui`), Tabelle, Aktionen, Toast, Platzhalter-Chips.
- `src/data` – Supabase-Client, Query-Keys, Hooks, RPC-Wrapper. `src/lib` – Format, Werktage, Platzhalter, Gates, Tastatur.
- `src/texte/de.ts` – gemeinsame Wortlaute. `src/styles/tokens.css` – Design-Tokens.
- `supabase/` – Migrationen, Edge Functions, Tests (`seed-privat/` ist ignoriert; SQL-Tests laufen gegen die echte Datenbank und rollen sich zurück, z. B. `bash tools/db-query.sh -f supabase/tests/kpi_test.sql`). `tools/` – Datenbank- und Prüfskripte. `e2e/` – Playwright (nur lokal).

## KPIs

Der KPI-Reiter des alten CRM ist seit dem 26.11.2026 zurück – verkleinert: Board-Zahlen plus zwei Tageszähler, ohne Kanal-Umschalter, Zielwerte und CSV-Export.

- **Datenbank:** Migration `20261126100029_crm_kpis_board.sql` legt die Tabelle `crm.board_laeufe` an (je Karte ein Lauf über das Board: wann sie in welche Liste kam; ein Trigger an `crm.leads` pflegt ihn) und die Sichten `crm.v_board_zaehlung` (Board-Zahlen als einzelne Ereignisse) und `crm.v_kpi_tage`. Migration `20261126100030_crm_kpis_rueckgaengig.sql` ergänzt die Spalte `vorher` (Stand vor dem letzten Zug), damit „Rückgängig“ den Lauf genau wiederherstellt. Migration `20261126100031_crm_kpis_gegenpruefung.sql` stellt die Regeln nach der Gegenprüfung richtig: Leads, deren Eröffnung schon in den alten Sheet-Zahlen steht, zählen auf dem Board nicht noch einmal; ein von Hand zurückgenommener Fehlgriff (zurück in die Liste von davor binnen zehn Minuten) gilt wie „Rückgängig“. Der Reiter liest seine Zahlen aus `crm.v_kpi_tage`: eine Zeile je Person, Tag und Zählerart mit allen acht Zahlen – aus Board, Tageszählern, E-Mail-Versand und den alten Zahlen.
- **Von Hand:** Vernetzungen versendet und angenommen – einmal am Tag, als Zahl des ganzen Tages (`crm.daily_counters` über `crm.set_counter`; erneutes Eintragen ersetzt). Gespeichert wird nur das geänderte Feld, immer für die angemeldete Person.
- **Von selbst:** Karte anlegen = Angeschrieben, „Hat Interesse“ = Gespräch vereinbart, „Im Geschäft“, „Kein Interesse“ = Verloren – am Tag des Klicks, für die Person, der die Karte gehört. Zurückschieben oder „Rückgängig“ nimmt die Zahl wieder heraus; eine Karte vom Board zu nehmen ändert nichts – außer sie wurde gerade erst angelegt (unter zehn Minuten, nur „Angeschrieben“): dann gilt sie als Versehen und zählt nicht.
- **Alte Zahlen:** Die Zahlen bis 24.11.2026 stammen aus dem alten CRM und bleiben als Vergleich sichtbar. Die Monatszähler aus dem alten Sheet-Import (`period = 'monat'`, September und Oktober 2026) zählen nur in der Monatsansicht. In jedem anderen Zeitraum, der einen dieser Monate berührt, bleibt der Vergleich für diese Kennzahlen leer („–“) – die Tageswerte allein wären zu klein. Das gilt für jede Person, auch ohne eigenen Monatszähler (ihre Tageswerte beginnen genauso spät); für sie bleibt auch in der Monatsansicht der Vergleich mit einem dieser Monate leer.
- **Test:** `supabase/tests/kpi_test.sql` prüft die Zählung gegen die echte Datenbank (eine Transaktion, am Ende zurückgerollt).

## Leitfaden an der Karte

In „Lead hinzufügen“ wählt man den benutzten Leitfaden aus (freiwillig; der zuletzt gewählte ist vorgewählt, im Lead-Blatt änderbar). Gespeichert in `crm.leads.board_leitfaden_id` (Migration `20261126100033_crm_board_leitfaden.sql`; `crm.board_karte_anlegen` hat dafür den Parameter `p_leitfaden`). Eine Auswertung je Leitfaden gibt es noch nicht – die Daten dafür entstehen ab jetzt.

## Ziele (OKR)

Seit dem 26.11.2026 führen die Inhaber ihre Ziele im CRM (Reiter „Ziele“, `/ziele`): Ziele für Jahr, Quartal und Monat mit Key Results, dazu To-dos je Key Result. Woche und Tag sind keine eigenen Ziele – die Seite rechnet sie aus dem Zielwert.

- **Datenbank:** Migration `20261126100032_crm_okr.sql` legt vier Tabellen an: `crm.okr_ziele` (ein Ziel mit Ebene `jahr` | `quartal` | `monat` und Zeitraum), `crm.okr_ergebnisse` (Key Results: Zielwert, Takt `zeitraum` | `woche` | `tag`, fürs Team oder je Person, Quelle der Zahl, Faktor), `crm.okr_eintraege` (von Hand gezählter Fortschritt – je Key Result, Person und Tag eine Zeile) und `crm.okr_todos` (To-dos zu einem Key Result). Mitglieder lesen und schreiben alles; ein gelöschtes Ziel nimmt Key Results, Einträge und To-dos mit. Dazu zwei Funktionen: `crm.okr_zaehlen` (+1 bucht auf heute, −1 nimmt vom jüngsten Eintrag der Person weg, nie unter 0) und `crm.okr_monat_uebernehmen` („Aus dem Vormonat übernehmen“: kopiert die Monatsziele samt Key Results in einen Monat, der noch keine Ziele hat – ohne Fortschritt und ohne To-dos).
- **Woher die Zahlen kommen:** Key Results mit einer Quelle aus dem CRM lesen die Tageszeilen von `crm.v_kpi_tage` – dieselbe Sicht wie der KPI-Reiter: DMs (Karten in „Angeschrieben“), Vernetzungen versendet und angenommen (die Tageszahlen aus „Meine Vernetzungen“), Gespräche vereinbart, Neukunden (Karten in „Im Geschäft“), E-Mails gesendet und E-Mail-Antworten. Die alten Monatszähler zählen hier nie. Key Results mit der Quelle `manuell` (z. B. LinkedIn-Posts) summieren ihre Zeilen aus `crm.okr_eintraege`. Der Faktor rechnet die gezählte Zahl um (Neukunden × Kundenwert = Umsatz).
- **Rechenregeln** (`src/features/okr/rechnen.ts`, reine Funktionen): Das Soll ergibt sich aus Zielwert und Takt, verteilt auf die zählenden Tage – Werktage ohne Feiertage, bei E-Mails alle Tage; daraus rechnet die Seite „Heute“ und „Diese Woche“. Die Ampel vergleicht das Ist mit dem Soll bis gestern: „Im Plan“ ab dem abgerundeten Soll, „Knapp“ ab 70 Prozent davon, sonst „Hinten“; „Geschafft“, sobald der Zielwert erreicht ist. Der Fortschritt eines Ziels ist der Durchschnitt seiner Key Results.
- **Live:** Änderungen an den vier Tabellen laden den Reiter auf dem anderen Gerät neu (`src/data/realtime.ts`). Solange der Reiter selbst schreibt, wartet Realtime – der letzte Schreibvorgang lädt neu.
- **Test:** `supabase/tests/okr_test.sql` prüft Anlegen, Zählen, Monat übernehmen, Löschen und Rechte gegen die echte Datenbank (eine Transaktion, am Ende zurückgerollt): `bash tools/db-query.sh -f supabase/tests/okr_test.sql`.

## Archiv

Beim Neustart wurde nichts gelöscht.

- **Code:** Der Tag `archiv-crm-v1` und der Branch `archiv/crm-v1` enthalten das vollständige alte CRM (Heute, Pipeline, Telefon, KPIs, Import, Recherche, Browser-Erweiterung …). Eine alte Datei lesen: `git show archiv-crm-v1:<pfad>`. Die KPIs sind seit dem 26.11.2026 verkleinert zurück (Abschnitt „KPIs“); der alte, große KPI-Reiter mit Kanälen, Zielwerten und CSV-Export liegt weiter nur im Tag.
- **Daten:** Das Datenbank-Schema `crm_archiv` ist eine eingefrorene Kopie aller Tabellen vom 25.11.2026. Mitglieder haben darauf keinen Zugriff.
- **Alte Leads:** Sie stehen weiter in `crm.leads`, haben aber `board_liste = null` und erscheinen deshalb nicht auf dem Board. Wer eine dieser Personen mit ihrem LinkedIn-Link neu hinzufügt, bekommt denselben Lead zurück.
- **Alte Leitfäden:** Sie sind archiviert (`crm.templates.archiviert_at`) und erscheinen nicht mehr unter Leitfäden.
- **Recherche-Dienst:** Wer ihn auf seinem Rechner eingerichtet hatte, schaltet ihn dort einmal ab – sonst fragt er weiter alle zehn Sekunden die Datenbank ab. Die Adresse `crm.steinerundco.de/recherche-dienst/…` gibt es seit dem Neustart nicht mehr, die Skripte liegen im Tag.
  - Mac: `git show archiv-crm-v1:public/recherche-dienst/einrichten.sh | bash -s -- --aus`. Von Hand: `launchctl bootout gui/$(id -u)/de.steinerundco.recherche-dienst`, die Datei `~/Library/LaunchAgents/de.steinerundco.recherche-dienst.plist` löschen, `security delete-generic-password -s steinerundco-recherche -a dienst`.
  - Windows: `einrichten.ps1` aus demselben Tag mit `-Aus` ausführen. Von Hand: im Autostart-Ordner `Steiner-Recherche-Dienst.vbs` und `Steiner-Recherche-Dienst.cmd` löschen, `%LOCALAPPDATA%\steinerundco-recherche\schluessel.dpapi` löschen, neu anmelden.
