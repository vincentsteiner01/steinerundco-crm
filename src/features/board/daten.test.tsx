// Daten-Schicht des Boards (src/data/board.ts) gegen einen gemockten Supabase-Client: Abfrage, optimistisches Verschieben mit
// Zurückrollen, „Rückgängig“ mit board_seit, Anlegen über das RPC, Lead-Blatt speichern. Nur erfundene Namen.
// Die Regeln der Datenbank selbst (Trigger, RPC) prüft supabase/tests/board_test.sql.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { kette, type Antwort } from '@/test/supabaseMock'

const m = vi.hoisted(() => ({ toastFehler: vi.fn() }))
vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/components/toast', () => ({ toastFehler: m.toastFehler, toast: vi.fn(), toastUndo: vi.fn() }))

import {
  BOARD_KEY,
  sortiereKarten,
  useBoardKarten,
  useKarteAnlegen,
  useKarteSpeichern,
  useKarteVerschieben,
  type BoardKarte,
} from '@/data/board'
import { supabase } from '@/data/supabase'

const V = 'member-v'
const T0 = '2026-11-24T08:00:00+00:00'
const T1 = '2026-11-25T09:00:00+00:00'

function karte(
  id: string,
  liste: BoardKarte['board_liste'],
  seit: string,
  patch: Partial<BoardKarte> = {},
): BoardKarte {
  return {
    id,
    salutation: 'frau',
    first_name: 'Petra',
    last_name: 'Probelauf',
    full_name: 'Petra Probelauf',
    company_name: null,
    linkedin_url: 'https://www.linkedin.com/in/petra-probelauf/',
    owner_id: V,
    board_liste: liste,
    board_seit: seit,
    ...patch,
  }
}

type Kette = Record<string, ReturnType<typeof vi.fn>>
let ketten: Kette[] = []

/** Jeder `supabase.from()`-Aufruf bekommt die nächste Antwort (die letzte gilt weiter). */
function antworten(...folge: Antwort[]) {
  let i = 0
  vi.mocked(supabase.from).mockImplementation((() => {
    const k = kette(folge[Math.min(i++, folge.length - 1)])
    ketten.push(k as Kette)
    return k
  }) as never)
}

function umgebung(start?: BoardKarte[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  if (start) qc.setQueryData(BOARD_KEY, start)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper, board: () => qc.getQueryData<BoardKarte[]>(BOARD_KEY) ?? [] }
}

beforeEach(() => {
  ketten = []
  m.toastFehler.mockClear()
  vi.mocked(supabase.from).mockReset()
  vi.mocked(supabase.rpc).mockReset()
})

