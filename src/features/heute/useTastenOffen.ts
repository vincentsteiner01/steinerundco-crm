// Tasten in einem geöffneten Popover der Abhakzeilen (Ziffern 1–4, Esc, ⌘Enter): Capture-Listener, damit die Listen-Tasten
// (bubbling) nichts davon sehen – gleiches Muster wie components/aktionen (dort intern, deshalb hier lokal).
import { useEffect, useRef } from 'react'
import { eventNachBinding, istEingabe } from '@/lib/keyboard'

export function useTastenOffen(
  offen: boolean,
  handler: (binding: string, e: KeyboardEvent) => boolean | undefined,
): void {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!offen) return
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const b = eventNachBinding(e)
      if (istEingabe(document.activeElement) && !b.startsWith('mod+') && b !== 'escape') return
      if (ref.current(b, e)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [offen])
}
