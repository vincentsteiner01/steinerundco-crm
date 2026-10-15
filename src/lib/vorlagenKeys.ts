// BAUPLAN § 4.6 (wörtlich) / § 1.5 Nr. 24 – einzige Quelle für Vorlagen- und Sequenz-Schlüssel. Werte sind exakt die
// Seed-Keys; `vorlagenKeys.test.ts` vergleicht gegen src/test/fixtures/seedKeys.json. Kein Modul schreibt Key-Strings.
import type { LeadRole, ReplyLabel } from '@/types/domain'

export const VORLAGE = {
  li_vernetzung_v1: 'li_vernetzung_v1',
  li_vernetzung_v2: 'li_vernetzung_v2',
  li_eroeffnung_v1: 'li_eroeffnung_v1',
  li_eroeffnung_v2: 'li_eroeffnung_v2',
  li_eroeffnung_v3: 'li_eroeffnung_v3',
  li_eroeffnung_kundenbetreuer: 'li_eroeffnung_kundenbetreuer',
  li_bedarf_ja_v1: 'li_bedarf_ja_v1',
  li_bedarf_ja_v2: 'li_bedarf_ja_v2',
  li_bedarf_ja_v3: 'li_bedarf_ja_v3',
  li_bedarf_nein_ohne_grund: 'li_bedarf_nein_ohne_grund',
  li_bedarf_nein_mit_grund: 'li_bedarf_nein_mit_grund',
  li_bedarf_hat_partner: 'li_bedarf_hat_partner',
  li_bedarf_nein_falsches_problem: 'li_bedarf_nein_falsches_problem',
  li_bedarf_vernetzt_ohne_antwort: 'li_bedarf_vernetzt_ohne_antwort',
  li_pitch_a: 'li_pitch_a',
  li_pitch_b: 'li_pitch_b',
  li_fu_kurz_1: 'li_fu_kurz_1',
  li_fu_kurz_2: 'li_fu_kurz_2',
  li_fu_kurz_3: 'li_fu_kurz_3',
  li_fu_lang_1: 'li_fu_lang_1',
  li_fu_lang_2: 'li_fu_lang_2',
  tel_einstieg_1: 'tel_einstieg_1',
  tel_einstieg_2: 'tel_einstieg_2',
  tel_mailbox_1: 'tel_mailbox_1',
  tel_mailbox_2: 'tel_mailbox_2',
  tel_datenschutz_1: 'tel_datenschutz_1',
  em_erstgespraech_zusammenfassung: 'em_erstgespraech_zusammenfassung',
  em_nachfassen_3_tage: 'em_nachfassen_3_tage',
  em_nachfassen_10_tage_mehrwert: 'em_nachfassen_10_tage_mehrwert',
  em_nachfassen_abhaken: 'em_nachfassen_abhaken',
  em_langfristig: 'em_langfristig',
  em_info_nach_linkedin_zusage: 'em_info_nach_linkedin_zusage',
  em_info_nach_telefonat: 'em_info_nach_telefonat',
  em_terminbestaetigung_erstgespraech: 'em_terminbestaetigung_erstgespraech',
  em_strategiegespraech_zusammenfassung: 'em_strategiegespraech_zusammenfassung',
  em_noshow_erstgespraech: 'em_noshow_erstgespraech',
} as const

export const SEQUENZ = {
  linkedin_standard: 'linkedin_standard',
  linkedin_vernetzt_ohne_antwort: 'linkedin_vernetzt_ohne_antwort',
  linkedin_nachfassen_im_gespraech: 'linkedin_nachfassen_im_gespraech',
  linkedin_sheet_regel: 'linkedin_sheet_regel',
  telefon_standard: 'telefon_standard',
  email_warm_after_erstgespraech: 'email_warm_after_erstgespraech',
  email_warm_after_strategiegespraech: 'email_warm_after_strategiegespraech',
  email_noshow_erstgespraech: 'email_noshow_erstgespraech',
  email_info_nach_linkedin_zusage: 'email_info_nach_linkedin_zusage',
  email_info_nach_telefonat: 'email_info_nach_telefonat',
} as const

export type VorlageKey = keyof typeof VORLAGE
export type SequenzKey = keyof typeof SEQUENZ

/** § 3.1.10b – Reaktion → vorgeschlagene Phase-2-Vorlage (`kein_bedarf` mit Zitat: `li_bedarf_nein_mit_grund`). */
export const PHASE2_VORLAGE_NACH_LABEL: Record<ReplyLabel, keyof typeof VORLAGE | null> = {
  interessiert: 'li_bedarf_ja_v1',
  frage: 'li_bedarf_ja_v3',
  kein_bedarf: 'li_bedarf_nein_ohne_grund' /* mit Note: li_bedarf_nein_mit_grund */,
  hat_partner: 'li_bedarf_hat_partner',
  falsches_problem: 'li_bedarf_nein_falsches_problem',
  spaeter: 'li_bedarf_nein_mit_grund',
  sonstiges: 'li_bedarf_ja_v3',
  nicht_icp: null,
  widerspruch: null,
}

/** Reaktion + Zitat → Vorlage (Komfort über `PHASE2_VORLAGE_NACH_LABEL`). */
export function phase2Vorlage(label: ReplyLabel, mitNote: boolean): keyof typeof VORLAGE | null {
  if (label === 'kein_bedarf' && mitNote) return 'li_bedarf_nein_mit_grund'
  return PHASE2_VORLAGE_NACH_LABEL[label]
}

/** Opener nach Rolle: Kundenbetreuer/Innendienst bekommen die eigene Eröffnung, sonst `null` (= Schritt-Vorlage). */
export function OPENER_NACH_ROLLE(role: LeadRole): keyof typeof VORLAGE | null {
  return role === 'kundenbetreuer' || role === 'innendienst' ? 'li_eroeffnung_kundenbetreuer' : null
}
