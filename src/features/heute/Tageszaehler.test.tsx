// Tageszaehler.test.tsx (BAUPLAN § 3.2 Unit-Tests, H-11/H-12): Direkteingabe 40 bei 12 getrackten → manueller Anteil 28;
// Heute noch möglich = max(0, min(Tagesziel − heute, Wochenbudget − Woche)); Warnschwelle (90 %) in Amber; bei 0 der Hinweis
// „Wochenbudget erreicht – weitere Anfragen auf eigenes Risiko“; +1/+5 als Delta; Kanalzeile mit denselben Zahlen.
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())
vi.mock('@/components/toast', async () => (await import('./_testHilfe')).toastMock())

import { supabase } from '@/data/supabase'
import { useMe } from '@/data/members'
import { useAuth } from '@/features/auth/authStore'
import { heuteBerlin } from '@/lib/format'
import { tagPlus } from '@/lib/zeit'
import { ANTWORTEN, ICH, rendern, rpcAufrufe, zuruecksetzen } from './_testHilfe'
import { MEMBER_V } from '@/test/fixtures/leads'
import { Kanalzeile } from './Kanalzeile'
import { BUDGET_ERREICHT_TEXT, Tageszaehler } from './Tageszaehler'
import { useTageszaehler } from './useTageszaehler'

const HEUTE = heuteBerlin()
/** Fußzeilen des Tageszählers (Text über mehrere Spans – getByText sieht nur direkte Textknoten). */
const fuss = () => document.querySelector('[data-tageszaehler-fuss]') as HTMLElement
const fussZeile = (re: RegExp) =>
  [...fuss().querySelectorAll('p')].find((p) => re.test(p.textContent ?? '')) as HTMLElement

function Pruefling() {
  const me = useMe()
  const tz = useTageszaehler(MEMBER_V, me)
  return (
    <>
      <Kanalzeile daten={tz} linkedin telefon={false} onListeEinfuegen={vi.fn()} onCallBlock={vi.fn()} />
      <Tageszaehler daten={tz} onListeEinfuegen={vi.fn()} />
    </>
  )
}

/** Tageswerte: heute `heute`, an den sechs Tagen davor zusammen `rest` (gleichmäßig verteilt). */
function tage(heute: number, rest: number, angenommen = 0) {
  ANTWORTEN.daily = [
    { member_id: MEMBER_V, day: HEUTE, vernetzungen_versendet: heute, vernetzungen_angenommen: angenommen },
    ...Array.from({ length: 6 }, (_, i) => ({
      member_id: MEMBER_V,
      day: tagPlus(HEUTE, -(i + 1)),
      vernetzungen_versendet: i === 0 ? rest - 5 * Math.floor(rest / 6) : Math.floor(rest / 6),
      vernetzungen_angenommen: 0,
    })),
  ]
}
function getrackt(n: number) {
  ANTWORTEN.activities = Array.from({ length: n }, (_, i) => ({
    id: 1000 + i,
    member_id: MEMBER_V,
    type: 'vernetzung_gesendet',
    occurred_at: new Date().toISOString(),
  }))
}

