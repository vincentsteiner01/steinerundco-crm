// Vorlagenwahl und gefüllter Text je Karte (BAUPLAN § 3.2 „Verhalten“, § 3.1.9a). Das Füllen selbst macht ausschließlich
// lib/platzhalter.ts (`fuellen`, `tokens`); hier steht nur, welche Vorlage eine Karte bekommt und was daraus wird.
import { fuellen, tokens, type FuellErgebnis, type PlatzhalterKontext, type PlatzhalterLead } from '@/lib/platzhalter'
import { OPENER_NACH_ROLLE, phase2Vorlage, VORLAGE, type VorlageKey } from '@/lib/vorlagenKeys'
import { aktiveVariante, istAktiv } from '@/lib/vorlagenWahl'
import type { LeadMitBezug, Member, QueueItem, ReplyLabel, Template } from '@/types/domain'
import type { KartenZustand } from './kartenStore'

export type KartenArt = 'linkedin' | 'telefon' | 'email' | 'antworten' | 'meeting' | 'wiedervorlage' | 'aufgabe'

/** Variante der Queue-Karte aus `item_kind` und `channel` (DESIGN-SYSTEM § 5.7/§ 5.8). */
export function kartenArt(item: Pick<QueueItem, 'item_kind' | 'channel'>): KartenArt {
  switch (item.item_kind) {
    case 'antworten':
      return 'antworten'
    case 'meeting':
      return 'meeting'
    case 'rueckruf':
      return 'telefon'
    case 'wiedervorlage':
      return 'wiedervorlage'
    case 'aufgabe':
      return 'aufgabe'
    default:
      if (item.channel === 'telefon') return 'telefon'
      if (item.channel === 'email') return 'email'
      return 'linkedin'
  }
}

export const nachKey = (templates: readonly Template[] | undefined, key: VorlageKey | null): Template | null =>
  key ? (templates?.find((t) => t.key === VORLAGE[key]) ?? null) : null
export const nachId = (templates: readonly Template[] | undefined, id: string | null | undefined): Template | null =>
  id ? (templates?.find((t) => t.id === id) ?? null) : null

export type AntwortInfo = { label: ReplyLabel | null; note: string | null; occurredAt: string | null }

/** Titel der Sheet-Wiedervorlage aus dem Import (Migration 3, Abschnitt 14: Phase ohne Sequenz, „Nächster Follow-Up am“ gesetzt). */
const SHEET_FOLLOW_UP = /^follow-up \(aus sheet\)/i
const KURZFRISTIG: readonly VorlageKey[] = [VORLAGE.li_fu_kurz_1, VORLAGE.li_fu_kurz_2, VORLAGE.li_fu_kurz_3]

/**
 * Runde 3 (echte Daten, Mikes Heute): Wiedervorlagen ohne Vorlage zeigten „Keine Vorlage hinterlegt“ und sperrten Kopieren.
 * Standard: „Follow-up (aus Sheet)“ → der nächste Kurzfristig-Schritt nach dem Nachfass-Zähler des Leads (0 → Kurzfristig 1,
 * 1 → 2, 2 → 3, ab 3 → Langfristig 1); jede andere Wiedervorlage → Langfristig 1 (Stale-Regel „Wiedervorlage reif“, § 5.4).
 * Über „ändern“ (⌘⇧E) bleibt die Vorlage wählbar.
 */
export function wiedervorlageStandard(
  item: Pick<QueueItem, 'title' | 'follow_up_count'>,
  followUps?: number | null,
): VorlageKey {
  if (!SHEET_FOLLOW_UP.test(item.title?.trim() ?? '')) return VORLAGE.li_fu_lang_1
  const n = Math.max(0, followUps ?? item.follow_up_count ?? 0)
  return KURZFRISTIG[n] ?? VORLAGE.li_fu_lang_1
}

/**
 * Vorlage einer Karte: gewechselte Vorlage (⌘⇧E) → Antworten-Karte nach `PHASE2_VORLAGE_NACH_LABEL` → Opener nach Rolle
 * (`OPENER_NACH_ROLLE`) → Wiedervorlage ohne Vorlage: Standard (`wiedervorlageStandard`) → Vorlage des Schritts/der Aufgabe aus der View.
 * 23.10.2026: Automatisch gewählte Vorlagen müssen aktiv sein – sonst die aktive Variante derselben Familie (lib/vorlagenWahl);
 * eine inaktive Rollen-Vorlage (ZG – Kundenbetreuer) fällt ganz weg. Eine bewusst gewechselte Vorlage bleibt, wie sie ist.
 */
