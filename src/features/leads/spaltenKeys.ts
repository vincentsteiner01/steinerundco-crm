// Spalten-Schlüssel der Leads-Tabelle (ux § 3.2.2: Standardspalten + weitere wählbare). Die Definitionen stehen in spalten.tsx;
// hier nur Keys und Labels, damit ansichten.ts/filter.ts keine Komponenten importieren müssen.
import type { Lead } from '@/types/domain'

export const SPALTEN_KEYS = [
  'name',
  'unternehmen',
  'rolle',
  'kanal',
  'phase',
  'schritt',
  'zustaendig',
  'letzteBewegung',
  'naechsteAktion',
  'notiz',
  // weitere wählbare
  'anrede',
  'ort',
  'linkedin',
  'telefon',
  'email',
  'angefragtAm',
  'followUps',
  'erlaubnis',
  'anrufgrund',
  'quelle',
  'angelegtAm',
  'beendetGrund',
  'wiedervorlageAm',
  'geloeschtAm',
  'id',
] as const
export type SpaltenKey = (typeof SPALTEN_KEYS)[number]

export const SPALTEN_LABEL: Record<SpaltenKey, string> = {
  name: 'Name',
  unternehmen: 'Unternehmen',
  rolle: 'Rolle',
  kanal: 'Kanal',
  phase: 'Phase',
  schritt: 'Schritt',
  zustaendig: 'Zuständig',
  letzteBewegung: 'Letzte Bewegung',
  naechsteAktion: 'Nächste Aktion',
  notiz: 'Notiz',
  anrede: 'Anrede',
  ort: 'Ort',
  linkedin: 'LinkedIn-URL',
  telefon: 'Telefon',
  email: 'E-Mail',
  angefragtAm: 'Angefragt am',
  followUps: 'Follow-ups',
  erlaubnis: 'Erlaubnis-Grundlage',
  anrufgrund: 'Anrufgrund',
  quelle: 'Quelle',
  angelegtAm: 'Angelegt am',
  beendetGrund: 'Beendet-Grund',
  wiedervorlageAm: 'Wiedervorlage am',
  geloeschtAm: 'Gelöscht am',
  id: 'ID',
}

/** Spalte → sortierbares Lead-Feld (fehlt = nicht sortierbar). */
export const SPALTE_FELD: Partial<Record<SpaltenKey, keyof Lead>> = {
  name: 'full_name',
  unternehmen: 'company_name',
  rolle: 'role',
  phase: 'stage',
  schritt: 'next_action_label',
  zustaendig: 'owner_id',
  letzteBewegung: 'last_activity_at',
  naechsteAktion: 'next_action_at',
  anrede: 'salutation',
  ort: 'city',
  angefragtAm: 'stage_changed_at',
  followUps: 'follow_up_count',
  erlaubnis: 'email_consent_basis',
  anrufgrund: 'call_basis',
  angelegtAm: 'created_at',
  beendetGrund: 'ended_reason',
  wiedervorlageAm: 'next_action_at',
  geloeschtAm: 'deleted_at',
}

export function spalteNachFeld(feld: keyof Lead): SpaltenKey | null {
  for (const [k, f] of Object.entries(SPALTE_FELD)) if (f === feld) return k as SpaltenKey
  return null
}
