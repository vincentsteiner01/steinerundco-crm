// M3 – AnrufButton (BAUPLAN § 3.1.10a/§ 3.4, LD-03, T-18): prüft telefonGate inkl. firma_gesperrt, disabledGrund aus
// GATE_GRUND_LABEL, navigiert zum Anruf-Screen. Taste ⌘⇧K (Scope liste/karte/Peek): eigener Listener, damit nur die Instanz in
// der Cursor-Zeile bzw. im Peek reagiert (useHotkeys würde die erste Instanz immer greifen lassen).
import { Phone } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { useLead } from '@/data/leads'
import { useSperrliste } from '@/data/sperrliste'
import { toastFehler } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { sperrlistenEintraege, telefonGate, type TelefonGate } from '@/lib/gates'
import { eventNachBinding, istEingabe } from '@/lib/keyboard'
import { GATE_GRUND_LABEL } from '@/texte/de'
import { istAktiverAnrufButton } from './anrufButtonAktiv'

export function AnrufButton({ leadId, groesse = 'M' }: { leadId: string; groesse?: 'S' | 'M' | 'L' }) {
  const navigate = useNavigate()
  const { data: lead } = useLead(leadId)
  const { data: sperrliste } = useSperrliste()
  const ref = useRef<HTMLButtonElement | null>(null)

  const treffer = sperrlistenEintraege(sperrliste, lead ?? { id: leadId })
  const gate: TelefonGate = lead ? telefonGate(lead, treffer) : { erlaubt: false }
  const grund = lead ? (gate.grund ? GATE_GRUND_LABEL[gate.grund] : undefined) : 'Lädt …'

  const anrufen = () => {
    if (gate.erlaubt) navigate(PFADE.anruf(leadId))
    else toastFehler(grund ?? GATE_GRUND_LABEL.kein_anrufgrund)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented || eventNachBinding(e) !== 'mod+shift+k') return
      const scope = useUiStore.getState().hotkeyScope
      if (scope === 'anruf' || scope === 'formular') return
      if (istEingabe(document.activeElement)) return
      if (!istAktiverAnrufButton(ref.current)) return
      e.preventDefault()
      anrufen()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  })

  return (
    <Button
      ref={ref}
      data-anrufbutton
      data-lead-id={leadId}
      variante={gate.erlaubt ? 'primary' : 'secondary'}
      groesse={groesse}
      icon={Phone}
      kbd="⌘⇧K"
      disabled={!gate.erlaubt}
      disabledGrund={grund}
      aria-label={grund ? `Anrufen – ${grund}` : 'Anrufen'}
      onClick={anrufen}
    >
      Anrufen
    </Button>
  )
}
