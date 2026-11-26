// Team-Seite (25.11.2026, Neustart) mit den echten Daten-Hooks gegen einen gemockten Supabase-Client: je Person eine Karte in der
// Reihenfolge Vincent · Mike, darunter vier Zahlen – Karten je Liste, gezählt nach Zugehörigkeit. Dazu leeres Board (überall 0),
// Laden und Ladefehler mit „Erneut versuchen“. Nur erfundene Karten.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { kette, type Antwort } from '@/test/supabaseMock'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())

import { BOARD_KEY, type BoardKarte } from '@/data/board'
import { supabase } from '@/data/supabase'
import type { BoardListe } from '@/features/board/listen'
import { Component as TeamSeite } from './TeamSeite'

const V = 'member-v'
const M = 'member-m'
// absichtlich alphabetisch wie aus der Datenbank – die Seite zeigt Vincent · Mike
const MITGLIEDER = [
  { id: M, display_name: 'Mike', short_name: 'Mike', email: 'mike@beispiel.test' },
  { id: V, display_name: 'Vincent', short_name: 'VS', email: 'vincent@beispiel.test' },
]
const KAPUTT: Antwort = { data: null, error: { message: 'Verbindung unterbrochen', code: 'XX000' } }
const NULLEN = ['0 Angeschrieben', '0 Gespräch vereinbart', '0 Im Geschäft', '0 Verloren']

let nr = 0
/** `anzahl` erfundene Karten einer Person in einer Liste. */
function karten(owner: string | null, liste: BoardListe, anzahl: number): BoardKarte[] {
  return Array.from({ length: anzahl }, () => {
    nr += 1
    return {
      id: `karte-${nr}`,
      salutation: 'neutral',
      first_name: 'Petra',
      last_name: `Probelauf ${nr}`,
      full_name: `Petra Probelauf ${nr}`,
      company_name: null,
      linkedin_url: null,
      owner_id: owner,
      board_liste: liste,
      board_seit: '2026-11-25T09:00:00+00:00',
    }
  })
}

/** Was der Supabase-Ersatz je Tabelle antwortet – ein Test darf es zwischendurch ändern („Erneut versuchen“). */
let tabellen: Record<string, Antwort>
const aufrufe = (tabelle: string) => vi.mocked(supabase.from).mock.calls.filter(([t]) => t === tabelle).length

function zeigen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <TeamSeite />
    </QueryClientProvider>,
  )
  return qc
}

const personen = () =>
  screen.queryAllByRole('region').map((r) => within(r).getByRole('heading', { level: 2 }).textContent)
/** Die vier Zeilen einer Person als Text: „3 Angeschrieben“. */
const zeilen = (name: string) =>
  within(screen.getByRole('region', { name }))
    .getAllByRole('listitem')
    .map((li) =>
      Array.from(li.children)
        .map((c) => c.textContent)
        .join(' '),
    )

beforeEach(() => {
  nr = 0
  tabellen = { members: { data: MITGLIEDER, error: null }, leads: { data: [], error: null } }
  vi.mocked(supabase.from)
    .mockReset()
    .mockImplementation(((tabelle: string) => kette(tabellen[tabelle])) as never)
})

