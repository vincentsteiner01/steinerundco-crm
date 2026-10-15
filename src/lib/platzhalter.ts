// BAUPLAN § 3.1.9 / § 3.1.9a – Platzhalter `[Name]` in Vorlagen (verbindlich für M1, M2, M3, M4, M6).
// `fuellen` ersetzt gefüllte Platzhalter, lässt offene wörtlich stehen und listet sie; UI-Regel: „Kopieren“/„Öffnen“
// sind gesperrt, solange `offen.length > 0`. Das Seed-Literal „Herr [Nachname]“ / „Frau [Nachname]“ wird als
// `[Anrede] [Nachname]` behandelt.
import { ANRUFGRUND_LABEL } from '@/texte/de'
import type { CallBasis, Lead, Meeting, Salutation } from '@/types/domain'
import { fmtDatum } from './format'

export type PlatzhalterQuelle = 'lead' | 'anrede' | 'manuell' | 'termin' | 'meeting' | 'absender' | 'anlass'

export type PlatzhalterDef = { name: string; quelle: PlatzhalterQuelle; hinweis: string }

/** Bekannte Platzhalter (§ 3.1.9a) – Reihenfolge = Anzeige im Editor. */
export const PLATZHALTER: readonly PlatzhalterDef[] = [
  { name: 'Vorname', quelle: 'lead', hinweis: 'lead.first_name' },
  { name: 'Nachname', quelle: 'lead', hinweis: 'lead.last_name' },
  { name: 'Unternehmen', quelle: 'lead', hinweis: 'lead.company_name' },
  { name: 'Stadt', quelle: 'lead', hinweis: 'lead.city' },
  { name: 'Anrede', quelle: 'anrede', hinweis: 'Herr / Frau – bei neutral fragt das UI einmal' },
  { name: 'Reaktion', quelle: 'manuell', hinweis: 'immer manuell' },
  { name: 'Grund', quelle: 'manuell', hinweis: 'immer manuell' },
  { name: 'Einwand', quelle: 'manuell', hinweis: 'immer manuell' },
  { name: 'Punkt 1', quelle: 'manuell', hinweis: 'immer manuell' },
  { name: 'Punkt 2', quelle: 'manuell', hinweis: 'immer manuell' },
  { name: 'Punkt 3', quelle: 'manuell', hinweis: 'immer manuell' },
  { name: 'Mehrwert-Absatz', quelle: 'manuell', hinweis: 'immer manuell' },
  { name: 'Nächster Schritt', quelle: 'manuell', hinweis: 'immer manuell' },
  { name: 'Tag/Uhrzeit', quelle: 'termin', hinweis: 'manuell; Vorschlag aus Calendly v1.1' },
  { name: 'Tag/Uhrzeit 1', quelle: 'termin', hinweis: 'manuell; Vorschlag aus Calendly v1.1' },
  { name: 'Tag/Uhrzeit 2', quelle: 'termin', hinweis: 'manuell; Vorschlag aus Calendly v1.1' },
  { name: 'Gesprächsdatum', quelle: 'meeting', hinweis: 'letztes Meeting stattgefunden' },
  { name: 'Anrufer', quelle: 'absender', hinweis: 'me.display_name' },
  { name: 'Absender Vorname', quelle: 'absender', hinweis: 'me.display_name' },
  { name: 'Absender Nachname', quelle: 'absender', hinweis: 'me.display_name' },
  { name: 'Absender Telefon', quelle: 'absender', hinweis: 'me.caller_number_e164' },
  { name: 'Signatur', quelle: 'absender', hinweis: 'me.signature' },
  { name: 'Anlass', quelle: 'anlass', hinweis: 'lead.call_basis + call_basis_note' },
  { name: 'Termin-Link', quelle: 'absender', hinweis: 'me.calendly_url' },
]

/** Lead-Felder, die `fuellen` liest (Teilmenge von `Lead`, damit auch Schnellimport-Zeilen und Fixtures passen). */
export type PlatzhalterLead = Partial<
  Pick<Lead, 'first_name' | 'last_name' | 'company_name' | 'city' | 'call_basis' | 'call_basis_note'>
> & { salutation?: Salutation | null }

/** Angemeldete Person (Member-View + Profil). */
export type PlatzhalterMe = {
  display_name?: string | null
  short_name?: string | null
  caller_number_e164?: string | null
  signature?: string | null
  calendly_url?: string | null
}

export type PlatzhalterKontext = {
  /** Manuelle Werte (`[Reaktion]`, `[Punkt 1]`, `[Tag/Uhrzeit]`, …) – auch Überschreibungen automatischer Werte. */
  werte?: Record<string, string | null | undefined>
  me?: PlatzhalterMe | null
  /** Letztes Meeting mit Status `stattgefunden` (für `[Gesprächsdatum]`). */
  meeting?: Pick<Meeting, 'scheduled_at' | 'status'> | null
  /** Vom UI einmal erfragte Anrede bei `salutation = neutral` (wird am Lead gespeichert). */
  anrede?: 'herr' | 'frau' | null
}