export function vorlageFuerKarte(
  item: QueueItem,
  art: KartenArt,
  lead: (Pick<LeadMitBezug, 'role'> & { follow_up_count?: number | null }) | null | undefined,
  templates: readonly Template[] | undefined,
  zustand: Pick<KartenZustand, 'vorlageId'>,
  antwort: AntwortInfo | null,
  istOpener: boolean,
): Template | null {
  if (zustand.vorlageId) return nachId(templates, zustand.vorlageId)
  const aktiv = (t: Template | null) => aktiveVariante(t, templates)
  if (art === 'antworten')
    return aktiv(nachKey(templates, antwort?.label ? phase2Vorlage(antwort.label, !!antwort.note) : null))
  if (istOpener && lead?.role) {
    const rolle = OPENER_NACH_ROLLE(lead.role)
    const t = rolle ? nachKey(templates, rolle) : null
    if (istAktiv(t)) return t
  }
  if (art === 'wiedervorlage' && !item.template_id)
    return aktiv(nachKey(templates, wiedervorlageStandard(item, lead?.follow_up_count)))
  return aktiv(nachId(templates, item.template_id))
}

export type NachrichtErgebnis = FuellErgebnis & {
  /** alle Platzhalter der Vorlage (für „Platzhalter n/m gefüllt“) */
  alle: string[]
  /** Text stammt aus „Text bearbeiten“ */
  bearbeitet: boolean
}

/** Gefüllter Text + offene Platzhalter; ein Textsnapshot (bearbeitet) zählt seine verbliebenen `[Token]` als offen. */
export function nachrichtErgebnis(
  body: string | null | undefined,
  lead: PlatzhalterLead,
  ctx: PlatzhalterKontext,
  snapshot: string | null,
): NachrichtErgebnis {
  if (snapshot !== null) {
    const offen = tokens(snapshot)
    return { text: snapshot, offen, gefuellt: {}, alle: offen, bearbeitet: true }
  }
  const b = body ?? ''
  const f = fuellen(b, lead, ctx)
  return { ...f, alle: tokens(b), bearbeitet: false }
}

/** Kontext fürs Füllen aus Lead-Detail, angemeldeter Person und Kartenwerten. */
export function fuellKontext(
  lead: LeadMitBezug | null | undefined,
  me: Member | null | undefined,
  werte: Record<string, string>,
): PlatzhalterKontext {
  const meeting =
    lead?.meetings
      ?.filter((m) => m.status === 'stattgefunden')
      .sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''))[0] ?? null
  return {
    werte,
    me: me
      ? {
          display_name: me.display_name,
          short_name: me.short_name,
          caller_number_e164: me.caller_number_e164,
          signature: me.signature,
          calendly_url: me.calendly_url,
        }
      : null,
    meeting: meeting ? { scheduled_at: meeting.scheduled_at, status: meeting.status } : null,
  }
}

/** Lead-Felder fürs Füllen – aus dem Detail, sonst aus der View-Zeile (Vorname/Nachname/Unternehmen/Anrede). */
export function fuellLead(item: QueueItem, lead: LeadMitBezug | null | undefined): PlatzhalterLead {
  if (lead) return lead
  return {
    first_name: item.first_name,
    last_name: item.last_name,
    company_name: item.company_name,
    salutation: item.salutation,
  }
}

/** Telefon-Karte: Skript als Stichpunkte (Einstieg + Problem), max. `max` Punkte (DESIGN-SYSTEM § 5.8). */
export function skriptPunkte(text: string, max = 5): string[] {
  return text
    .split(/\n+/)
    .map((z) => z.replace(/^[-–•*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, max)
}

/** Kopfzeile des Nachrichten-Blocks: „Leitfaden · Kurzfristig 2 · Platzhalter 1/1 gefüllt“. */
export function blockKopf(vorlage: Template | null, erg: NachrichtErgebnis, skript = false): string {
  const name = vorlage?.name ?? '–'
  const gesamt = erg.alle.length
  const voll = gesamt - erg.offen.length
  const art = skript ? 'Skript' : 'Leitfaden'
  return gesamt ? `${art} · ${name} · Platzhalter ${voll}/${gesamt} gefüllt` : `${art} · ${name}`
}