describe('Team', () => {
  it('je Person eine Karte (Vincent vor Mike) mit der Zahl ihrer Karten je Liste', async () => {
    tabellen.leads = {
      data: [
        ...karten(V, 'angeschrieben', 3),
        ...karten(M, 'im_geschaeft', 4),
        ...karten(V, 'verloren', 2),
        ...karten(M, 'angeschrieben', 1),
        ...karten(V, 'gespraech', 1),
      ],
      error: null,
    }
    zeigen()
    await screen.findByRole('region', { name: 'Vincent' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Team')
    expect(personen()).toEqual(['Vincent', 'Mike'])
    expect(zeilen('Vincent')).toEqual(['3 Angeschrieben', '1 Gespräch vereinbart', '0 Im Geschäft', '2 Verloren'])
    expect(zeilen('Mike')).toEqual(['1 Angeschrieben', '0 Gespräch vereinbart', '4 Im Geschäft', '0 Verloren'])
  })

  it('zeigt nur Personen und Zahlen: keine Links, keine Knöpfe, kein Zeitraum', async () => {
    tabellen.leads = { data: karten(V, 'angeschrieben', 2), error: null }
    zeigen()
    await screen.findByRole('region', { name: 'Mike' })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Team', 'Vincent', 'Mike'])
  })

  it('Karten ohne Zugehörigkeit oder von Unbekannten zählen bei niemandem', async () => {
    tabellen.leads = {
      data: [
        ...karten(null, 'angeschrieben', 2),
        ...karten('nicht-mehr-dabei', 'verloren', 1),
        ...karten(M, 'gespraech', 1),
      ],
      error: null,
    }
    zeigen()
    await screen.findByRole('region', { name: 'Vincent' })
    expect(zeilen('Vincent')).toEqual(NULLEN)
    expect(zeilen('Mike')).toEqual(['0 Angeschrieben', '1 Gespräch vereinbart', '0 Im Geschäft', '0 Verloren'])
  })

  it('leeres Board: beide Personen stehen da, überall 0', async () => {
    zeigen()
    await screen.findByRole('region', { name: 'Vincent' })
    expect(personen()).toEqual(['Vincent', 'Mike'])
    expect(zeilen('Vincent')).toEqual(NULLEN)
    expect(zeilen('Mike')).toEqual(NULLEN)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('weitere Personen stehen hinter Vincent und Mike, nach Name', async () => {
    tabellen.members = {
      data: [
        { id: 'member-z', display_name: 'Zoe', short_name: 'ZZ', email: 'zoe@beispiel.test' },
        { id: 'member-a', display_name: 'Anton', short_name: 'AA', email: 'anton@beispiel.test' },
        ...MITGLIEDER,
        { id: null, display_name: 'Ohne Konto', short_name: null, email: null },
      ],
      error: null,
    }
    tabellen.leads = { data: karten('member-z', 'im_geschaeft', 5), error: null }
    zeigen()
    await screen.findByRole('region', { name: 'Zoe' })
    expect(personen()).toEqual(['Vincent', 'Mike', 'Anton', 'Zoe'])
    expect(zeilen('Zoe')).toEqual(['0 Angeschrieben', '0 Gespräch vereinbart', '5 Im Geschäft', '0 Verloren'])
  })

  it('Laden: ruhiger Platzhalter, noch keine Karten und keine falschen Nullen', async () => {
    zeigen()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('region')).toBeNull()
    expect(screen.queryByText('Angeschrieben')).toBeNull()
    await screen.findByRole('region', { name: 'Vincent' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('Ladefehler Board: ein Satz und „Erneut versuchen“ – keine Karten mit falschen Nullen; der zweite Versuch lädt', async () => {
    tabellen.leads = KAPUTT
    zeigen()
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Team konnte nicht geladen werden.')
    expect(screen.queryByRole('region')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()

    tabellen.leads = { data: karten(M, 'verloren', 2), error: null }
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    await screen.findByRole('region', { name: 'Mike' })
    expect(zeilen('Mike')).toEqual(['0 Angeschrieben', '0 Gespräch vereinbart', '0 Im Geschäft', '2 Verloren'])
    expect(screen.queryByRole('alert')).toBeNull()
    // nur das Gescheiterte wird neu geladen
    expect(aufrufe('leads')).toBe(2)
    expect(aufrufe('members')).toBe(1)
  })

  it('Ladefehler Mitglieder: derselbe Satz; „Erneut versuchen“ lädt die Personen nach', async () => {
    tabellen.members = KAPUTT
    tabellen.leads = { data: karten(V, 'gespraech', 1), error: null }
    zeigen()
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Team konnte nicht geladen werden.')
    expect(screen.queryByRole('region')).toBeNull()

    tabellen.members = { data: MITGLIEDER, error: null }
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    await screen.findByRole('region', { name: 'Vincent' })
    expect(zeilen('Vincent')).toEqual(['0 Angeschrieben', '1 Gespräch vereinbart', '0 Im Geschäft', '0 Verloren'])
    expect(aufrufe('members')).toBe(2)
    expect(aufrufe('leads')).toBe(1)
  })

  it('scheitert erst ein späteres Neuladen, bleiben die geladenen Zahlen stehen', async () => {
    tabellen.leads = { data: karten(V, 'angeschrieben', 7), error: null }
    const qc = zeigen()
    await screen.findByRole('region', { name: 'Vincent' })

    tabellen.leads = KAPUTT
    await act(() => qc.refetchQueries({ queryKey: BOARD_KEY }))
    await waitFor(() => expect(qc.getQueryState(BOARD_KEY)?.status).toBe('error'))
    expect(zeilen('Vincent')).toEqual(['7 Angeschrieben', '0 Gespräch vereinbart', '0 Im Geschäft', '0 Verloren'])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Zahlen folgen dem Board: nach dem Neuladen steht der neue Stand da', async () => {
    tabellen.leads = { data: karten(V, 'angeschrieben', 2), error: null }
    const qc = zeigen()
    await screen.findByRole('region', { name: 'Vincent' })
    expect(zeilen('Vincent')[0]).toBe('2 Angeschrieben')

    // so kommt eine Änderung der zweiten Person an: Realtime invalidiert alles unter ['leads']
    tabellen.leads = { data: [...karten(V, 'angeschrieben', 1), ...karten(V, 'gespraech', 1)], error: null }
    await act(() => qc.invalidateQueries({ queryKey: ['leads'] }))
    await waitFor(() =>
      expect(zeilen('Vincent')).toEqual(['1 Angeschrieben', '1 Gespräch vereinbart', '0 Im Geschäft', '0 Verloren']),
    )
  })
})
