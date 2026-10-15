// Text des Import-Toasts (BAUPLAN § 3.8): „41 Leads angelegt · 3 Dubletten übersprungen“. Der Toast selbst ist seit der
// Integration M0 `toastUndo(text, () => undo_import)` (FOUNDATION-WUNSCH M7) – kein eigener sonner-Nachbau mehr.
import { fmtZahl } from '@/lib/format'
import type { ImportErgebnis } from '@/types/domain'

export function importZusammenfassung(
  e: Pick<ImportErgebnis, 'inserted' | 'updated' | 'skipped' | 'blocked' | 'invalid'>,
): string {
  const teile = [`${fmtZahl(e.inserted)} ${e.inserted === 1 ? 'Lead angelegt' : 'Leads angelegt'}`]
  const dubletten = e.updated + e.skipped
  if (dubletten > 0)
    teile.push(`${fmtZahl(dubletten)} ${dubletten === 1 ? 'Dublette übersprungen' : 'Dubletten übersprungen'}`)
  if (e.blocked > 0) teile.push(`${fmtZahl(e.blocked)} gesperrt`)
  if (e.invalid > 0) teile.push(`${fmtZahl(e.invalid)} ungültig`)
  return teile.join(' · ')
}
