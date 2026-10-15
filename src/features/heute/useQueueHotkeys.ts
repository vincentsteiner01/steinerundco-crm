// BAUPLAN § 3.2 useQueueHotkeys (Scope liste/karte, Anhang A): J/K/↓/↑ Cursor · Enter Kopieren · ⌘Enter Kopieren + Gesendet ·
// C E ⇧E O X D P Space ⇧↓ · ⌥1–9/⌥0 Batch · ⌥R neu sortieren · ⌥M E-Mail · + / ⇧+ Zähler · ⌘⇧E Vorlage wechseln.
// A B S N W T binden die M0-Aktionen selbst (components/aktionen, `aktiv` auf der Cursor-Karte).
// Keine ⌘-Ziffern, kein ⌘R, kein ⌘⇧M (§ 1.5 Nr. 23).
import { useEffect, useRef } from 'react'
import { istEingabe, useHotkeys } from '@/lib/keyboard'

export type QueueTaste =
  | 'kopieren'
  | 'kopieren_gesendet'
  | 'gesendet'
  | 'gesendet_mit_notiz'
  | 'abhaken'
  | 'oeffnen'
  | 'ablehnen'
  | 'datum'
  | 'pitch'
  | 'bereich'
  | 'email'
  | 'notiz'
  | 'spaeter'

export type QueueHotkeysOptionen = {
  aktiv: boolean
  /** sichtbare Karten/Zeilen in Reihenfolge (über alle Sektionen) */
  keys: readonly string[]
  cursor: string | null
  setCursor: (key: string | null) => void
  onTaste: (key: string, taste: QueueTaste, e: KeyboardEvent) => void
  /** ⌥0 = alle, ⌥1–9 = Chip n */
  onBatch: (n: number) => void
  onNeuSortieren: () => void
  /** `+` = +1, `⇧+` = +5 */
  onZaehler: (delta: number) => void
  /** Esc: Bereichsauswahl aufheben (Popover/Peek schließen ihre eigenen Handler) */
  onEscape?: () => void
}

export function useQueueHotkeys(opts: QueueHotkeysOptionen): void {
  const ref = useRef(opts)
  useEffect(() => {
    ref.current = opts
  })

  const bewege = (delta: number) => {
    const { keys, cursor, setCursor } = ref.current
    if (!keys.length) return
    const i = cursor ? keys.indexOf(cursor) : -1
    const ziel = i < 0 ? (delta > 0 ? 0 : keys.length - 1) : Math.min(keys.length - 1, Math.max(0, i + delta))
    const k = keys[ziel]
    if (k !== undefined && k !== cursor) setCursor(k)
  }
  const taste = (t: QueueTaste) => (e: KeyboardEvent) => {
    const { cursor, onTaste } = ref.current
    if (!cursor) return
    e.preventDefault()
    onTaste(cursor, t, e)
  }
  const batch = (n: number) => () => ref.current.onBatch(n)

  useHotkeys(
    'liste',
    opts.aktiv
      ? {
          j: () => bewege(1),
          k: () => bewege(-1),
          arrowdown: (e) => {
            e.preventDefault()
            bewege(1)
          },
          arrowup: (e) => {
            e.preventDefault()
            bewege(-1)
          },
          enter: taste('kopieren'),
          'mod+enter': taste('kopieren_gesendet'),
          c: taste('kopieren'),
          'shift+e': taste('gesendet_mit_notiz'),
          e: taste('gesendet'),
          o: taste('oeffnen'),
          x: taste('ablehnen'),
          d: taste('datum'),
          p: taste('pitch'),
          n: (e) => {
            // Karten: NotizFeld (M0) bindet N selbst; Abhakzeilen/Antworten: die Seite
            const { cursor, onTaste } = ref.current
            if (cursor) onTaste(cursor, 'notiz', e)
          },
          s: (e) => {
            const { cursor, onTaste } = ref.current
            if (cursor) onTaste(cursor, 'spaeter', e)
          },
          // Space/Esc über useHotkeys, seit M0 beides korrekt behandelt (Integration: Akkord-Erkennung, Stepper fängt Esc selbst)
          space: (e) => {
            const { cursor, onTaste } = ref.current
            if (!cursor) return
            e.preventDefault()
            onTaste(cursor, 'abhaken', e)
          },
          escape: (e) => {
            // Esc aus einem Feld heraus verlässt nur das Feld (Blur in useHotkeys), die Auswahl bleibt
            if (istEingabe(e.target instanceof Element ? e.target : null)) return
            ref.current.onEscape?.()
          },
          'shift+arrowdown': taste('bereich'),
          'alt+m': taste('email'),
          'alt+r': () => ref.current.onNeuSortieren(),
          'alt+0': batch(0),
          'alt+1': batch(1),
          'alt+2': batch(2),
          'alt+3': batch(3),
          'alt+4': batch(4),
          'alt+5': batch(5),
          'alt+6': batch(6),
          'alt+7': batch(7),
          'alt+8': batch(8),
          'alt+9': batch(9),
          // ⇧+ vor + (beide matchen auf US-Layouts bei Shift)
          'shift++': () => ref.current.onZaehler(5),
          '+': () => ref.current.onZaehler(1),
        }
      : {},
    [opts.aktiv],
  )
}
