// No-Show-Vorschlag (§ 1.5 Nr. 28, LD-13): Toast „Sequenz ‚No-Show Erstgespräch‘ starten?“ mit „Starten ↵“; `↵` wirkt, solange der
// Toast sichtbar ist (Capture-Listener, damit keine Listen-Taste dazwischenfunkt). Keine Automatik – erst die Bestätigung startet.
import { createElement } from 'react'
import { sonnerToast } from '@/components/toast'

export const NO_SHOW_TEXT = 'Sequenz ‚No-Show Erstgespräch‘ starten?'
export const NO_SHOW_DAUER_MS = 8000

export function noShowVorschlag(onStart: () => void): void {
  let id: string | number = 0
  const start = () => {
    document.removeEventListener('keydown', taste, true)
    sonnerToast.dismiss(id)
    onStart()
  }
  const taste = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      start()
    }
  }
  document.addEventListener('keydown', taste, true)
  id = sonnerToast.custom(
    () =>
      createElement(
        'div',
        { className: 'toast-brand', 'data-variante': 'neutral', role: 'status' },
        createElement('span', { className: 'toast-text' }, NO_SHOW_TEXT),
        createElement(
          'button',
          {
            type: 'button',
            onClick: start,
            className:
              'toast-aktion border-line-strong text-ink text-small hover:bg-surface-hover inline-flex h-7 items-center gap-2 rounded-sm border px-2.5 font-medium leading-none',
          },
          'Starten',
          createElement('kbd', { className: 'kbd' }, '↵'),
        ),
      ),
    {
      duration: NO_SHOW_DAUER_MS,
      onAutoClose: () => document.removeEventListener('keydown', taste, true),
      onDismiss: () => document.removeEventListener('keydown', taste, true),
    },
  )
}
