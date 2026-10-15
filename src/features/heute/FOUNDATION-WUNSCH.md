# FOUNDATION-WUNSCH – M1 Heute + Sequenzen

Stand Integration M1–M8 (15.10.2026, Lead-Agent).

- **erledigt** – `lib/keyboard.ts → useHotkeys`: Akkorde werden über `/\S\s+\S/` erkannt, `space` (= `' '`) feuert. `useQueueHotkeys.ts` bindet Space und Esc wieder über `useHotkeys` (eigener Listener entfernt); `DataTable` ebenso.
- **erledigt** – `components/ui/Stepper.tsx`: Esc verwirft die Eingabe selbst (`preventDefault`, kein `onSetzen`, Feld verlassen) – `useHotkeys` sieht das Event nicht mehr.
- **erledigt** – `data/connections.ts`: `useMarkAccepted`, `useLogRequest` (optimistisch, gleiche Invalidierung) und `data/queue.ts → queueOptimistischEntfernen`; `heute/daten/anfragen.ts` enthält nur noch `useAnfragenHeute` (Modul-Logik). M2 (`LinkedInKarte`) nutzt dieselben Hooks.
- **erledigt** – `data/counters.ts → useTageswertSetzen()`: rechnet aus Zielwert, aktuellem Wert und getracktem Anteil das Delta (H-11) und hält die optimistische Anzeige richtig; `useTageszaehler.ts` nutzt ihn.
- **erledigt** – `data/undo.ts`: Undo invalidiert zusätzlich `['activities', 'zeitraum']` (und kann jetzt Stapel, siehe M2).
- **erledigt** – `features/email/public.ts`-Wunsch: Nachfass-Zähler und `emailSequenzStartbar` liegen in `lib/gates.ts`; `heute/gate.ts` und `sequenzen/startbar.ts` sind gelöscht.
- **erledigt** – `test/fixtures/sequenzen.ts`: Spalten wie die DB (`name`, `weekdays_only`, `stop_on_*`, `trigger_kind`), Keys aus `SEQUENZ` (Seed), eindeutige IDs (behebt die React-Key-Warnung in `einstellungen/Sequenzen.test.tsx`); `test/fixtures/settings.ts` nennt `linkedin_standard`/`linkedin_vernetzt_ohne_antwort`. M1-Tests behalten ihre eigenen Sequenzen in `_testHilfe.tsx` (unverändert grün).
- **erledigt (Teil)** – `texte/de.ts`: der doppelte Gate-Text „Keine Erlaubnis-Grundlage …“ steht jetzt einmal in `emailGateText`. „Liste abgearbeitet …“, „n Annahmen erfasst.“, „Antwort gesendet · Nachfassen am …“ und „Sequenz ‚…‘ gestartet …“ nutzt nur M1 – bleiben im Modul (BAUPLAN § 3.0 Nr. 7: nur gemeinsame Wortlaute nach `de.ts`); „Später: morgen.“ = `TOAST.spaeter('morgen')`.
