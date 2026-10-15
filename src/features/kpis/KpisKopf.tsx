// Seitenkopf der KPIs mit Monatswechsel `←` Headline `→` (DESIGN-SYSTEM § 5.15, reference.html „monthnav“) – seit der
// Integration über die M0-Slots `titelLinks`/`titelRechts` von SeitenKopf (vorher lokale Kopie, FOUNDATION-WUNSCH M5).
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { SeitenKopf } from '@/components/ui/SeitenKopf'

export type KpisKopfProps = {
  dateline: string
  titel: string
  onZurueck: () => void
  onVor: () => void
  vorMoeglich: boolean
  zurueckLabel: string
  vorLabel: string
  rechts?: ReactNode
}

export function KpisKopf({
  dateline,
  titel,
  onZurueck,
  onVor,
  vorMoeglich,
  zurueckLabel,
  vorLabel,
  rechts,
}: KpisKopfProps) {
  return (
    <SeitenKopf
      titel={titel}
      dateline={dateline}
      rechts={rechts}
      titelLinks={
        <Button
          groesse="S"
          onClick={onZurueck}
          aria-label={zurueckLabel}
          title={`${zurueckLabel} ←`}
          className="font-mono"
        >
          ←
        </Button>
      }
      titelRechts={
        <Button
          groesse="S"
          onClick={onVor}
          disabled={!vorMoeglich}
          aria-label={vorLabel}
          title={`${vorLabel} →`}
          className="font-mono"
        >
          →
        </Button>
      }
    />
  )
}
