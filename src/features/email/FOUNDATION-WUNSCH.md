# FOUNDATION-WUNSCH – M4 E-Mail

Stand Integration M1–M8 (15.10.2026, Lead-Agent).

- **erledigt (vor der Integration)** – Literal-Schlüssel in `heute/useQueueAktionen.ts` und `kpis/_testHilfe.tsx`: von M1/M5 entfernt, `lib/keyboard.verboten.test.ts` grün.
- **erledigt (Teil)** – Gate-Regeln: der Nachfass-Zähler (`nachfassZaehler`, `GESENDET_STATUS`) und die Startbarkeit der E-Mail-Sequenzen (`emailSequenzStartbar`) liegen jetzt in `lib/gates.ts`; Composer (M4), Heute-Karte (M1), Kanal-Karte und Lead-Kopf (M2) nutzen dieselbe Funktion (vorher drei Kopien mit abweichender Zählung). Regel 5 (offene Platzhalter) bleibt in `features/email/gate.ts → berechneGate`: Heute-Karte und Kanal-Karte sperren Kopieren/Öffnen bei offenen Platzhaltern bereits selbst (BAUPLAN § 3.1.9a „Erst [x] eintragen“); der Wortlaut kommt für alle aus `texte/de.ts → emailGateText('offene_platzhalter')`.
- **erledigt** – `texte/de.ts`: `TOAST.entwurfGespeichert`, `TOAST.entwurfVerworfen`, `TOAST.emailGesendet(vorlage)`, `TOAST.emailBestaetigt`, `TOAST.bounceErfasst`, `emailGateText(grund, vorname)`, `EMAIL_WARNUNG_12_MONATE`. Die Status-Labels der E-Mail-Zeilen (`status.ts`) nutzt nur M4 – bleiben im Modul (BAUPLAN § 3.0 Nr. 7).
- **erledigt** – `SequenzStartenMenue` (M1) nutzt `lib/gates.emailSequenzStartbar`; die Kopie `features/sequenzen/startbar.ts` ist gelöscht, ihre Tests stehen in `lib/gates.test.ts`.
