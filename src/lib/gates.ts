// BAUPLAN § 3.1.9 `gates.ts` – rechtliche Gates § 8 wörtlich (Client-Komfort; die Regel sind die DB-Trigger).
// Firmensperre § 1.5 Nr. 27: `lead.companies?.do_not_contact === true` → `firma_gesperrt` (kein Widerspruch).
import type { Channel, Email, EmailStatus, Lead, Settings } from '@/types/domain'
import { SEQUENZ } from './vorlagenKeys'
import { berlinTag, type Tag } from './zeit'

/** Sperrlisten-Treffer: `true` (irgendein Treffer), `false`/`null` oder die Einträge mit ihren Kanälen. */
export type SperrlistenTreffer = boolean | null | undefined | readonly { channels?: readonly Channel[] | null }[]

/** Sperrlisten-Eintrag (Teilmenge von `crm.sperrliste`), wie ihn die Gates brauchen. */
export type SperrlistenEintragKurz = {
  lead_id?: string | null
  phone_e164?: string | null
  email?: string | null
  linkedin_url_norm?: string | null
  channels?: readonly Channel[] | null
}

/**
 * Einträge der Sperrliste, die diese Person betreffen (Lead-ID, Telefon, E-Mail ohne Groß/Klein, LinkedIn-URL). Die Kanäle
 * prüfen danach die Gates selbst. Integration M1–M8: eine Funktion für Leads (M2), Telefon (M3) und E-Mail (M4).
 */
export function sperrlistenEintraege<E extends SperrlistenEintragKurz>(
  eintraege: readonly E[] | null | undefined,
  lead: {
    id?: string | null
    phone_e164?: string | null
    email?: string | null
    linkedin_url_norm?: string | null
  },
): E[] {
  if (!eintraege?.length) return []
  const email = lead.email?.trim().toLowerCase() || null
  return eintraege.filter(
    (e) =>
      (!!e.lead_id && !!lead.id && e.lead_id === lead.id) ||
      (!!e.phone_e164 && !!lead.phone_e164 && e.phone_e164 === lead.phone_e164) ||
      (!!e.email && !!email && e.email.toLowerCase() === email) ||
      (!!e.linkedin_url_norm && !!lead.linkedin_url_norm && e.linkedin_url_norm === lead.linkedin_url_norm),
  )
}

/** Lead-Felder, die die Gates lesen (Teilmenge von `Lead` + Firmen-Embed aus `useLead`/Liste). */
export type GateLead = Partial<
  Pick<
    Lead,
    | 'phone_e164'
    | 'call_basis'
    | 'do_not_contact'
    | 'do_not_contact_channels'
    | 'email'
    | 'email_consent_basis'
    | 'email_consent_at'
    | 'last_inbound_at'
  >
> & { companies?: { do_not_contact?: boolean | null } | null }

export type TelefonGrund = 'keine_nummer' | 'kein_anrufgrund' | 'sperrliste' | 'widerspruch' | 'firma_gesperrt'
export type EmailGrund =
  'keine_grundlage' | 'widerspruch' | 'zu_viele_nachfass' | 'sperrliste' | 'keine_adresse' | 'firma_gesperrt'
export type KontaktGrund = 'widerspruch' | 'sperrliste' | 'firma_gesperrt'

export type TelefonGate = { erlaubt: boolean; grund?: TelefonGrund }
export type EmailGate = { erlaubt: boolean; warnung?: 'aelter_12_monate'; grund?: EmailGrund }
export type KontaktGate = { erlaubt: boolean; grund?: KontaktGrund }

const firmaGesperrt = (lead: GateLead) => lead.companies?.do_not_contact === true

/** Widerspruch für den Kanal: `do_not_contact` ohne Kanalliste = alle Kanäle, sonst nur die genannten. */
function widerspruch(lead: GateLead, kanal: Channel): boolean {
  if (!lead.do_not_contact) return false
  const kanaele = lead.do_not_contact_channels
  return !kanaele || kanaele.length === 0 || kanaele.includes(kanal)
}

function sperrliste(treffer: SperrlistenTreffer, kanal: Channel): boolean {
  if (!treffer) return false
  if (treffer === true) return true
  return treffer.some((t) => !t.channels || t.channels.length === 0 || t.channels.includes(kanal))
}

/** § 8.2 Nr. 2 – Telefon: Nummer + Anrufgrund Pflicht; Sperrliste, Widerspruch, Firmensperre blocken. */
export function telefonGate(lead: GateLead, sperrlistenTreffer: SperrlistenTreffer = false): TelefonGate {
  if (widerspruch(lead, 'telefon')) return { erlaubt: false, grund: 'widerspruch' }
  if (sperrliste(sperrlistenTreffer, 'telefon')) return { erlaubt: false, grund: 'sperrliste' }
  if (firmaGesperrt(lead)) return { erlaubt: false, grund: 'firma_gesperrt' }
  if (!lead.phone_e164) return { erlaubt: false, grund: 'keine_nummer' }
  if (!lead.call_basis) return { erlaubt: false, grund: 'kein_anrufgrund' }
  return { erlaubt: true }
}

