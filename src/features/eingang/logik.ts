// Eingang (crm.eingang, Migration 7): reine Logik ohne Netz – Labels, Töne, Filter, Zähler, Script-Zustand.
// Ein Eingang ist eine LinkedIn-Benachrichtigung aus dem eigenen Gmail (Apps Script → Edge Function) oder aus der Erweiterung.
import type { ChipTon } from '@/components/ui'

export const EINGANG_STATUS = ['neu', 'verarbeitet', 'unbekannt', 'ignoriert', 'fehler'] as const
export type EingangStatus = (typeof EINGANG_STATUS)[number]
export type EingangArt = 'nachricht' | 'annahme' | 'einladung' | 'sonstiges'

/** Offen = wartet auf einen Menschen: nicht zugeordnet, Fehler oder Einladung eines Leads. */
export const EINGANG_OFFEN: readonly EingangStatus[] = ['neu', 'unbekannt', 'fehler']

export type EingangZeile = {
  id: string
  member_id: string
  quelle: string
  art: string
  status: string
  empfangen_at: string
  created_at: string
  absender_name: string | null
  linkedin_slug: string | null
  text: string | null
  ergebnis: string | null
  lead_id: string | null
  activity_id: number | null
}

export const ART_LABEL: Record<EingangArt, string> = {
  nachricht: 'Nachricht',
  annahme: 'Einladung angenommen',
  einladung: 'Einladung erhalten',
  sonstiges: 'Sonstiges',
}

export const STATUS_LABEL: Record<EingangStatus, string> = {
  neu: 'neu',
  verarbeitet: 'verarbeitet',
  unbekannt: 'unbekannt',
  ignoriert: 'ignoriert',
  fehler: 'Fehler',
}

/** Töne nach DESIGN-SYSTEM § 3.2: Lime = heute zu tun (zuordnen), Rot = Fehler, sonst ruhig. Sage ist für Chips verboten. */
export const STATUS_TON: Record<EingangStatus, ChipTon> = {
  neu: 'neu',
  verarbeitet: 'muted',
  unbekannt: 'today',
  ignoriert: 'ended',
  fehler: 'danger',
}

export function istStatus(s: string | null | undefined): s is EingangStatus {
  return !!s && (EINGANG_STATUS as readonly string[]).includes(s)
}

export function artLabel(art: string): string {
  return ART_LABEL[art as EingangArt] ?? 'Sonstiges'
}

export function istOffen(z: Pick<EingangZeile, 'status'>): boolean {
  return (EINGANG_OFFEN as readonly string[]).includes(z.status)
}

/** Zuordnen/Ignorieren sind nur für offene Einträge möglich (verarbeitet/ignoriert sind abgeschlossen). */
export const kannBearbeiten = istOffen

/** Einladung eines Leads: auf LinkedIn selbst annehmen, im CRM danach „Angenommen“ – hier nur öffnen oder erledigen. */
export function istEinladungVomLead(z: Pick<EingangZeile, 'status' | 'art' | 'lead_id'>): boolean {
  return z.status === 'neu' && z.art === 'einladung' && !!z.lead_id
}

export type StatusFilter = 'offen' | 'alle' | EingangStatus

export const STATUS_FILTER: readonly StatusFilter[] = ['offen', 'alle', ...EINGANG_STATUS]

export function istStatusFilter(s: string | null | undefined): s is StatusFilter {
  return !!s && (STATUS_FILTER as readonly string[]).includes(s)
}

export function filterLabel(f: StatusFilter): string {
  if (f === 'offen') return 'Offen'
  if (f === 'alle') return 'Alle'
  const l = STATUS_LABEL[f]
  return l.charAt(0).toUpperCase() + l.slice(1)
}

/** Filter auf Person (`null` = beide) und Status. */
export function filtere<Z extends Pick<EingangZeile, 'status' | 'member_id'>>(
  zeilen: readonly Z[],
  person: string | null,
  status: StatusFilter,
): Z[] {
  return zeilen.filter(
    (z) =>
      (!person || z.member_id === person) &&
      (status === 'alle' || (status === 'offen' ? istOffen(z) : z.status === status)),
  )
}

export type StatusZaehler = Record<EingangStatus, number> & { offen: number; alle: number }

export function zaehle(zeilen: readonly Pick<EingangZeile, 'status'>[]): StatusZaehler {
  const z: StatusZaehler = { neu: 0, verarbeitet: 0, unbekannt: 0, ignoriert: 0, fehler: 0, offen: 0, alle: 0 }
  for (const r of zeilen) {
    z.alle++
    if (istStatus(r.status)) z[r.status]++
    if (istOffen(r)) z.offen++
  }
  return z
}

const NBSP = ' '

/** „gerade eben“ · „vor 3 Min.“ · „vor 2 Std.“ · „vor 1 Tag“ · „vor 4 Tagen“. */
export function seitText(iso: string, jetzt: Date = new Date()): string {
  const ms = jetzt.getTime() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 60_000) return 'gerade eben'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `vor ${min}${NBSP}Min.`
  const std = Math.floor(min / 60)
  if (std < 24) return `vor ${std}${NBSP}Std.`
  const tage = Math.floor(std / 24)
  return tage === 1 ? `vor 1${NBSP}Tag` : `vor ${tage}${NBSP}Tagen`
}

/** Das Apps Script meldet sich nur, wenn neue LinkedIn-Mails da sind – zwei Tage Stille sind auffällig, Stunden nicht. */
export const STILL_AB_STUNDEN = 48

export type SchluesselInfo = { created_at: string; last_used_at: string | null; label: string | null }

export type ScriptZustand =
  | { art: 'aus'; text: string }
  | { art: 'wartet'; text: string }
  | { art: 'aktiv'; text: string }
  | { art: 'still'; text: string }

export function scriptZustand(s: SchluesselInfo | null, jetzt: Date = new Date()): ScriptZustand {
  if (!s) return { art: 'aus', text: 'Nicht eingerichtet' }
  if (!s.last_used_at) return { art: 'wartet', text: 'Schlüssel aktiv – das Script hat noch nichts übertragen' }
  const stunden = (jetzt.getTime() - new Date(s.last_used_at).getTime()) / 3_600_000
  const seit = seitText(s.last_used_at, jetzt)
  if (stunden >= STILL_AB_STUNDEN) return { art: 'still', text: `Läuft vermutlich nicht – zuletzt übertragen ${seit}` }
  return { art: 'aktiv', text: `Läuft – zuletzt übertragen ${seit}` }
}
