# FOUNDATION-WUNSCH – M5 KPIs

Stand Integration M1–M8 (15.10.2026, Lead-Agent). Alle lokalen Kopien unter `features/kpis/daten/` sind gelöscht.

- **erledigt** – `src/data/kpis.ts → useMetricEventZeilen(member, von, bis)` (Zeilen mit `period`/`source`, alle Seiten, Key `[...qk.kpis.zeitraum(…), 'zeilen']`).
- **erledigt** – `src/data/kpis.ts → useFunnelMonatlich(member, monthKey | null)`: `null` = keine Anfrage (Option `enabled`).
- **erledigt** – `src/data/calls.ts → useCallOutcomeDefs()` (Key `qk.calls.outcomeDefs`) – eine Quelle für M3 und M5.
- **erledigt** – `src/data/counters.ts → useManuelleZaehler(member, von, bis)`.
- **erledigt** – `src/data/connections.ts → useConnectionsZeitraum(member, von, bis)`.
- **erledigt** – `src/data/index.ts` exportiert `pruefe`, `pruefeNull`, `useAlleSeiten` (jetzt mit `nachladen`, `istLaden` nur bei `enabled`), `alleSeiten`, `SEITE`.
- **erledigt** – `src/components/ui/SeitenKopf.tsx`: Slots `titelLinks`/`titelRechts` um die Headline; `KpisKopf.tsx` ist nur noch die Komposition mit den ←/→-Knöpfen.
- **erledigt** – `src/lib/keyboard.ts → useHotkeys` liest die Bindungen je Event aus dem letzten Render (keine eingefrorenen Handler).
- **Hinweis (Tests)** – `vi.mock('@/data/supabase', async () => …)` mit statischem Import im selben Testfile: bleibt als Muster in `_testHilfe.ts` dokumentiert, kein M0-Änderungsbedarf.
