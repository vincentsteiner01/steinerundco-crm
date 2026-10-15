// Gemeinsames der Lead-Aktionen (BAUPLAN § 3.1.10b): Props-Vertrag, Offen-Zustand, Tastenbindung im Scope karte/liste,
// Tasten im geöffneten Popover/Dialog, Nachlese der vom Trigger erzeugten Aktivität für den Undo-Toast, Invalidierung.
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { qk } from '@/data/queryKeys'
import { eventNachBinding, istEingabe, useHotkeys, type Scope } from '@/lib/keyboard'

/** § 3.1.10b: jede Aktion hat genau diese Props; die Taste gilt, wenn `trigger` fehlt und `aktiv` gesetzt ist. */
export type AktionProps = {
  leadId: string
  enrollmentId?: string | null
  taskId?: string | null
  /** Eigener Auslöser (Button, Menüeintrag). Ohne `trigger` rendert die Aktion ihren Standard-Button und hört auf ihre Taste. */
  trigger?: ReactNode
  offen?: boolean
  onOpenChange?: (offen: boolean) => void
  onFertig?: () => void
  /** Karte/Zeile unter dem Cursor: nur dann ist die Taste belegt. */
  aktiv?: boolean
  className?: string
}

/** Kontrolliert (`offen`/`onOpenChange`) oder unkontrolliert. */
export function useOffen(offen?: boolean, onOpenChange?: (o: boolean) => void): [boolean, (o: boolean) => void] {
  const [intern, setIntern] = useState(false)
  const ist = offen ?? intern
  const setze = useCallback(
    (o: boolean) => {
      if (offen === undefined) setIntern(o)
      onOpenChange?.(o)
    },
    [offen, onOpenChange],
  )
  return [ist, setze]
}

/** Bindet `taste` im Scope (Standard `karte`), solange `aktivieren` gilt – d. h. `trigger` fehlt und `aktiv` ist. */
export function useAktionTaste(
  taste: string,
  aktivieren: boolean,
  fn: (e: KeyboardEvent) => void,
  scope: Scope = 'karte',
): void {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useHotkeys(scope, aktivieren ? { [taste]: (e) => ref.current(e) } : {}, [aktivieren, taste])
}

/**
 * Tasten im geöffneten Popover/Dialog (Ziffern 1–9, D, ⌘Enter): Capture-Listener auf `document`, damit die
 * Karten-Hotkeys (bubbling) nichts davon sehen. Einzeltasten bleiben in Eingabefeldern dem Tippen vorbehalten.
 * `handler` gibt `true` zurück, wenn die Taste verbraucht wurde.
 */
export function useTastenWaehrendOffen(
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
      if (istEingabe(document.activeElement) && !b.startsWith('mod+')) return
      if (ref.current(b, e)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [offen])
}

/** Nachlese der Trigger-Zeile: eine Implementierung in der Daten-Schicht (Integration M1–M8). */
export { nachleseAktivitaet } from '@/data/activities'

/** Invalidiert alles, was eine Lead-Aktion berühren kann (Detail, Listen, Queue, Timeline, Sequenzen, Aufgaben, Nav, KPIs). */
export function useLeadInvalidierung(): (leadId: string) => void {
  const qc = useQueryClient()
  return useCallback(
    (leadId: string) => {
      void qc.invalidateQueries({ queryKey: qk.leads.detail(leadId) })
      void qc.invalidateQueries({ queryKey: qk.leads.all })
      void qc.invalidateQueries({ queryKey: qk.queue.all })
      void qc.invalidateQueries({ queryKey: qk.activities(leadId) })
      void qc.invalidateQueries({ queryKey: qk.enrollments(leadId) })
      void qc.invalidateQueries({ queryKey: qk.tasks.lead(leadId) })
      void qc.invalidateQueries({ queryKey: ['tasks', 'faellig'] })
      void qc.invalidateQueries({ queryKey: qk.nav })
      void qc.invalidateQueries({ queryKey: qk.kpis.all })
    },
    [qc],
  )
}

/** Text ohne Leerraum an den Enden; leer → null. */
export const getrimmt = (s: string): string | null => {
  const t = s.trim()
  return t.length ? t : null
}
