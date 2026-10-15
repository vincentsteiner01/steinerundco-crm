// BAUPLAN § 3.3 `usePipelineHotkeys.ts` (ux § 3.4, § 5.3): J/K Karte, H/L Spalte, ⇧→/⇧← verschiebt die fokussierte Karte eine Phase
// vor/zurück (mit denselben Popovers), Enter Peek. Scope `liste`; ⌥-/⌘-Kombinationen bleiben bei LeadsSeite/global.
// Bei offenem Peek gehören ←/→ dem Peek (Lead wechseln, PeekPanel); J/K bewegen den Cursor, die Seite zieht `?lead=` nach.
import { useLayoutEffect, useRef } from 'react'
import { useUiStore } from '@/app/uiStore'
import { useHotkeys } from '@/lib/keyboard'
import type { PhaseKey } from '@/types/domain'

export type PipelineCursor = { spalte: PhaseKey; leadId: string | null }

export type PipelineHotkeyOptionen = {
  spalten: readonly { key: PhaseKey; ids: readonly string[]; eingeklappt: boolean }[]
  cursor: PipelineCursor
  setCursor: (c: PipelineCursor) => void
  onEnter: (leadId: string) => void
  onVerschieben: (leadId: string, richtung: 1 | -1) => void
  aktiv?: boolean
}

/** Nächste Karte in der Spalte (am Rand bleibt der Cursor stehen). */
export function karteSchritt(
  o: Pick<PipelineHotkeyOptionen, 'spalten' | 'cursor'>,
  richtung: 1 | -1,
): PipelineCursor | null {
  const sp = o.spalten.find((s) => s.key === o.cursor.spalte)
  if (!sp || sp.ids.length === 0) return null
  const i = o.cursor.leadId ? sp.ids.indexOf(o.cursor.leadId) : -1
  const n = Math.min(Math.max(i + richtung, 0), sp.ids.length - 1)
  return { spalte: sp.key, leadId: sp.ids[n] ?? null }
}

/** Nächste offene (nicht eingeklappte) Spalte; die Zeilenposition bleibt so weit wie möglich erhalten. */
export function spalteSchritt(
  o: Pick<PipelineHotkeyOptionen, 'spalten' | 'cursor'>,
  richtung: 1 | -1,
): PipelineCursor | null {
  const offen = o.spalten.filter((s) => !s.eingeklappt)
  const i = offen.findIndex((s) => s.key === o.cursor.spalte)
  const n = Math.min(Math.max((i < 0 ? 0 : i) + richtung, 0), offen.length - 1)
  const ziel = offen[n]
  if (!ziel) return null
  const alterIndex = o.cursor.leadId
    ? (o.spalten.find((s) => s.key === o.cursor.spalte)?.ids.indexOf(o.cursor.leadId) ?? 0)
    : 0
  return { spalte: ziel.key, leadId: ziel.ids[Math.min(Math.max(alterIndex, 0), ziel.ids.length - 1)] ?? null }
}

export function usePipelineHotkeys(o: PipelineHotkeyOptionen): void {
  const ref = useRef(o)
  useLayoutEffect(() => {
    ref.current = o
  })

  const karte = (richtung: 1 | -1) => {
    const c = karteSchritt(ref.current, richtung)
    if (c) ref.current.setCursor(c)
  }
  const spalte = (richtung: 1 | -1) => {
    const c = spalteSchritt(ref.current, richtung)
    if (c) ref.current.setCursor(c)
  }
  const peekOffen = () => !!useUiStore.getState().peekLeadId

  useHotkeys(
    'liste',
    o.aktiv === false
      ? {}
      : {
          j: () => karte(1),
          arrowdown: (e) => {
            e.preventDefault()
            karte(1)
          },
          k: () => karte(-1),
          arrowup: (e) => {
            e.preventDefault()
            karte(-1)
          },
          l: () => spalte(1),
          arrowright: (e) => {
            if (peekOffen()) return
            e.preventDefault()
            spalte(1)
          },
          h: () => spalte(-1),
          arrowleft: (e) => {
            if (peekOffen()) return
            e.preventDefault()
            spalte(-1)
          },
          'shift+arrowright': () => {
            const { cursor, onVerschieben } = ref.current
            if (cursor.leadId) onVerschieben(cursor.leadId, 1)
          },
          'shift+arrowleft': () => {
            const { cursor, onVerschieben } = ref.current
            if (cursor.leadId) onVerschieben(cursor.leadId, -1)
          },
          enter: () => {
            const { cursor, onEnter } = ref.current
            if (cursor.leadId) onEnter(cursor.leadId)
          },
        },
    [o.aktiv],
  )
}
