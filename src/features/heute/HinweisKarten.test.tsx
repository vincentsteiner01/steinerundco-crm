// HinweisKarten.test.tsx (ux § 3.1.1 Nr. 6, H-17): max. 2 Karten; „Backup vor n Tagen“ ab 7 Tagen, weg nach Backup;
// Annahmequote < 20 %; Wochenbudget erreicht (Amber); freigegebene Leads; „Ausblenden (heute)“ merkt sich localStorage.
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())

import { useAuth } from '@/features/auth/authStore'
import type { LinkedinBudget } from '@/lib/gates'
import { SETTINGS } from '@/test/fixtures/settings'
import { ANTWORTEN, ICH, rendern, zuruecksetzen } from './_testHilfe'
import { HinweisKarten } from './HinweisKarten'

const HEUTE = '2026-10-14'
const BUDGET: LinkedinBudget = { moeglich: 18, warnung: false, erreicht: false, wochenbudget: 150, tagesziel: 30 }

function zeigen(p: { budget?: Partial<LinkedinBudget>; quote?: number | null; backupAm?: string | null } = {}) {
  ANTWORTEN.settings = {
    ...(SETTINGS as unknown as Record<string, unknown>),
    ...(p.backupAm === undefined ? { backup: { last_at: '2026-10-13T20:00:00+02:00' } } : {}),
    ...(p.backupAm ? { backup: { last_at: p.backupAm } } : {}),
  }
  const props = {
    heute: HEUTE,
    budget: { ...BUDGET, ...p.budget },
    annahmeQuote7: p.quote ?? null,
    onFreigegeben: vi.fn(),
    onBackup: vi.fn(),
    onZiele: vi.fn(),
  }
  return { props, ...rendern(<HinweisKarten {...props} />) }
}

describe('HinweisKarten', () => {
  beforeEach(() => {
    zuruecksetzen()
    localStorage.clear()
    useAuth.setState({ status: 'mitglied', member: ICH })
  })

  it('H-17: „Letztes Backup vor 9 Tagen“ ab 7 Tagen, mit Aktion „Backup“', async () => {
    const { props } = zeigen({ backupAm: '2026-10-05T10:00:00+02:00' })
    expect(await screen.findByText('Letztes Backup vor 9 Tagen – jetzt sichern')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Backup' }))
    expect(props.onBackup).toHaveBeenCalled()
  })

  it('H-17: Backup vor 6 Tagen → kein Hinweis (verschwindet nach dem Download)', async () => {
    zeigen({ backupAm: '2026-10-08T10:00:00+02:00' })
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByText(/Backup/)).not.toBeInTheDocument()
  })

  it('ohne Backup-Datum: „Noch kein Backup – jetzt sichern“', async () => {
    zeigen({ backupAm: null })
    expect(await screen.findByText('Noch kein Backup – jetzt sichern')).toBeInTheDocument()
  })

  it('Annahmequote unter 20 % und Wochenbudget erreicht – höchstens zwei Karten', async () => {
    ANTWORTEN.frei = [
      { id: 'l1', full_name: 'Timo Kranich', company_name: 'Nordwind', released_reason: 'Kontakt entfernt' },
    ]
    zeigen({ budget: { erreicht: true, moeglich: 0 }, quote: 0.12, backupAm: null })
    expect(await screen.findByText('Wochenbudget erreicht – weitere Anfragen auf eigenes Risiko')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/freigegebener Lead/)).toBeInTheDocument())
    expect(screen.getByText(/freigegebener Lead/)).toHaveTextContent(
      '1 freigegebener Lead · Timo Kranich, Nordwind – „Kontakt entfernt“',
    )
    expect(screen.queryByText(/Annahmequote/)).not.toBeInTheDocument() // dritte Karte fällt weg
  })

  it('„Ausblenden (heute)“ blendet für heute aus (localStorage)', async () => {
    zeigen({ quote: 0.1 })
    expect(await screen.findByText(/Annahmequote 10\s%/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ausblenden/ }))
    await waitFor(() => expect(screen.queryByText(/Annahmequote/)).not.toBeInTheDocument())
    expect(localStorage.getItem(`crm.heute.hinweis.annahme.${HEUTE}`)).toBe('aus')
  })
})
