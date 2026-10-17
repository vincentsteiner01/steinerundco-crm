// WrapUp: verspäteter 20-s-Fokus (ux § 2.5 Schritt 3) nimmt einer schon geöffneten Datumsauswahl den Fokus nicht weg.
// Runde 3: T-08 flackerte auf langsamen Runnern – der 50-ms-Fokus fiel in das offene Popover, Radix schloss es („Fokus außerhalb“)
// und der Klick auf „Morgen“ traf einen abgehängten Knopf. Reihenfolge hier ist deterministisch: Timer feuern nach Verzögerung.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { heuteBerlin } from '@/lib/format'
import { tagPlus } from '@/lib/zeit'

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const h = await import('./_testHilfe')
  return supabaseMock(h.antworten())
})

import { ergebnisNachTaste, WRAPUP_LEER, type WrapUpWerte } from './ergebnisse'
import { WrapUp } from './WrapUp'
import { LEAD_A, rendern } from './_testHilfe'

const DEF_9 = (() => {
  const d = ergebnisNachTaste('9')
  if (!d) throw new Error('Ergebnis 9 fehlt')
  return d
})()

/** Wartet länger als der 50-ms-Fokus der Wrap-up-Zeile; Timer mit kürzerer Verzögerung feuern garantiert vorher. */
const nachDemFokusTimer = () => new Promise((r) => setTimeout(r, 120))

function Huelle({ onWerte }: { onWerte: (w: WrapUpWerte) => void }) {
  const [werte, setWerte] = useState<WrapUpWerte>({ ...WRAPUP_LEER, reachedName: 'Lukas Feldhaus' })
  return (
    <WrapUp
      leadId={LEAD_A.id}
      leadName="Lukas Feldhaus"
      def={DEF_9}
      werte={werte}
      onChange={(w) => {
        setWerte(w)
        onWerte(w)
      }}
      fehlt={[]}
      versucht={false}
      folgeText="Phase Erstgespräch"
      onWeiter={() => {}}
      onWeiterOhne={() => {}}
    />
  )
}

describe('WrapUp – 20-s-Fokus', () => {
  it('ohne eigene Auswahl landet der Fokus im ersten Pflichtfeld (Gesprächspartner)', async () => {
    rendern(<Huelle onWerte={() => {}} />)
    const wrap = screen.getByRole('group', { name: 'Wrap-up' })
    await waitFor(() => expect(within(wrap).getByLabelText(/Gesprächspartner/)).toHaveFocus(), { timeout: 5000 })
  })

  it('ein sofort geöffnetes Datum-Popover bleibt offen; „Morgen“ setzt den Termin', async () => {
    const onWerte = vi.fn()
    rendern(<Huelle onWerte={onWerte} />)
    const wrap = screen.getByRole('group', { name: 'Wrap-up' })
    fireEvent.click(within(wrap).getByLabelText(/Erstgespräch/)) // vor Ablauf der 50 ms
    const eingabe = await screen.findByLabelText('Datum eingeben', {}, { timeout: 5000 })
    await nachDemFokusTimer()
    expect(eingabe).toBeInTheDocument()
    expect(within(wrap).getByLabelText(/Gesprächspartner/)).not.toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Morgen' }))
    expect(onWerte).toHaveBeenLastCalledWith(
      expect.objectContaining({ meetingAt: `${tagPlus(heuteBerlin(), 1)}T09:00` }),
    )
  })
})

describe('WrapUp – nicht erreicht (Feedback 886113f4)', () => {
  it('1 Nicht erreicht: optionales „Nochmal anrufen am“, „Morgen“ setzt den Zeitpunkt', async () => {
    const def1 = ergebnisNachTaste('1')
    if (!def1) throw new Error('Ergebnis 1 fehlt')
    const onWerte = vi.fn()
    function Eins() {
      const [werte, setWerte] = useState<WrapUpWerte>(WRAPUP_LEER)
      return (
        <WrapUp
          leadId={LEAD_A.id}
          leadName="Lukas Feldhaus"
          def={def1}
          werte={werte}
          onChange={(w) => {
            setWerte(w)
            onWerte(w)
          }}
          fehlt={[]}
          versucht={false}
          folgeText="Versuch 2 · Mo 19.10."
          onWeiter={() => {}}
          onWeiterOhne={() => {}}
        />
      )
    }
    rendern(<Eins />)
    expect(screen.getByText('optional – leer: Termin wie unter „Folgeaktion“')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Nochmal anrufen am'))
    await nachDemFokusTimer()
    fireEvent.click(await screen.findByRole('button', { name: /Morgen/ }))
    await waitFor(() => expect(onWerte).toHaveBeenCalled())
    const zuletzt = onWerte.mock.calls.at(-1)?.[0] as WrapUpWerte
    expect(zuletzt.callbackAt?.slice(0, 10)).toBe(tagPlus(heuteBerlin(), 1))
  })
})
