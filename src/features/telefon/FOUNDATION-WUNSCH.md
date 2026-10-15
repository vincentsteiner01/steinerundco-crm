# FOUNDATION-WUNSCH – M3 Telefon

Stand Integration M1–M8 (15.10.2026, Lead-Agent). `features/telefon/daten/` ist gelöscht.

- **erledigt** – `src/data/enrollments.ts → useEnrollmentsKanal(kanal, memberId, enabled)`, Key `qk.enrollmentsKanal(kanal, member)`; Realtime (`enrollments`) und alle Enrollment-Mutationen invalidieren zusätzlich `['enrollments', 'kanal']`.
- **erledigt** – `src/data/calls.ts → useCallOutcomeDefs()` (Key `qk.calls.outcomeDefs`), eine Quelle für M3 und M5.
- **erledigt** – `src/data/calls.ts → useLogCall` invalidiert zusätzlich `['tasks', 'faellig']`, `['enrollments']`, `['calls', 'letzte']`.
- **bewusst nicht** – Kurzlabels der 15 Ergebnisse, Gruppenlabels A/B/C: nutzt nur M3 → bleiben in `ergebnisse.ts` (BAUPLAN § 3.0 Nr. 7). Der Dialogtext „Verwerfen löscht den lokalen Anruf-Entwurf …“ steht jetzt als `DIALOG.anrufVerwerfen.hinweis` (+ `behalten`) in `de.ts`.
- **erledigt (Prop), bewusst nicht verdrahtet** – `src/components/ui/DatePicker.tsx → autoOffen`. Im Wrap-up bleibt es bei Vorbelegung + Fokus: ein automatisch offenes Popover verdeckte die Pflichtfelder und unterbräche den Tastaturfluss `1–9 → Felder → ⌘↵`.
- **bewusst nicht** – `WiderspruchErfassen` mit „nur Kanäle“: Der Widerspruch im Anruf läuft serverseitig über `log_call(do_not_call)` in einer Transaktion; eine zweite Variante der M0-Komponente, die nur Werte sammelt, brächte keinen Gewinn. Der M3-Dialog nutzt den Wortlaut `DIALOG.widerspruch`.
- **erledigt** – `src/data/queryKeys.ts`: `qk.enrollmentsKanal`, `qk.enrollmentsLaufend`, `qk.calls.letzte`, `qk.calls.outcomeDefs`, `qk.tasks.rueckrufeOffen`.
- **erledigt** – `src/data/tasks.ts → useRueckrufeOffen(memberId, enabled)`.
- **erledigt** – `src/data/calls.ts → useLetzteAnrufe(leadIds)` + `letzterJeLead`, eigener Key `qk.calls.letzte(ids)`.
- **erledigt** – `src/data/realtime.ts`: `tasks` invalidiert zusätzlich `['tasks', 'faellig']`, `calls` zusätzlich `['calls', 'letzte']`.
- **erledigt** – `src/components/ui/Button.tsx`: Primär-Hover über das neue Token `--color-signal-hover` (`hover:bg-signal-hover`), kbd-Rahmen `border-signal-ink/35`; keine Hex-/rgb-Klassen mehr in `src/app`, `src/components`, `src/features`.
