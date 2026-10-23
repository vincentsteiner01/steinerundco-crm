// Wortlaute und Töne des Feedbacks (ux § 6: du-Form, „…“, –, keine Ausrufezeichen).
import type { ChipTon } from '@/components/ui/Chip'
import type { FeedbackArt, FeedbackStatus } from '@/data/feedback'

/** Fenster-Ereignis, das den Feedback-Dialog öffnet (⌥F in GlobaleTasten, Palette, Hilfe). */
export { FEEDBACK_EVENT } from './ereignis'

export const ART_LABEL: Record<FeedbackArt, string> = { fehler: 'Fehler', wunsch: 'Wunsch', frage: 'Frage' }

export const ART_PLATZHALTER: Record<FeedbackArt, string> = {
  fehler: 'Was ist passiert, und was hättest du erwartet?',
  wunsch: 'Was soll das CRM können – und wofür brauchst du es?',
  frage: 'Was möchtest du wissen?',
}

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  neu: 'neu',
  in_arbeit: 'in Arbeit',
  erledigt: 'erledigt',
  abgelehnt: 'abgelehnt',
}

/** Status-Chip: neu = Lime-Rahmen (wie Realtime „neu“), in Arbeit = neutral, erledigt = Sage, abgelehnt = beendet-grau. */
export const STATUS_TON: Record<FeedbackStatus, ChipTon> = {
  neu: 'neu',
  in_arbeit: 'neutral',
  erledigt: 'done',
  abgelehnt: 'ended',
}

export const TEXT = {
  knopf: 'Feedback',
  knopfAufnahme: 'Bild …',
  dialogTitel: 'Feedback an Claude',
  dialogSatz: 'Claude sieht deinen Text, den Screenshot und die Seite, auf der du gerade bist.',
  beschreibungLeer: 'Beschreib kurz, worum es geht.',
  titelPlatzhalter: 'In ein paar Worten (optional)',
  bildAuto: 'Automatisch aufgenommen',
  bildEigenes: 'Eigenes Bild',
  bildKeins: 'Kein Screenshot – Bild einfügen (⌘V) oder hierher ziehen.',
  bildKeinsTelefon: 'Kein Screenshot.',
  bildHinweis: 'Anderes Bild: einfügen (⌘V) oder hierher ziehen.',
  bildFalsch: 'Nur Bilder (PNG, JPEG, WebP) – das hier ist keins.',
  senden: 'Senden',
  danke: 'Danke – Claude sieht es sich an.',
  dankeOhneBild: 'Danke – Claude sieht es sich an. Der Screenshot ließ sich nicht hochladen.',
  antwortEine: (titel: string) => `Claude hat geantwortet: „${titel}“`,
  antwortMehrere: (n: number) => `Claude hat auf ${n} Meldungen geantwortet.`,
  ansehen: 'Ansehen',
} as const

/** Kurzer Titel einer Meldung: Titel oder die erste Zeile der Beschreibung (max. 80 Zeichen). */
export function kurzTitel(f: { titel: string | null; beschreibung: string }): string {
  const roh = f.titel?.trim() || f.beschreibung.trim().split('\n')[0] || ''
  return roh.length > 80 ? `${roh.slice(0, 79)}…` : roh
}
