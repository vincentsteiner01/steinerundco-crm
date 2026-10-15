// Zustände der Kanal-Karten (ux § 3.3.3, § 1.5 Nr. 34/35) als reine Funktionen – LinkedIn (letzte Vernetzung → Chip),
// Telefon (Gates vor Nummer vor Versuchen, INFO-Regel), E-Mail (Nachfass-Zähler, Erlaubnis-Chip, Tooltip LD-04).
import type { ChipTon } from '@/components/ui/Chip'
import { fmtDatum, fmtDatumKurz, fmtZeit } from '@/lib/format'
import { telefonGate, type EmailGate, type SperrlistenTreffer } from '@/lib/gates'
import { stageRank } from '@/lib/stufen'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import { ERLAUBNIS_LABEL } from '@/texte/de'
import type { Call, LeadMitBezug, LinkedinConnection } from '@/types/domain'

export type LinkedInZustand =
  | { key: 'nicht_angefragt'; label: string; ton: ChipTon }
  | { key: 'angefragt'; label: string; ton: ChipTon }
  | { key: 'angenommen'; label: string; ton: ChipTon }
  | { key: 'zurueckgezogen'; label: string; ton: ChipTon }
  | { key: 'abgelehnt'; label: string; ton: ChipTon }
  | { key: 'abgelaufen'; label: string; ton: ChipTon }
  | { key: 'kontakt_entfernt'; label: string; ton: ChipTon }

export function letzteVernetzung(cs: readonly LinkedinConnection[] | null | undefined): LinkedinConnection | null {
  if (!cs?.length) return null
  return (
    [...cs].sort((a, b) => (b.requested_at ?? b.created_at).localeCompare(a.requested_at ?? a.created_at))[0] ?? null
  )
}

/** Zustand aus der letzten Vernetzung (§ 1.5 Nr. 34: zurückgezogen + note abgelehnt → „Abgelehnt“). */
export function linkedinZustand(
  lead: Pick<LeadMitBezug, 'linkedin_connections' | 'released_reason'>,
  heute: string,
): LinkedInZustand {
  if (lead.released_reason && /kontakt entfernt/i.test(lead.released_reason))
    return { key: 'kontakt_entfernt', label: 'Kontakt entfernt', ton: 'ended' }
  const c = letzteVernetzung(lead.linkedin_connections)
  if (!c) return { key: 'nicht_angefragt', label: 'Nicht angefragt', ton: 'ended' }
  switch (c.status) {
    case 'ausstehend': {
      const tage = c.requested_at ? tageDifferenz(berlinTag(c.requested_at), heute) : 0
      return { key: 'angefragt', label: `Angefragt · seit ${tage} T`, ton: 'muted' }
    }
    case 'angenommen':
      return {
        key: 'angenommen',
        label: `Angenommen${c.accepted_at ? ` · ${fmtDatumKurz(c.accepted_at)}` : ''}`,
        ton: 'muted',
      }
    case 'zurueckgezogen':
      return c.note === 'abgelehnt'
        ? { key: 'abgelehnt', label: 'Abgelehnt', ton: 'ended' }
        : { key: 'zurueckgezogen', label: 'Zurückgezogen', ton: 'ended' }
    case 'abgelaufen':
      return { key: 'abgelaufen', label: 'Abgelaufen', ton: 'ended' }
  }
}

export type TelefonZustand = { label: string; ton: ChipTon; gesperrt: boolean }

/** Zustand (ux § 3.3.3): Gates vor Nummer vor Versuchen. */
export function telefonZustand(
  lead: LeadMitBezug,
  calls: readonly Call[],
  maxVersuche: number,
  sperrliste?: SperrlistenTreffer,
): TelefonZustand {
  const gate = telefonGate(lead, sperrliste)
  if (!gate.erlaubt && gate.grund === 'firma_gesperrt')
    return { label: 'Firma gesperrt', ton: 'danger', gesperrt: true }
  if (!gate.erlaubt && (gate.grund === 'sperrliste' || gate.grund === 'widerspruch'))
    return { label: 'Gesperrt', ton: 'danger', gesperrt: true }
  if (!lead.phone_e164) return { label: 'Keine Nummer', ton: 'ended', gesperrt: true }
  if (!lead.call_basis) return { label: 'Nummer ohne Anrufgrund', ton: 'overdue', gesperrt: true }
  const rueckruf = lead.tasks?.find((t) => t.kind === 'rueckruf' && t.status === 'offen')
  if (rueckruf)
    return {
      label: `Rückruf ${fmtDatumKurz(rueckruf.due_at)} ${fmtZeit(rueckruf.due_at)}`,
      ton: 'today',
      gesperrt: false,
    }
  const versuche = calls.filter((c) => c.direction === 'out').length
  if (versuche >= maxVersuche) return { label: `Nicht erreichbar (nach ${maxVersuche})`, ton: 'ended', gesperrt: false }
  if (versuche > 0) return { label: `Versuch ${versuche}/${maxVersuche}`, ton: 'muted', gesperrt: false }
  return { label: 'Bereit', ton: 'neutral', gesperrt: false }
}

/** INFO-Regel (§ 1.5 Nr. 35): ab Stufe erstgespraech_vereinbart mit Nummer, solange kein Anrufgrund gesetzt ist. */
export function infoRegelSichtbar(lead: Pick<LeadMitBezug, 'stage' | 'phone_e164' | 'call_basis'>): boolean {
  return stageRank(lead.stage) >= stageRank('erstgespraech_vereinbart') && !!lead.phone_e164 && !lead.call_basis
}

export function emailZustand(lead: LeadMitBezug, gate: EmailGate): { label: string; ton: ChipTon } {
  if (!lead.email) return { label: 'Keine Adresse', ton: 'ended' }
  if (!gate.erlaubt) {
    if (gate.grund === 'widerspruch') return { label: 'Widerspruch', ton: 'danger' }
    if (gate.grund === 'firma_gesperrt') return { label: 'Firma gesperrt', ton: 'danger' }
    if (gate.grund === 'sperrliste') return { label: 'Gesperrt', ton: 'danger' }
    if (gate.grund === 'zu_viele_nachfass') return { label: 'Drei Nachfass-Mails', ton: 'overdue' }
    return { label: 'Keine Erlaubnis', ton: 'ended' }
  }
  if (gate.warnung === 'aelter_12_monate') return { label: 'Erlaubnis älter als 12 Monate', ton: 'overdue' }
  return {
    label: `Erlaubnis: ${ERLAUBNIS_LABEL[lead.email_consent_basis]}${lead.email_consent_at ? ` (${fmtDatum(lead.email_consent_at)})` : ''}`,
    ton: 'muted',
  }
}