describe('useBoardKarten', () => {
  it('lädt nur Karten auf dem Board, ohne Papierkorb, neueste oben – und fasst stage nicht an', async () => {
    antworten({ data: [karte('a', 'angeschrieben', T1), karte('b', 'gespraech', T0)], error: null })
    const { wrapper } = umgebung()
    const { result } = renderHook(() => useBoardKarten(), { wrapper })
    await waitFor(() => expect(result.current.data).toHaveLength(2))
    const k = ketten[0]!
    expect(supabase.from).toHaveBeenCalledWith('leads')
    const spalten = k.select!.mock.calls[0]![0] as string
    expect(spalten).toContain('board_liste')
    expect(spalten).toContain('board_seit')
    expect(spalten).not.toContain('stage')
    expect(k.not).toHaveBeenCalledWith('board_liste', 'is', null)
    expect(k.is).toHaveBeenCalledWith('deleted_at', null)
    expect(k.order!.mock.calls[0]).toEqual(['board_seit', { ascending: false }])
    expect(k.order!.mock.calls[1]).toEqual(['id', { ascending: true }])
  })

  it('sortiereKarten: board_seit absteigend, bei Gleichstand nach id', () => {
    const sortiert = sortiereKarten([
      karte('b', 'verloren', T0),
      karte('c', 'angeschrieben', T1),
      karte('a', 'verloren', T0),
    ])
    expect(sortiert.map((k) => k.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('useKarteVerschieben', () => {
  it('legt die Karte sofort in die neue Liste (oben) und übernimmt danach die Zeile vom Server', async () => {
    let antworte: (a: Antwort) => void = () => {}
    const k = kette()
    k['single'] = vi.fn(() => new Promise<Antwort>((res) => (antworte = res)))
    vi.mocked(supabase.from).mockReturnValue(k as never)
    const { wrapper, board } = umgebung([karte('x', 'gespraech', T1), karte('a', 'angeschrieben', T0)])
    const { result } = renderHook(() => useKarteVerschieben(), { wrapper })

    act(() => result.current.mutate({ id: 'a', liste: 'gespraech' }))
    // noch keine Antwort der Datenbank – die Karte liegt trotzdem schon in „Gespräch vereinbart“, über der älteren
    await waitFor(() => expect(board().map((b) => `${b.id}:${b.board_liste}`)).toEqual(['a:gespraech', 'x:gespraech']))
    expect(k['update']).toHaveBeenCalledWith({ board_liste: 'gespraech' })
    expect(k['eq']).toHaveBeenCalledWith('id', 'a')
    expect(k['is']).toHaveBeenCalledWith('deleted_at', null)

    const T2 = '2026-11-25T10:30:00.123456+00:00'
    await act(async () => antworte({ data: karte('a', 'gespraech', T2), error: null }))
    await waitFor(() => expect(board().find((b) => b.id === 'a')?.board_seit).toBe(T2))
  })

  it('Rückgängig gibt board_seit mit – die Karte liegt wieder an ihrer alten Stelle', async () => {
    antworten({ data: karte('a', 'angeschrieben', T0), error: null })
    const { wrapper, board } = umgebung([karte('a', 'gespraech', T1), karte('x', 'angeschrieben', T1)])
    const { result } = renderHook(() => useKarteVerschieben(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'a', liste: 'angeschrieben', seit: T0 })
    })
    expect(ketten[0]!.update).toHaveBeenCalledWith({ board_liste: 'angeschrieben', board_seit: T0 })
    // älter als x → unter x
    expect(board().map((b) => b.id)).toEqual(['x', 'a'])
  })

  it('Fehler: die Karte springt zurück, die Meldung der Datenbank erscheint', async () => {
    antworten({ data: null, error: { code: 'P0001', message: 'Das geht gerade nicht' } })
    const konsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const start = [karte('a', 'angeschrieben', T0)]
    const { wrapper, board } = umgebung(start)
    const { result } = renderHook(() => useKarteVerschieben(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'a', liste: 'verloren' }).catch(() => {})
    })
    expect(board()).toEqual(start)
    expect(m.toastFehler).toHaveBeenCalledWith('Das geht gerade nicht', undefined)
    konsole.mockRestore()
  })

  it('Liste null nimmt die Karte vom Board (kein Löschen: nur board_liste wird geleert)', async () => {
    antworten({ data: { ...karte('a', 'angeschrieben', T0), board_liste: null, board_seit: null }, error: null })
    const { wrapper, board } = umgebung([karte('a', 'angeschrieben', T0), karte('b', 'verloren', T0)])
    const { result } = renderHook(() => useKarteVerschieben(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'a', liste: null })
    })
    expect(ketten[0]!.update).toHaveBeenCalledWith({ board_liste: null })
    expect(ketten[0]!.delete).not.toHaveBeenCalled()
    expect(board().map((b) => b.id)).toEqual(['b'])
  })

  it('funktioniert auch, nachdem die aufrufende Ansicht geschlossen wurde (Rückgängig nach „Karte entfernen“)', async () => {
    antworten({ data: karte('a', 'angeschrieben', T0), error: null })
    const { wrapper, board } = umgebung([])
    const { result, unmount } = renderHook(() => useKarteVerschieben(), { wrapper })
    const { mutateAsync } = result.current
    unmount()
    await act(async () => {
      await mutateAsync({ id: 'a', liste: 'angeschrieben', seit: T0 })
    })
    expect(board().map((b) => b.id)).toEqual(['a'])
  })
})

