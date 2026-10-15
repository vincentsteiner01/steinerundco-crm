// BAUPLAN § 3.8 parser/rolle.ts: Freitext → lead_role, Schlüsselwörter exakt wie crm.import_leads (schema.sql).
import type { LeadRole } from '@/types/domain'

const REGELN: readonly [RegExp, LeadRole][] = [
  [/geschäftsführ|geschaeftsfuehr|ceo|managing director|\bgf\b/i, 'geschaeftsfuehrer'],
  [/inhaber|gründer|gruender|founder|owner/i, 'inhaber'],
  [/kundenbetreu/i, 'kundenbetreuer'],
  [/innendienst/i, 'innendienst'],
  [/vertrieb|sales/i, 'vertrieb'],
  [/projektleit/i, 'projektleiter'],
]

export function rolleAus(text: string | null | undefined): LeadRole {
  const t = (text ?? '').trim()
  if (t === '') return 'unbekannt'
  for (const [re, rolle] of REGELN) if (re.test(t)) return rolle
  return 'sonstiges'
}

/** § 6.3 ROLLENWORT – erkennt ein Segment als Positionsangabe (Schnellimport-Zeilen). */
export const ROLLENWORT =
  /geschäftsführ|geschaeftsfuehr|\bgf\b|ceo|inhaber|gründer|gruender|founder|managing director|prokurist|vertriebsleiter|kundenbetreu|projektleit|leiter|\bhead\b|\bcoo\b|\bcto\b|\bcfo\b|innendienst|vertrieb|sales/i

/** § 6.3 RECHTSFORM – erkennt ein Segment als Unternehmen. */
export const RECHTSFORM = /\b(gmbh|ag|kg|ug|e\.k\.|ohg|se|& co|co\.|gbr|mbh|inc|ltd|llc)\b|& co\b/i
