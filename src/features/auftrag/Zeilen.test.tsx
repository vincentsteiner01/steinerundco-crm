// Auftragsseite, Opener mit „Individuelles Kompliment“ (29.10.2026, Feedback adbd7d5f): Der Agent schreibt das Kompliment in ein
// Feld, der Nachrichtentext aktualisiert sich, erst dann ist „Gesendet“ frei. Nach „Hat geantwortet“ der Hinweis, den Chat auf
// LinkedIn wieder als ungelesen zu markieren (448a060a).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { queueItem } from '@/test/fixtures/queue'

const BODY =
  'Hallo Herr [Nachname], schön, dass wir vernetzt sind.\n\n[Kurzes individuelles Kompliment] :)\n\nDarf ich Sie direkt fragen?'

vi.mock('@/features/heute/useKarteDaten', async () => {
  const { useKartenZustand } = await import('@/features/heute/kartenStore')
  const { nachrichtErgebnis } = await import('@/features/heute/nachricht')
  return {
    useKarteDaten: () => {
      const zustand = useKartenZustand('k1')
      const ergebnis = nachrichtErgebnis(
        BODY,
        { last_name: 'Muster', salutation: 'herr' },
        { werte: zustand.werte },
        null,
      )
      return {
        key: 'k1',
        zustand,
        ergebnis,
        vorlage: { id: 't1', name: 'Individuelles Kompliment' },
        setzeAnrede: vi.fn(),
      }
    },
  }
})
vi.mock('@/data/sequences', () => ({ useSequencesIndex: () => ({ data: undefined }) }))

import { NachrichtZeile } from './Zeilen'

function rendern() {
  const item = queueItem('heute', 1, {
    item_kind: 'sequenz_schritt',
    lead_name: 'Max Muster',
    linkedin_url: 'linkedin.com/in/max-muster',
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <NachrichtZeile item={item} nr={1} gesamt={1} status={undefined} setStatus={vi.fn()} art="opener" />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe('NachrichtZeile – Individuelles Kompliment', () => {
  it('Feld für das Kompliment; Text folgt der Eingabe; „Gesendet“ erst danach frei', () => {
    rendern()
    const gesendet = screen.getByRole('button', { name: /^Gesendet/ })
    expect(gesendet).toBeDisabled()
    const feld = screen.getByLabelText('Kurzes individuelles Kompliment')
    fireEvent.change(feld, { target: { value: 'Spannend, dass Sie KI schon im Kundenservice einsetzen.' } })
    const text = document.querySelector('[data-auftrag-nachricht]')
    expect(text).toHaveTextContent('Spannend, dass Sie KI schon im Kundenservice einsetzen. :)')
    expect(text).not.toHaveTextContent('[Kurzes individuelles Kompliment]')
    expect(screen.getByRole('button', { name: /^Gesendet/ })).toBeEnabled()
    // Feld bleibt stehen, auch wenn der Platzhalter jetzt gefüllt ist
    expect(screen.getByLabelText('Kurzes individuelles Kompliment')).toBeInTheDocument()
  })

  it('„Hat geantwortet“ erinnert daran, den Chat als ungelesen zu markieren', () => {
    rendern()
    fireEvent.click(screen.getByRole('button', { name: 'Hat geantwortet' }))
    expect(document.querySelector('[data-auftrag-ungelesen]')).toHaveTextContent('als ungelesen markieren')
  })
})
