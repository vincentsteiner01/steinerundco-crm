# Foundation-Wünsche aus M6 (Leitfäden)

Stand Integration M1–M8 (15.10.2026, Lead-Agent). `features/leitfaeden/daten/` ist gelöscht.

- **erledigt** – `src/data/templates.ts → useTemplateLoeschen()`.
- **erledigt** – `src/data/activities.ts → useTemplateActivities(templateId, von, bis)` (+ `VORLAGE_SENDE_TYPEN`, `VORLAGE_ANTWORT_TYPEN`); die Zeitgrenzen kommen jetzt aus `zeitraumGrenzen` (Europe/Berlin) statt eines festen `+02:00` (Winterzeit-Fehler behoben). Das 8-Wochen-Fenster rechnet `helfer.statistikVon`.
- **erledigt** – `src/lib/useMediaQuery.ts` (`useMediaQuery`, `useIstTelefon`, `MEDIEN`) ersetzt sechs Kopien (AppShell, Heute, Leitfäden, KPIs, Telefon, Import, DataTable).
- **erledigt** – Fixture `src/test/fixtures/leitfadenPhasen.json` (vorher `features/leitfaeden/leitfadenPhasen.fixture.json`).
- **erledigt** – `src/app/pfade.ts → PFADE.leitfadenNeu(kanal?)`; Palette, Übersicht und Detail nutzen ihn.
