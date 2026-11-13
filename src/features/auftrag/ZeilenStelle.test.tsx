// Auftragsseite, Wiedereröffnung nach Stellenanzeige (13.11.2026, Mikes Gesprächsöffnungen): Der Agent wählt erst die Stelle,
// die die Firma gerade sucht – dann steht der passende Text da und „Gesendet“ wird frei.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { useKartenStore } from '@/features/heute/kartenStore'
import { queueItem } from '@/test/fixtures/queue'

const T = (id: string, key: string, body: string) => ({ id, key, name: key, body, active: true })
const TEMPLATES = [
  T('t-pl', 'li_projektleiter_neue_eroeffnung', 'Hallo [Anrede] [Nachname],\n\nSie suchen Projektleiter.'),
  T('t-bu', 'li_bueromitarbeiter_neue_eroeffnung', 'Hallo [Anrede] [Nachname],\n\nSie suchen Verstärkung fürs Büro.'),
  T('t-el', 'li_elektriker_neue_eroeffnung', 'Hallo [Anrede] [Nachname],\n\nSie suchen Elektriker.'),
  T('t-ke', 'li_keine_mitarbeitersuche_neue_eroeffnung', 'Hallo [Anrede] [Nachname],\n\nSie sind im Solarbereich tätig.'),
]

vi.mock('@/features/heute/useKarteDaten', async () => {
  const { useKartenZustand } = await import('@/features/heute/kartenStore')
  const { nachrichtErgebnis } = await import('@/features/heute/nachricht')
  return {
    useKarteDaten: () => {
      const zustand = useKartenZustand('k1')
      // wie vorlageFuerKarte: gewählte Vorlage, sonst die des Schritts („Keine Mitarbeitersuche“)
      const vorlage = TEMPLATES.find((t) => t.id === (zustand.vorlageId ?? 't-ke')) ?? null
      const ergebnis = nachrichtErgebnis(
        vorlage?.body,
        { last_name: 'Muster', salutation: 'herr' },
        { werte: zustand.werte },
        null,
      )
      return { key: 'k1', zustand, ergebnis, vorlage, templates: TEMPLATES, setzeAnrede: vi.fn() }
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
    template_id: 't-ke',
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <NachrichtZeile item={item} nr={1} gesamt={1} status={undefined} setStatus={vi.fn()} art="follow_up" />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe('NachrichtZeile – Wiedereröffnung nach Stellenanzeige', () => {
  beforeEach(() => useKartenStore.setState({ karten: {} }))

  it('„Gesendet“ ist gesperrt, bis eine Stelle gewählt ist', () => {
    rendern()
    expect(document.querySelector('[data-auftrag-stelle]')).toHaveTextContent('Stellenanzeige prüfen')
    expect(screen.getByRole('button', { name: /^Gesendet/ })).toBeDisabled()
  })

  it('die gewählte Stelle bestimmt den Text', () => {
    rendern()
    fireEvent.click(screen.getByRole('button', { name: 'Elektriker' }))
    const text = document.querySelector('[data-auftrag-nachricht]')
    expect(text).toHaveTextContent('Hallo Herr Muster,')
    expect(text).toHaveTextContent('Sie suchen Elektriker.')
    expect(screen.getByRole('button', { name: 'Elektriker' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Gesendet/ })).toBeEnabled()
  })

  it('„Keine passende Stelle“ nimmt die Vorlage „Keine Mitarbeitersuche“', () => {
    rendern()
    fireEvent.click(screen.getByRole('button', { name: 'Keine passende Stelle' }))
    expect(document.querySelector('[data-auftrag-nachricht]')).toHaveTextContent('Sie sind im Solarbereich tätig.')
    expect(screen.getByRole('button', { name: /^Gesendet/ })).toBeEnabled()
  })
})