export type EmailGateOptionen = {
  /** Vorlage `phase = 'transaktional'`: Gate-Regeln 1–3 entfallen (§ 8.1 Nr. 4). */
  transaktional?: boolean
  /** `settings.email.max_followups_per_consent` (Standard 3, E12). */
  maxNachfass?: number
  /** `settings.email.consent_max_age_months` (Standard 12). */
  maxAlterMonate?: number
  /** Nur für Tests: Bezugstag. */
  heute?: Date | Tag
}

/** Monatsarithmetik auf Kalendertagen: `tag` + n Monate (Tag begrenzt auf Monatsende). */
function monatePlus(tag: Tag, n: number): Tag {
  const j = Number(tag.slice(0, 4))
  const m = Number(tag.slice(5, 7)) - 1 + n
  const t = Number(tag.slice(8, 10))
  const erster = new Date(Date.UTC(j, m, 1))
  const letzter = new Date(Date.UTC(erster.getUTCFullYear(), erster.getUTCMonth() + 1, 0)).getUTCDate()
  const d = new Date(Date.UTC(erster.getUTCFullYear(), erster.getUTCMonth(), Math.min(t, letzter)))
  return d.toISOString().slice(0, 10)
}

/**
 * § 8.1 Nr. 2 – E-Mail: `none`/`revoked` → Block; Grundlage > 12 Monate ohne eingehenden Kontakt seitdem → Warnung
 * („Trotzdem öffnen“); ≥ `maxNachfass` unbeantwortete ausgehende Mails seit der Grundlage → Block (E12: ≤ 3 erlaubt);
 * Sperrliste, fehlende Adresse, Firmensperre → Block ohne Override.
 */
export function emailGate(
  lead: GateLead,
  nachfassZaehler: number,
  sperrlistenTreffer: SperrlistenTreffer = false,
  opts: EmailGateOptionen = {},
): EmailGate {
  const basis = lead.email_consent_basis ?? 'none'
  if (basis === 'revoked' || widerspruch(lead, 'email')) return { erlaubt: false, grund: 'widerspruch' }
  if (sperrliste(sperrlistenTreffer, 'email')) return { erlaubt: false, grund: 'sperrliste' }
  if (firmaGesperrt(lead)) return { erlaubt: false, grund: 'firma_gesperrt' }
  if (!lead.email || lead.email.trim() === '') return { erlaubt: false, grund: 'keine_adresse' }
  if (opts.transaktional) return { erlaubt: true }
  if (basis === 'none') return { erlaubt: false, grund: 'keine_grundlage' }
  // BAUPLAN § 8.1 Nr. 2 sagt „> 3“, E12/GATE_GRUND_LABEL sagen „≤ 3 erlaubt“ → ab drei gesendeten blockt die vierte.
  const max = opts.maxNachfass ?? 3
  if (nachfassZaehler >= max) return { erlaubt: false, grund: 'zu_viele_nachfass' }

  const consentTag = lead.email_consent_at ? berlinTag(lead.email_consent_at) : null
  if (consentTag) {
    const heute = berlinTag(opts.heute ?? new Date())
    const grenze = monatePlus(consentTag, opts.maxAlterMonate ?? 12)
    const eingangSeitdem = lead.last_inbound_at ? berlinTag(lead.last_inbound_at) > consentTag : false
    if (heute > grenze && !eingangSeitdem) return { erlaubt: true, warnung: 'aelter_12_monate' }
  }
  return { erlaubt: true }
}

/** Als gesendet verbuchte Status ausgehender Mails (Nachfass-Zähler, Composer). */
export const GESENDET_STATUS: readonly EmailStatus[] = ['sent_confirmed', 'sent', 'delivered']

/**
 * Nachfass-Zähler unter der aktuellen Erlaubnis (Regel 3, E12): ausgehende, als gesendet verbuchte Mails ohne Antwort seit dem
 * späteren von `email_consent_at` und letztem Eingang (`last_inbound_at`) – eine Antwort setzt die Kette zurück.
 * Integration M1–M8: eine Funktion für Composer (M4), Heute-Karte (M1) und Kanal-Karte (M2); vorher drei Kopien.
 */
