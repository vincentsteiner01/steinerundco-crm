// Seitenkopf der KPIs: zurück · Überschrift · vor („← Oktober 2026 →“) über die Slots `titelLinks`/`titelRechts` von SeitenKopf.
// Am Telefon sind die Pfeile 44 × 44 px groß wie die Knöpfe des Boards.
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

const PFEIL = 'shrink-0 max-md:h-11! max-md:min-w-11!'

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
        <Button onClick={onZurueck} aria-label={zurueckLabel} title={zurueckLabel} className={PFEIL}>
          ←
        </Button>
      }
      titelRechts={
        <Button onClick={onVor} disabled={!vorMoeglich} aria-label={vorLabel} title={vorLabel} className={PFEIL}>
          →
        </Button>
      }
    />
  )
}
