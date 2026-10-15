import { useHotkeyScope } from '@/lib/keyboard'

/**
 * Setzt solange gemountet den Hotkey-Scope `formular` (Einzelbuchstaben der Liste/Karte ruhen, ⌘↵/Esc bleiben).
 * In Dialoge/Popovers als erstes Kind legen. Integration M1–M8: vorher acht gleiche lokale Kopien.
 */
export function ScopeFormular(): null {
  useHotkeyScope('formular')
  return null
}
