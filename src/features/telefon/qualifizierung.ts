// M3 – Qualifizierungs-Checkliste (ux § 3.5.2, T-13) und Timer-Korrektur (reine Helfer für AnrufMitte).
// Schlüssel nach ux (`team_innendienst`), nicht nach dem Schema-Kommentar (`team_groesse_innendienst`) – Konfliktregel ux > schema.
import type { Json } from '@/types/database'
import type { Lead } from '@/types/domain'

export const QUALIFIZIERUNG: readonly { key: string; label: string; optionen: { key: string; label: string }[] }[] = [
  {
    key: 'wer_beantwortet',
    label: 'Wer beantwortet?',
    optionen: [
      { key: 'projektleiter', label: 'Projektleiter' },
      { key: 'innendienst', label: 'Innendienst' },
      { key: 'gf', label: 'GF' },
    ],
  },
  {
    key: 'haeufigkeit',
    label: 'Häufigkeit',
    optionen: [
      { key: 'selten', label: 'selten' },
      { key: 'taeglich', label: 'täglich' },
      { key: 'stuendlich', label: 'stündlich' },
    ],
  },
  {
    key: 'team_innendienst',
    label: 'Innendienst',
    optionen: [
      { key: '1-2', label: '1–2' },
      { key: '3-5', label: '3–5' },
      { key: '6+', label: '6+' },
    ],
  },
  {
    key: 'wissensquelle',
    label: 'Wissensquelle',
    optionen: [
      { key: 'kopf', label: 'Kopf' },
      { key: 'ordner', label: 'Ordner' },
      { key: 'tool', label: 'Tool' },
    ],
  },
]

export function qualifikation(lead: Pick<Lead, 'qualification'>): Record<string, Json | undefined> {
  const q = lead.qualification
  return q && typeof q === 'object' && !Array.isArray(q) ? (q as Record<string, Json | undefined>) : {}
}

/** `03:52` oder `1:02:11` → Sekunden; ungültig → null */
export function parseDauer(text: string): number | null {
  const teile = text
    .trim()
    .split(':')
    .map((t) => Number(t))
  if (!teile.length || teile.some((n) => !Number.isFinite(n) || n < 0)) return null
  if (teile.length === 1) return teile[0] ?? null
  if (teile.length === 2) return (teile[0] ?? 0) * 60 + (teile[1] ?? 0)
  return (teile[0] ?? 0) * 3600 + (teile[1] ?? 0) * 60 + (teile[2] ?? 0)
}
