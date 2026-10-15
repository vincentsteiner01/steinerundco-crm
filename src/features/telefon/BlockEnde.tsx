// M3 – Block-Ende (BAUPLAN § 3.4 BlockEnde.tsx, ux § 2.5 Schritt 4, T-12): Dials · Erreicht · Entscheider · Termine · Rückrufe ·
// Ø Dauer aus `useCallsSession(sessionKey(me, start))` – alle eigenen Anrufe seit Block-Start (calls hat keine Session-Spalte).
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { sessionKey, useCallsSession } from '@/data/calls'
import { Dialog } from '@/components/ui/Dialog'
import { fmtDauer, fmtZeit } from '@/lib/format'
import type { CallOutcomeDef } from '@/types/domain'
import { blockBeenden, blockDauerSec, type CallBlockSession } from './CallBlock'
import { blockZusammenfassung } from './zusammenfassung'

export type BlockEndeProps = {
  session: CallBlockSession
  me: string | null
  defs?: readonly CallOutcomeDef[] | null
  onSchliessen: () => void
}

export function BlockEnde({ session, me, defs, onSchliessen }: BlockEndeProps) {
  const navigate = useNavigate()
  const { data: calls } = useCallsSession(me ? sessionKey(me, session.start) : null)
  const z = blockZusammenfassung(calls ?? [], defs)
  const zeilen: { label: string; wert: string }[] = [
    { label: 'Dials', wert: String(z.dials) },
    { label: 'Erreicht', wert: String(z.erreicht) },
    { label: 'Entscheider', wert: String(z.entscheider) },
    { label: 'Termine', wert: String(z.termine) },
    { label: 'Rückrufe vereinbart', wert: String(z.rueckrufe) },
    { label: 'Ø Dauer', wert: fmtDauer(z.dauerSec) },
  ]
  const beenden = (zuHeute: boolean) => {
    blockBeenden()
    onSchliessen()
    if (zuHeute) navigate(PFADE.heute)
  }
  return (
    <Dialog
      offen
      onOpenChange={(o) => {
        if (!o) beenden(false)
      }}
      titel="Call-Block beendet"
      text={`Seit ${fmtZeit(session.start)} · ${fmtDauer(blockDauerSec(session))}`}
      abbrechen="Schließen"
      primaer={{ label: 'Zu Heute', onClick: () => beenden(true) }}
      kinder={
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2" data-testid="block-zusammenfassung">
          {zeilen.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-ui text-ink-2">{r.label}</dt>
              <dd className="text-ink-bright tnum text-right font-mono text-[16px] font-medium">{r.wert}</dd>
            </div>
          ))}
        </dl>
      }
    />
  )
}
