// BAUPLAN § 3.3 `useLeadsHotkeys.ts` – Scope liste (ux § 5.3 mit § 1.5 Nr. 23): ⌘↵ Vollseite · ⌥N Lead anlegen · ⌥B Bulk-Menü (nur mit
// Auswahl) · ⌥M E-Mail verfassen · ⌘⇧K Anrufen · ⌘⇧U Übergeben · ⌘⇧F Freigeben · O LinkedIn · ⌫ Filter zurücksetzen · A B S W T N
// Lead-Aktionen der Cursor-Zeile · Z Stapel-Rückgängig. J K ↵ Space ⇧↓ ⌘A E Tab Esc bindet die DataTable (M0) selbst; `/` global.
// ⌥-Tasten werden in lib/keyboard über event.code erkannt.
import { useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { useHotkeys } from '@/lib/keyboard'
import type { LeadAktion } from './aktionsBus'

export type LeadsHotkeyOptionen = {
  cursorId: string | null
  auswahlGroesse: number
  onBulkMenu: () => void
  onAktion: (leadId: string, aktion: LeadAktion) => void
  onZuruecksetzen: () => void
  onEmail: (leadId: string) => void
  onAnrufen: (leadId: string) => void
  onLinkedin: (leadId: string) => void
  aktiv?: boolean
}

export function useLeadsHotkeys(o: LeadsHotkeyOptionen): void {
  const navigate = useNavigate()
  const ref = useRef(o)
  useLayoutEffect(() => {
    ref.current = o
  })
  // Mit offenem Peek gehören A B S W T N, O, ⌘⇧U/⌘⇧F, ⌥M, ⌘⇧K und ⌘↵ dem Panel (dessen Aktionen/Tasten hören selbst). Die
  // ⌘/⌥-Bindungen dürfen dann gar nicht registriert sein: lib/keyboard ruft für sie `preventDefault` VOR dem Handler, und das
  // Panel ignoriert bereits verhinderte Events (Review: ⌘⇧U öffnete das Zeilen-Popover hinter dem Peek, `O` LinkedIn doppelt).
  const peek = useUiStore((s) => !!s.peekLeadId)
  // zusätzlich zur Laufzeit prüfen: zwischen Peek-Öffnen und neuem Render gelten noch die alten Bindungen
  const peekOffen = () => !!useUiStore.getState().peekLeadId
  const aktion = (a: LeadAktion) => () => {
    if (peekOffen()) return
    const { cursorId, onAktion } = ref.current
    if (cursorId) onAktion(cursorId, a)
  }
  const zeilenTasten: Record<string, (e: KeyboardEvent) => void> = peek
    ? {}
    : {
        'mod+enter': () => {
          if (peekOffen()) return
          const id = ref.current.cursorId
          if (id) navigate(PFADE.lead(id))
        },
        'alt+m': () => {
          if (peekOffen()) return
          const { cursorId, onEmail } = ref.current
          if (cursorId) onEmail(cursorId)
        },
        'mod+shift+k': () => {
          if (peekOffen()) return
          const { cursorId, onAnrufen } = ref.current
          if (cursorId) onAnrufen(cursorId)
        },
        'mod+shift+u': aktion('uebergeben'),
        'mod+shift+f': aktion('freigeben'),
        o: () => {
          if (peekOffen()) return
          const { cursorId, onLinkedin } = ref.current
          if (cursorId) onLinkedin(cursorId)
        },
        a: aktion('antwort'),
        b: aktion('beenden'),
        s: aktion('spaeter'),
        w: aktion('wiedervorlage'),
        t: aktion('termin'),
        n: aktion('notiz'),
      }

  useHotkeys(
    'liste',
    o.aktiv === false
      ? {}
      : {
          ...zeilenTasten,
          'alt+n': () => navigate(PFADE.leadNeu),
          'alt+b': () => {
            if (ref.current.auswahlGroesse > 0) ref.current.onBulkMenu()
          },
          backspace: (e) => {
            e.preventDefault()
            ref.current.onZuruecksetzen()
          },
        },
    [o.aktiv, peek],
  )
}
