// Reine Helfer rund um die Erlaubnis-Grundlage (§ 8.1): Badge-Zustand, erfassbare Grundlagen, Sammeladressen.
import { fmtDatumKurz } from '@/lib/format'
import { berlinTag, monatePlus } from '@/lib/zeit'
import type { ChipTon } from '@/components/ui/Chip'
import type { EmailConsentBasis, Lead } from '@/types/domain'

export type ErlaubnisLead = Pick<Lead, 'email_consent_basis' | 'email_consent_at' | 'email_consent_note'> &
  Partial<Pick<Lead, 'last_inbound_at'>>

/** Kurzform der Grundlage für den Chip („Per LinkedIn gebeten · 05.10.“). */
export const ERLAUBNIS_KURZ: Record<EmailConsentBasis, string> = {
  none: 'Keine Erlaubnis',
  requested_linkedin: 'Per LinkedIn gebeten',
  requested_phone: 'Am Telefon gebeten',
  requested_email: 'Per E-Mail gebeten',
  meeting_held: 'Gespräch geführt',
  double_opt_in: 'Double-Opt-in',
  existing_customer: 'Bestandskunde',
  revoked: 'Widerspruch',
}

export type ErlaubnisZustand = {
  ton: ChipTon
  label: string
  /** Grundlage älter als `maxMonate` ohne Eingang seitdem (Regel 2). */
  veraltet: boolean
  gesperrt: boolean
}

/** Zustand des Badges (reine Funktion, testbar). */
export function erlaubnisZustand(
  lead: ErlaubnisLead,
  heute: Date | string = new Date(),
  maxMonate = 12,
): ErlaubnisZustand {
  const basis = lead.email_consent_basis
  if (basis === 'none' || basis === 'revoked')
    return { ton: 'danger', label: ERLAUBNIS_KURZ[basis], veraltet: false, gesperrt: true }
  const datum = lead.email_consent_at ? fmtDatumKurz(lead.email_consent_at) : null
  const label = datum ? `${ERLAUBNIS_KURZ[basis]} · ${datum}` : ERLAUBNIS_KURZ[basis]
  let veraltet = false
  if (lead.email_consent_at) {
    const consentTag = berlinTag(lead.email_consent_at)
    const grenze = monatePlus(consentTag, maxMonate)
    const eingangSeitdem = lead.last_inbound_at ? berlinTag(lead.last_inbound_at) > consentTag : false
    veraltet = berlinTag(heute) > grenze && !eingangSeitdem
  }
  return { ton: veraltet ? 'overdue' : 'neutral', label, veraltet, gesperrt: false }
}

/** Erfassbare Grundlagen (§ 8.1 Nr. 1); `double_opt_in` setzt nur ein Formular, `revoked` nur der Widerspruch. */
export const ERLAUBNIS_GRUNDLAGEN: readonly EmailConsentBasis[] = [
  'requested_linkedin',
  'requested_phone',
  'requested_email',
  'meeting_held',
  'existing_customer',
]

const SAMMEL_RE =
  /^(info|kontakt|contact|office|mail|post|hallo|hello|service|vertrieb|sales|buero|büro|team|zentrale)@/i
/** Hinweis bei Sammeladressen (die Bitte muss von der Person kommen, nicht vom Postfach). */
export const istSammeladresse = (adresse: string): boolean => SAMMEL_RE.test(adresse.trim())

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
