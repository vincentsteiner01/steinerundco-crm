// Blauer Play-Knopf unter der Suche (29.10.2026): startet mit Agent-Auftrag und öffnet den neuen Lauf, öffnet einen laufenden
// statt einen zweiten anzulegen und zeigt „Freigabe nötig“, wenn ChatGPT auf eine Antwort wartet.
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'

const m = vi.hoisted(() => ({ laeufe: [] as unknown[], starten: vi.fn() }))
vi.mock('@/data/members', () => ({ useMe: () => ({ id: 'me', display_name: 'Mike' }), useMeId: () => 'me' }))
vi.mock('@/data/recherche', () => ({
  useMeineLaeufe: () => ({ data: m.laeufe }),
  useRechercheStarten: () => ({ mutate: m.starten, isPending: false }),
}))

import { RechercheKnopf } from './RechercheKnopf'
import { knopfText } from './start'

const LAUF = { id: 'l1', status: 'laeuft', agent_status: 'arbeitet', gesendet: 4, ziel: 30 }

function rendern(kompakt = false) {
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/heute']}>
        <Routes>
          <Route path="/heute" element={<RechercheKnopf kompakt={kompakt} />} />
          <Route path="/auftrag/recherche/:id" element={<p>Laufseite</p>} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  m.laeufe = []
  m.starten.mockReset()
})

describe('RechercheKnopf', () => {
  it('ohne aktiven Lauf: startet mit dem ChatGPT-Auftrag und öffnet die Laufseite', () => {
    m.starten.mockImplementation((_a: string, o: { onSuccess: (l: { id: string }) => void }) =>
      o.onSuccess({ id: 'neu' }),
    )
    rendern()
    fireEvent.click(screen.getByRole('button', { name: 'Recherche starten' }))
    expect(m.starten).toHaveBeenCalledWith(expect.stringContaining('im Namen von Mike'), expect.anything())
    expect(screen.getByText('Laufseite')).toBeInTheDocument()
  })

  it('laufender Lauf: zeigt Fortschritt und öffnet ihn statt neu zu starten', () => {
    m.laeufe = [LAUF]
    rendern()
    fireEvent.click(screen.getByRole('button', { name: 'Recherche läuft · 4/30' }))
    expect(m.starten).not.toHaveBeenCalled()
    expect(screen.getByText('Laufseite')).toBeInTheDocument()
  })

  it('Freigabe nötig – auch in der Icon-Rail als Beschriftung', () => {
    m.laeufe = [{ ...LAUF, agent_status: 'frage' }]
    rendern(true)
    expect(screen.getByRole('button', { name: 'Freigabe nötig' })).toBeInTheDocument()
    expect(knopfText(undefined)).toBe('Recherche starten')
    expect(knopfText({ ...LAUF, status: 'pausiert' } as never)).toBe('Recherche pausiert')
  })
})