export type FuellErgebnis = { text: string; offen: string[]; gefuellt: Record<string, string> }

const TOKEN_RE = /\[([^[\]\n]{1,40})\]/g
const LITERAL_ANREDE_RE = /\b(Herr|Frau)\s+\[Nachname\]/g

/** Alle Platzhalter-Namen im Text (eindeutig, in Reihenfolge des Auftretens; Literal Herr/Frau zählt als `Anrede`). */
export function tokens(body: string): string[] {
  const norm = body.replace(LITERAL_ANREDE_RE, '[Anrede] [Nachname]')
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of norm.matchAll(TOKEN_RE)) {
    const name = (m[1] as string).trim()
    if (!seen.has(name)) {
      seen.add(name)
      out.push(name)
    }
  }
  return out
}

const leer = (v: string | null | undefined): v is null | undefined => v == null || v.trim() === ''

function anredeWort(lead: PlatzhalterLead, ctx: PlatzhalterKontext): string | null {
  const s = ctx.anrede ?? lead.salutation
  if (s === 'herr') return 'Herr'
  if (s === 'frau') return 'Frau'
  return null
}

/** `short_name` nur als Name, wenn er kein Kürzel ist (Runde 3: „VS“ aus dem Profil darf nie als Absender/Anrufer erscheinen). */
function nameAusKurz(me: PlatzhalterMe | null | undefined): string | null {
  const s = me?.short_name?.trim()
  return s && s.length > 3 ? s : null
}

function absenderName(me: PlatzhalterMe | null | undefined): { vorname: string | null; nachname: string | null } {
  const name = me?.display_name?.trim()
  if (!name) return { vorname: nameAusKurz(me), nachname: null }
  const teile = name.split(/\s+/)
  if (teile.length === 1) return { vorname: teile[0] ?? null, nachname: null }
  return { vorname: teile.slice(0, -1).join(' '), nachname: teile[teile.length - 1] ?? null }
}

/** Wert eines Platzhalters oder `null`, wenn er offen bleibt. */
export function platzhalterWert(name: string, lead: PlatzhalterLead, ctx: PlatzhalterKontext = {}): string | null {
  const manuell = ctx.werte?.[name]
  if (!leer(manuell)) return manuell.trim()
  switch (name) {
    case 'Vorname':
      return leer(lead.first_name) ? null : lead.first_name.trim()
    case 'Nachname':
      return leer(lead.last_name) ? null : lead.last_name.trim()
    case 'Unternehmen':
      return leer(lead.company_name) ? null : lead.company_name.trim()
    case 'Stadt':
      return leer(lead.city) ? null : lead.city.trim()
    case 'Anrede':
      return anredeWort(lead, ctx)
    case 'Gesprächsdatum':
      return ctx.meeting && ctx.meeting.status === 'stattgefunden' && ctx.meeting.scheduled_at
        ? fmtDatum(ctx.meeting.scheduled_at)
        : null
    case 'Anrufer': {
      return ctx.me?.display_name?.trim() || nameAusKurz(ctx.me)
    }
    case 'Absender Vorname':
      return absenderName(ctx.me).vorname
    case 'Absender Nachname':
      return absenderName(ctx.me).nachname
    case 'Absender Telefon':
      return ctx.me?.caller_number_e164?.trim() || null
    case 'Signatur':
      return ctx.me?.signature?.trim() || null
    case 'Termin-Link':
      return ctx.me?.calendly_url?.trim() || null
    case 'Anlass': {
      if (!lead.call_basis) return null
      const label = ANRUFGRUND_LABEL[lead.call_basis as CallBasis] ?? lead.call_basis
      return leer(lead.call_basis_note) ? label : `${label} – ${lead.call_basis_note.trim()}`
    }
    default:
      return null // manuelle Platzhalter und unbekannte Namen bleiben offen
  }
}

/** § 3.1.9a – füllt `[Name]`-Platzhalter, listet offene; Herr/Frau-Literal → `[Anrede] [Nachname]`. */
export function fuellen(body: string, lead: PlatzhalterLead, ctx: PlatzhalterKontext = {}): FuellErgebnis {
  const gefuellt: Record<string, string> = {}
  const offen: string[] = []
  const norm = body.replace(LITERAL_ANREDE_RE, '[Anrede] [Nachname]')
  const text = norm.replace(TOKEN_RE, (ganz, roh: string) => {
    const name = roh.trim()
    const wert = platzhalterWert(name, lead, ctx)
    if (wert === null) {
      if (!offen.includes(name)) offen.push(name)
      return ganz
    }
    gefuellt[name] = wert
    return wert
  })
  return { text, offen, gefuellt }
}

/** Ist der Name ein bekannter Platzhalter (§ 3.1.9a)? Für Editor-Hinweise (M6). */
export function istBekannterPlatzhalter(name: string): boolean {
  return PLATZHALTER.some((p) => p.name === name)
}