describe('useKarteAnlegen', () => {
  it('ruft board_karte_anlegen mit bereinigten Werten und legt die neue Karte oben in „Angeschrieben“', async () => {
    const antwort = { status: 'neu', lead_id: 'neu-1', liste: 'angeschrieben', owner_id: V }
    vi.mocked(supabase.rpc).mockResolvedValue({ data: antwort, error: null } as never)
    const { wrapper, board } = umgebung([karte('alt', 'angeschrieben', T0)])
    const { result } = renderHook(() => useKarteAnlegen(), { wrapper })
    let ergebnis: unknown
    await act(async () => {
      ergebnis = await result.current.mutateAsync({
        vorname: ' Petra ',
        nachname: 'Probelauf',
        linkedinUrl: ' https://www.linkedin.com/in/petra-probelauf ',
        ownerId: V,
        anrede: 'frau',
      })
    })
    expect(ergebnis).toEqual(antwort)
    expect(supabase.rpc).toHaveBeenCalledWith('board_karte_anlegen', {
      p_vorname: 'Petra',
      p_nachname: 'Probelauf',
      p_linkedin_url: 'https://www.linkedin.com/in/petra-probelauf',
      p_owner: V,
      p_anrede: 'frau',
    })
    expect(board().map((b) => b.id)).toEqual(['neu-1', 'alt'])
    expect(board()[0]).toMatchObject({ full_name: 'Petra Probelauf', board_liste: 'angeschrieben', owner_id: V })
  })

  it('schon_da ändert nichts am Board; leerer Link wird null', async () => {
    const antwort = { status: 'schon_da', lead_id: 'alt', liste: 'gespraech', owner_id: V }
    vi.mocked(supabase.rpc).mockResolvedValue({ data: antwort, error: null } as never)
    const start = [karte('alt', 'gespraech', T0)]
    const { wrapper, board } = umgebung(start)
    const { result } = renderHook(() => useKarteAnlegen(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ vorname: 'Petra', nachname: '', linkedinUrl: '  ' })
    })
    expect(vi.mocked(supabase.rpc).mock.calls[0]![1]).toMatchObject({
      p_vorname: 'Petra',
      p_nachname: null,
      p_linkedin_url: null,
    })
    expect(board()).toEqual(start)
  })

  it('reicht den Fehler der Datenbank an den Dialog weiter – ohne eigenen Fehler-Toast', async () => {
    const fehler = { code: 'P0001', message: 'Diese Person steht auf der Sperrliste' }
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: fehler } as never)
    const { wrapper } = umgebung([])
    const { result } = renderHook(() => useKarteAnlegen(), { wrapper })
    let gefangen: unknown
    await act(async () => {
      await result.current.mutateAsync({ vorname: 'Petra', nachname: 'Probelauf' }).catch((e) => (gefangen = e))
    })
    expect(gefangen).toBe(fehler)
    expect(m.toastFehler).not.toHaveBeenCalled()
  })
})

describe('useKarteSpeichern', () => {
  it('schreibt nur den Patch mit Filter auf die id und legt eine neue Liste gleich aufs Board', async () => {
    const zeile = { ...karte('a', 'gespraech', T1, { last_name: 'Neu', full_name: 'Petra Neu' }), notes: 'Notiz' }
    antworten({ data: zeile, error: null })
    const { wrapper, board } = umgebung([])
    const { result } = renderHook(() => useKarteSpeichern(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'a', patch: { last_name: 'Neu', board_liste: 'gespraech' } })
    })
    const k = ketten[0]!
    expect(k.update).toHaveBeenCalledWith({ last_name: 'Neu', board_liste: 'gespraech' })
    expect(k.eq).toHaveBeenCalledWith('id', 'a')
    expect(k.eq).toHaveBeenCalledTimes(1) // keine updated_at-Sperre
    expect(k.is).toHaveBeenCalledWith('deleted_at', null)
    expect(board().map((b) => `${b.id}:${b.board_liste}:${b.full_name}`)).toEqual(['a:gespraech:Petra Neu'])
  })
})
