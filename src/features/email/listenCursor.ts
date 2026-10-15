// Listen-Cursor der Tabs (ux § 5.3, BAUPLAN § 3.5 „in Tabs J K Enter“): J/K bewegen, Enter öffnet, Scope `liste`.
import { useState } from 'react'
import { useHotkeys } from '@/lib/keyboard'

export function useListenCursor(ids: readonly string[], onEnter: (id: string) => void, aktiv = true) {
  const [cursor, setCursor] = useState<string | null>(null)
  const effektiv = cursor && ids.includes(cursor) ? cursor : (ids[0] ?? null)

  const bewegen = (delta: number) => {
    if (!ids.length) return
    const i = effektiv ? ids.indexOf(effektiv) : -1
    const n = Math.min(ids.length - 1, Math.max(0, i + delta))
    const ziel = ids[n]
    if (ziel) {
      setCursor(ziel)
      document.querySelector<HTMLElement>(`[data-cursor-id="${ziel}"]`)?.scrollIntoView({ block: 'nearest' })
    }
  }

  useHotkeys(
    'liste',
    aktiv
      ? {
          j: () => bewegen(1),
          k: () => bewegen(-1),
          arrowdown: () => bewegen(1),
          arrowup: () => bewegen(-1),
          enter: () => {
            if (effektiv) onEnter(effektiv)
          },
        }
      : {},
    [ids.join(','), effektiv, aktiv, onEnter],
  )

  return { cursor: effektiv, setCursor }
}