describe('Tageszähler', () => {
  beforeEach(() => {
    zuruecksetzen()
    useAuth.setState({ status: 'mitglied', member: ICH })
    vi.mocked(supabase.rpc).mockClear()
  })

  it('H-11: Direkteingabe 40 bei 12 getrackten setzt den manuellen Anteil auf 28', async () => {
    tage(12, 0)
    getrackt(12)
    // Server-Simulation: set_counter(delta) addiert auf den manuellen Anteil, die View zeigt getrackt + manuell
    ANTWORTEN.rpc.set_counter = (args) => {
      const z = ANTWORTEN.daily[0]!
      z.vernetzungen_versendet = (z.vernetzungen_versendet ?? 0) + (args.p_value as number)
      return { data: null, error: null }
    }
    rendern(<Pruefling />)
    await waitFor(() => expect(fuss()).toHaveTextContent('12 davon mit Profil erfasst'))
    const feld = screen.getByLabelText('Zähler setzen')
    await waitFor(() => expect(feld).toHaveValue('12'))
    fireEvent.change(feld, { target: { value: '40' } })
    fireEvent.blur(feld)
    await waitFor(() => expect(rpcAufrufe(supabase.rpc).length).toBe(1))
    expect(rpcAufrufe(supabase.rpc)[0]).toEqual([
      'set_counter',
      { p_metric: 'vernetzungen_versendet', p_value: 28, p_date: HEUTE, p_member_id: MEMBER_V, p_delta: true },
    ])
    await waitFor(() => expect(screen.getByLabelText('Zähler setzen')).toHaveValue('40'))
    expect(fuss()).toHaveTextContent('12 davon mit Profil erfasst · 28 manuell')
  })

  it('Direkteingabe unter dem getrackten Wert fällt auf „nur getrackt“ zurück (manuell nie < 0)', async () => {
    tage(20, 0)
    getrackt(12)
    rendern(<Pruefling />)
    const feld = await screen.findByLabelText('Zähler setzen')
    await waitFor(() => expect(feld).toHaveValue('20'))
    fireEvent.change(feld, { target: { value: '5' } })
    fireEvent.blur(feld)
    await waitFor(() => expect(rpcAufrufe(supabase.rpc).length).toBe(1))
    expect(rpcAufrufe(supabase.rpc)[0]?.[1]).toMatchObject({ p_value: -8, p_delta: true })
  })

  it('+1 / +5 schreiben ein Delta (H-11)', async () => {
    tage(3, 0)
    rendern(<Pruefling />)
    await waitFor(() => expect(fuss()).toHaveTextContent(/davon mit Profil erfasst/))
    fireEvent.click(screen.getAllByRole('button', { name: '+5' })[0]!)
    await waitFor(() => expect(rpcAufrufe(supabase.rpc)[0]?.[1]).toMatchObject({ p_value: 5, p_delta: true }))
  })

  it('H-12: Heute noch möglich = min(30 − 12, 150 − 130) = 18; keine Warnung unter 90 %', async () => {
    tage(12, 118)
    rendern(<Pruefling />)
    await waitFor(() => expect(fuss()).toHaveTextContent(/Woche 130\s*\/\s*150 · .*Heute noch möglich 18/))
    expect(fussZeile(/Woche/)).not.toHaveClass('text-overdue')
    expect(screen.queryByText(BUDGET_ERREICHT_TEXT)).not.toBeInTheDocument()
    expect(document.querySelector('[data-kanalzeile]')).toHaveTextContent(/Heute noch möglich\s*18/)
  })

  it('H-12: Woche 140 / 150 → möglich min(18, 10) = 10 und Amber-Warnung ab 90 %', async () => {
    tage(12, 128)
    rendern(<Pruefling />)
    await waitFor(() => expect(fuss()).toHaveTextContent(/Woche 140\s*\/\s*150 · .*Heute noch möglich 10/))
    expect(fussZeile(/Woche/)).toHaveClass('text-overdue')
  })

  it('H-12: Wochenbudget erreicht → 0 möglich, Hinweis „auf eigenes Risiko“', async () => {
    tage(20, 135)
    rendern(<Pruefling />)
    expect(await screen.findByText(BUDGET_ERREICHT_TEXT)).toHaveClass('text-overdue')
    expect(fuss()).toHaveTextContent(/Heute noch möglich 0/)
  })

  it('Annahmequote (7 T) = angenommen ÷ versendet und Monat/gestern im Fuß', async () => {
    tage(10, 30, 8)
    rendern(<Pruefling />)
    await waitFor(() => expect(fuss()).toHaveTextContent(/Annahme \(7 T\) 20\s%/))
    expect(fussZeile(/bisher/)).toHaveTextContent(/Ziel 30\/Tag · gestern \d+/)
  })
})
