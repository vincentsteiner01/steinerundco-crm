# FOUNDATION-WUNSCH – M2 (leads + pipeline)

Stand Integration M1–M8 (15.10.2026, Lead-Agent).

- **erledigt** – `data/leads.ts`: Listen-Select trägt `companies(id, do_not_contact)` (`LISTEN_FIRMA`, Typ `LeadListenZeile`); Tabelle, Pipeline und Anrufliste lesen zuerst das Embed, `useCompanies()` bleibt nur Fallback für Zeilen ohne Embed (Cache, Test-Mocks).
- **erledigt** – Lader für die Auskunft: `src/data/export.ts` (`ladeAktivitaetenLead`, `ladeCallsLead`, `ladeEmailsLead`, `ladeTagsNachId`, `schreibeAuskunftNotiz`); `features/leads/daten/export.ts` gelöscht.
- **erledigt** – `data/activities.ts → useNotizBearbeiten({ activity, note })` versioniert nach `metadata.versions` (+ `notizVersionen`); `daten/notizBearbeiten.ts` gelöscht.
- **offen (Migration)** – Herkunft des Stufenwechsels als RPC-Parameter (`set_stage(p_lead_id, p_stage, p_via)`) statt nachträglichem Patch: braucht eine Migration (nicht Teil der Integration). Der Patch läuft jetzt über `data/activities.ts → aktivitaetMetadataErgaenzen` statt über `supabase` im Modul.
- **erledigt** – `texte/de.ts → TIMELINE_TEXT` liest `from`/`to`/`ended_reason` selbst und den Rang über `ctx.rang`; die Brücke `stufenwechselNormalisiert` ist gelöscht.
- **erledigt** – `data/leads.ts → useLeadUpdate` (LE-16): der Konflikt-Toast nennt die andere Person relativ zur angemeldeten.
- **erledigt** – `components/toast.ts → toastUndo(text, ids[])` + `useUndo().anbieten(ids[], text)`; `Z` global macht den ganzen Stapel rückgängig. `features/leads/bulkUndo.ts` und die `Z`-Bindung in `useLeadsHotkeys` sind gelöscht.
- **erledigt** – `components/tabelle/DataTable.tsx`: `←`/`→` wechseln die Spalte nur ohne offenen Peek.
- **zusätzlich (Integration)** – `nachleseAktivitaet` (data/activities) ersetzt `hilfen.frischeAktivitaet`; `sperrlistenEintraege` (lib/gates) ersetzt die eigene Sperrlisten-Prüfung und macht die Peek-/Vollseiten-Gates kanalgenau; Ereignis-Filter § 7.5 (`?ereignis`, `?quelle=anfragen|angenommen`, `?ansicht=termine&termin`, `?von&bis&person`) in `filter.ts` + `data/leads.ts` für K-05.