export function nachfassZaehler(
  emails: readonly Pick<Email, 'direction' | 'status' | 'sent_at' | 'status_at'>[] | null | undefined,
  lead: Partial<Pick<Lead, 'email_consent_at' | 'last_inbound_at'>> | null | undefined,
): number {
  if (!emails?.length || !lead) return 0
  const seit = [lead.email_consent_at, lead.last_inbound_at]
    .filter((x): x is string => !!x)
    .map((x) => new Date(x).getTime())
    .reduce((a, b) => Math.max(a, b), 0)
  return emails.filter(
    (e) =>
      e.direction === 'out' &&
      e.status !== 'replied' &&
      GESENDET_STATUS.includes(e.status) &&
      new Date(e.sent_at ?? e.status_at).getTime() > seit,
  ).length
}

export type SequenzStartGrund = 'keine_adresse' | 'keine_grundlage' | 'nur_nach_gespraech'

const NACHBEREITUNG: readonly string[] = [
  SEQUENZ.email_warm_after_erstgespraech,
  SEQUENZ.email_warm_after_strategiegespraech,
]

/**
 * M-13 / ux § 3.6.3: Startbarkeit einer Sequenz im Menü. E-Mail: No-Show (transaktional) braucht nur eine Adresse;
 * Nachbereitungen nur nach geführtem Gespräch (`meeting_held`) oder für Bestandskunden; sonst jede Grundlage ≠ none/revoked.
 * LinkedIn/Telefon: keine Zusatzregel (kontaktGate sperrt das Menü). Integration: vorher in M1 und M4 doppelt.
 */
export function emailSequenzStartbar(
  sequenz: { key: string; channel: Channel },
  lead: Partial<Pick<Lead, 'email' | 'email_consent_basis'>> | null | undefined,
): { startbar: boolean; grund?: SequenzStartGrund } {
  if (sequenz.channel !== 'email') return { startbar: true }
  if (!lead?.email?.trim()) return { startbar: false, grund: 'keine_adresse' }
  if (sequenz.key === SEQUENZ.email_noshow_erstgespraech) return { startbar: true }
  const basis = lead.email_consent_basis ?? 'none'
  if (basis === 'none' || basis === 'revoked') return { startbar: false, grund: 'keine_grundlage' }
  if (NACHBEREITUNG.includes(sequenz.key) && basis !== 'meeting_held' && basis !== 'existing_customer')
    return { startbar: false, grund: 'nur_nach_gespraech' }
  return { startbar: true }
}

/** § 8.3/§ 8.4 – LinkedIn-Kontakt (Anfrage senden, Sequenz starten, Nachricht/Pitch loggen). */
export function kontaktGate(lead: GateLead, sperrlistenTreffer: SperrlistenTreffer = false): KontaktGate {
  if (widerspruch(lead, 'linkedin')) return { erlaubt: false, grund: 'widerspruch' }
  if (sperrliste(sperrlistenTreffer, 'linkedin')) return { erlaubt: false, grund: 'sperrliste' }
  if (firmaGesperrt(lead)) return { erlaubt: false, grund: 'firma_gesperrt' }
  return { erlaubt: true }
}

export type BudgetProfil = {
  weekly_budget?: number | null
  daily_target?: number | null
  linkedin_plan?: 'basic' | 'premium' | 'sales_navigator' | null
}

export type LinkedinBudget = {
  /** Heute noch möglich = max(0, min(daily_target − heute, weekly_budget − woche)) (§ 3.2). */
  moeglich: number
  /** Woche ≥ `warn_at_pct` % des Wochenbudgets (Amber-Text). */
  warnung: boolean
  /** Wochenbudget erreicht – Hinweis „auf eigenes Risiko“, nie blockiert (§ 8.3 Nr. 2). */
  erreicht: boolean
  wochenbudget: number
  tagesziel: number
}

/** § 8.3 Nr. 2 – Mengen-Hygiene: `woche` = Σ Tageszähler der letzten 7 Tage, `heute` = Tageszähler. */
export function linkedinBudget(
  settings: Pick<Settings, 'linkedin'> | null | undefined,
  profil: BudgetProfil | null | undefined,
  woche: number,
  heute: number,
): LinkedinBudget {
  const plan = profil?.linkedin_plan ?? 'premium'
  const wochenbudget =
    profil?.weekly_budget ?? settings?.linkedin.weekly_budget_default[plan] ?? (plan === 'basic' ? 100 : 150)
  const tagesziel = profil?.daily_target ?? settings?.linkedin.daily_target_default ?? 30
  const warnAb = settings?.linkedin.warn_at_pct ?? 90
  const moeglich = Math.max(0, Math.min(tagesziel - heute, wochenbudget - woche))
  const erreicht = woche >= wochenbudget
  const warnung = wochenbudget > 0 && woche >= (wochenbudget * warnAb) / 100
  return { moeglich, warnung, erreicht, wochenbudget, tagesziel }
}
