// Reine Helfer der Heute-Seite (getrennt von HeuteSeite.tsx – oxlint react/only-export-components).
import { fmtDatumKurz } from '@/lib/format'
import { tagPlus } from '@/lib/zeit'
import type { Member, QueueItem } from '@/types/domain'

/** `?person=vincent|mike|andere` → Mitglied (short_name/display_name/E-Mail-Präfix, ohne Groß/Klein). */
export function personAusParam(members: readonly Member[], param: string | null, meId: string | null): Member | null {
  if (!param) return null
  const p = param.trim().toLowerCase()
  if (p === 'andere') return members.find((m) => m.id !== meId) ?? null
  return (
    members.find((m) =>
      [m.short_name, m.display_name, m.email?.split('@')[0]].some((n) => n && n.toLowerCase().startsWith(p)),
    ) ?? null
  )
}

/** „Nächster Schritt: Fr 16.10. · 4 Follow-ups, 1 Rückruf.“ aus den kommenden Zeilen (ux § 4.1). */
export function naechsterSchritt(items: readonly QueueItem[], heute: string): string | null {
  const kommend = items
    .filter((i) => i.section === 'kommend' && i.due_date && i.due_date > heute)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  const erster = kommend[0]
  if (!erster?.due_date) return null
  const amTag = kommend.filter((i) => i.due_date === erster.due_date)
  const rueckrufe = amTag.filter((i) => i.item_kind === 'rueckruf').length
  const rest = amTag.length - rueckrufe
  const teile = [
    rest ? `${rest} ${rest === 1 ? 'Follow-up' : 'Follow-ups'}` : null,
    rueckrufe ? `${rueckrufe} ${rueckrufe === 1 ? 'Rückruf' : 'Rückrufe'}` : null,
  ].filter(Boolean)
  return `Nächster Schritt: ${fmtDatumKurz(erster.due_date)}${teile.length ? ` · ${teile.join(', ')}` : ''}.`
}

/** Rückrufe/Termine mit Uhrzeit, die heute noch kommen (rechte Spalte „Später heute“). */
export function spaeterHeute(items: readonly QueueItem[], heute: string, jetztMs: number): QueueItem[] {
  return items
    .filter(
      (i) =>
        (i.item_kind === 'rueckruf' || i.item_kind === 'meeting') &&
        !!i.due_at &&
        i.due_date === heute &&
        new Date(i.due_at).getTime() > jetztMs,
    )
    .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
    .slice(0, 6)
}

/** Zeile „Später · morgen, Do 15.10.“ (DESIGN-SYSTEM § 5.7 „später“) – `tag` = neue Fälligkeit, sonst „verschoben“. */
export function spaeterText(tag: string | null | undefined, heute: string): string {
  if (!tag) return 'verschoben'
  return tag === tagPlus(heute, 1) ? `morgen, ${fmtDatumKurz(tag)}` : fmtDatumKurz(tag)
}

/** „Liste abgearbeitet – 29 Anfragen gesendet, 3 übersprungen.“ (ux § 2.1 Abschlusszustand). */
export function listeAbgearbeitet(gesendet: number, uebersprungen: number): string {
  const teile = [`${gesendet} ${gesendet === 1 ? 'Anfrage' : 'Anfragen'} gesendet`]
  if (uebersprungen) teile.push(`${uebersprungen} übersprungen`)
  return `Liste abgearbeitet – ${teile.join(', ')}.`
}
