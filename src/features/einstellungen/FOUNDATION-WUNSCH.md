# Foundation-Wünsche M8 (Einstellungen)

Stand Integration M1–M8 (15.10.2026, Lead-Agent). Jede Zeile: Wunsch · Status · was in M0 passiert ist.

- **erledigt** – `src/data/members.ts`: `useProfilSpeichern()` (Upsert der eigenen `member_profiles`-Zeile, invalidiert `qk.members`) plus `liesPreferences`/`mergePreferences`/`profilAusMember` liegen jetzt in M0; lokale Kopie `daten/profil.ts` gelöscht, `Profil.tsx`/`Ziele.tsx`/`logik.ts` importieren aus `@/data`.
- **erledigt** – `src/data/enrollments.ts`: `useEnrollmentZaehler()` (+ reine Funktion `zaehleJeSequenz`), Key `qk.enrollmentsLaufend` (Präfix `['enrollments']`, Realtime/Undo frischen mit auf); lokale Kopie `daten/enrollmentZaehler.ts` gelöscht.
- **erledigt** – `src/data/_helfer.ts`: hookfreier Seitenlader `alleSeiten(seite)`, über `@/data` exportiert; die fünf Tabellen-Lader des CSV-Exports liegen in `src/data/export.ts` (`ladeLeadsAlle`, `ladeAktivitaetenAlle`, `ladeCallsAlle`, `ladeEmailsAlle`, `ladeTageswerteAlle`) – `daten/export.ts` ruft kein `supabase` mehr direkt.
- **erledigt** – `src/components/ui/Button.tsx`: wer `disabledGrund` übergibt (auch `undefined`), bekommt einen stabilen Elementbaum (Wrapper bleibt, im aktiven Zustand `display: contents`; `Tooltip` mit Prop `stabil`) – Fokus und Test-Referenzen überleben den Wechsel deaktiviert → aktiv.
- **erledigt** – `src/texte/de.ts → ALLGEMEIN`: `speichern`, `nichtsGeaendert`, `nummerUnvollstaendig`, `grundEingeben`; genutzt in M2 (LeadForm, FelderRaster, TelefonKarte), M6 (LeitfadenDetail), M8 (Formular, logik, Sperrliste).
- **bewusst nicht** – `src/lib/keyboard.ts`: kein neuer Scope `seite`. Die Scope-Liste ist in BAUPLAN § 3.1.8 fixiert; M8 bindet `1–6` im Scope `global` nur, solange die Seite gemountet ist – das ist genau ein Seiten-Scope. Seit der Integration liest `useHotkeys` die Bindungen je Event (keine eingefrorenen Handler mehr).
