// Query- und Mutation-Schlüssel des Reiters „Ziele“ – eigene Datei ohne weitere Importe, damit der Realtime-Bündler
// (liegt im Start-Bündel) sie nutzen kann, ohne die Daten-Schicht und die Rechnerei des Reiters mitzuladen.

/** Alles, was der Reiter „Ziele“ lädt. */
export const OKR_KEY = ['okr'] as const
/** Gemeinsamer Schlüssel aller Schreibvorgänge des Reiters (Realtime wartet, solange einer läuft). */
export const OKR_SCHREIBEN = ['okr', 'schreiben'] as const
