# FOUNDATION-WUNSCH – M7 Import

Stand Integration M1–M8 (15.10.2026, Lead-Agent).

- **erledigt** – `components/toast.ts → toastUndo(text, ziel)`: `ziel` ist eine Activity-ID, ein Stapel von IDs oder eine eigene Aktion (`() => …`); `Z` (global) und der Knopf führen sie aus. Der Import-Toast ist jetzt `toastUndo(text, () => undo_import)`; `components/importToast.ts` ist gelöscht (der Text-Helfer liegt in `components/zusammenfassung.ts`).
- **erledigt** – `components/ui/Segment.tsx`: `wert: K | null` (kein Knopf aktiv); der Schnellimport übergibt `null` statt `'' as Salutation`.
- **erledigt** – `texte/de.ts → DIALOG.importRueckgaengig(datum, zeilen, geloescht)` sagt den v1-Wortlaut („aktualisierte Leads bleiben auf dem neuen Stand“); `SchrittFertig.tsx` und `ImportErgebnisSeite.tsx` nutzen ihn.
- **Hinweis, offen (Migration)** – `import_leads` liefert keine neuen Lead-IDs; ein Rückgabefeld `inserted_ids` würde den Nachlade-Roundtrip im Schnellimport („bereits vernetzt“) sparen. Migrationen gehören nicht zur Integration → Lead.
