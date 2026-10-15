// Vorschlag-Toast (BAUPLAN § 3.2 Meeting-Karte, § 1.5 Nr. 28): „No-Show erfasst. Sequenz ‚No-Show Erstgespräch‘ starten? ↵“ –
// 6 s, `↵` oder Klick führt aus, keine Automatik. Gleiche Hülle wie components/toast (.toast-brand), eigene Taste.
import { createElement } from 'react'
import { sonnerToast, UNDO_MS } from '@/components/toast'

export function toastVorschlag(text: string, aktion: { label: string; onAusfuehren: () => void }): void {
  let id: string | number = 0
  let erledigt = false
  const ausfuehren = () => {
    if (erledigt) return
    erledigt = true
    sonnerToast.dismiss(id)
    aktion.onAusfuehren()
  }
  const taste = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
    const el = document.activeElement
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
    e.preventDefault()
    e.stopPropagation()
    ausfuehren()
  }
  document.addEventListener('keydown', taste, true)
  const aufraeumen = () => document.removeEventListener('keydown', taste, true)
  id = sonnerToast.custom(
    () =>
      createElement(
        'div',
        { className: 'toast-brand', 'data-variante': 'neutral', role: 'status' },
        createElement('span', { className: 'toast-text' }, text),
        createElement(
          'button',
          {
            type: 'button',
            onClick: ausfuehren,
            className:
              'toast-aktion inline-flex h-7 items-center gap-2 rounded-sm border border-line-strong px-2.5 text-small font-medium leading-none text-ink transition-[background] duration-[var(--t-1)] ease-brand hover:bg-surface-hover',
          },
          aktion.label,
          createElement('kbd', { className: 'kbd' }, '↵'),
        ),
      ),
    { duration: UNDO_MS, onAutoClose: aufraeumen, onDismiss: aufraeumen },
  )
}
