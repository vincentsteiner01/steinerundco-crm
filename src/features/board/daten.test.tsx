// Daten-Schicht des Boards (src/data/board.ts) gegen einen gemockten Supabase-Client: Abfrage, optimistisches Verschieben mit
// Zurückrollen, „Rückgängig“ mit board_seit, Anlegen über das RPC, Lead-Blatt speichern, Schreibvorgänge kurz hintereinander.
// Nur erfundene Namen.
// Die Regeln der Datenbank selbst (Trigger, RPC) prüft supabase/tests/board_test.sql.
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import { qk } from '@/data/queryKeys'
import { supabase } from '@/data/supabase'

const V = 'member-v'
const T0 = '2026-11-24T08:00:00+00:00'
const T1 = '2026-11-25T09:00:00+00:00'
const T_ZUG = '2026-11-26T07:15:00+00:00'

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

  // 25.11.2026: Offline pausierte der Zug (Voreinstellung 'online') – die Karte lag sichtbar in der neuen Liste, gespeichert war nichts
  it('offline: der Zug wartet nicht, er scheitert sofort – Karte zurück, Offline-Meldung', async () => {
    const k = kette()
    k['single'] = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.mocked(supabase.from).mockReturnValue(k as never)
    const konsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const start = [karte('a', 'angeschrieben', T0)]
    const { wrapper, board } = umgebung(start)
    const { result } = renderHook(() => useKarteVerschieben(), { wrapper })
    onlineManager.setOnline(false)
    try {
      await act(async () => {
        await result.current.mutateAsync({ id: 'a', liste: 'gespraech' }).catch(() => {})
      })
      expect(k['update']).toHaveBeenCalledWith({ board_liste: 'gespraech' })
      expect(result.current.isPaused).toBe(false)
      expect(board()).toEqual(start)
      expect(m.toastFehler).toHaveBeenCalledWith('Offline – Änderungen werden nicht gespeichert.', undefined)
    } finally {
      onlineManager.setOnline(true)
      konsole.mockRestore()
    }
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

// 26.11.2026: Der KPI-Reiter zählt aus den Board-Zügen. Jeder Schreibvorgang des Boards macht seine Abfragen veraltet – auch
// wenn das Realtime-Ereignis ausbleibt (Kanal getrennt).
describe('Board schreibt: die KPI-Abfragen gelten als veraltet', () => {
  const KPI = [...qk.kpis.all, 'tage', 'team', '2026-11-01', '2026-11-30']
  const veraltet = (qc: QueryClient) => qc.getQueryState(KPI)?.isInvalidated

  it('Karte verschieben', async () => {
    antworten({ data: karte('a', 'gespraech', T_ZUG), error: null })
    const { qc, wrapper } = umgebung([karte('a', 'angeschrieben', T0)])
    qc.setQueryData(KPI, [])
    const { result } = renderHook(() => useKarteVerschieben(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'a', liste: 'gespraech' })
    })
    expect(veraltet(qc)).toBe(true)
  })

  it('Karte anlegen', async () => {
    const antwort = { status: 'neu', lead_id: 'neu-1', liste: 'angeschrieben', owner_id: V }
    vi.mocked(supabase.rpc).mockResolvedValue({ data: antwort, error: null } as never)
    antworten({ data: [], error: null })
    const { qc, wrapper } = umgebung([])
    qc.setQueryData(KPI, [])
    const { result } = renderHook(() => useKarteAnlegen(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ vorname: 'Petra', nachname: 'Probelauf' })
    })
    expect(veraltet(qc)).toBe(true)
  })

  it('Lead-Blatt speichern', async () => {
    antworten({ data: { ...karte('a', 'verloren', T_ZUG), notes: null }, error: null })
    const { qc, wrapper } = umgebung([karte('a', 'gespraech', T1)])
    qc.setQueryData(KPI, [])
    const { result } = renderHook(() => useKarteSpeichern(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'a', patch: { board_liste: 'verloren' } })
    })
    expect(veraltet(qc)).toBe(true)
  })
})

// 26.11.2026: Zwei Züge kurz hintereinander – nach der ersten Antwort lud das Board neu und bekam den Stand der Datenbank
// OHNE den Zug, der noch unterwegs war; dessen Karte sprang kurz in die alte Liste zurück.
describe('Schreibvorgänge kurz hintereinander', () => {
  type DbFehler = { code: string; message: string }

  /**
   * Datenbank-Attrappe: ein Schreibvorgang wird erst gespeichert und beantwortet, wenn der Test ihn freigibt. Das Laden des
   * Boards liefert den Stand genau dieses Augenblicks – also ohne alles, was noch unterwegs ist.
   */
  function datenbank(start: BoardKarte[]) {
    let stand = start
    let geladen = 0
    const offen = new Map<string, (fehler?: DbFehler) => void>()
    vi.mocked(supabase.from).mockImplementation((() => {
      const k = kette()
      let patch: Partial<BoardKarte> = {}
      let id = ''
      k['update'] = vi.fn((p: Partial<BoardKarte>) => {
        patch = p
        return k
      })
      k['eq'] = vi.fn((_spalte: string, wert: string) => {
        id = wert
        return k
      })
      k['single'] = vi.fn(
        () =>
          new Promise<Antwort>((res) => {
            offen.set(id, (fehler) => {
              if (fehler) return res({ data: null, error: fehler })
              const zeile = { ...stand.find((z) => z.id === id)!, board_seit: T_ZUG, ...patch }
              stand = stand.map((z) => (z.id === id ? zeile : z))
              res({ data: zeile, error: null })
            })
          }),
      )
      k['then'] = (res: (a: Antwort) => unknown, rej?: (e: unknown) => unknown) => {
        geladen++
        return Promise.resolve({ data: stand, error: null }).then(res, rej)
      }
      return k
    }) as never)
    return {
      antworte: (id: string, fehler?: DbFehler) => offen.get(id)!(fehler),
      unterwegs: () => offen.size,
      geladen: () => geladen,
    }
  }

  /** Board mit zwei Karten in „Angeschrieben“, geladen aus der Attrappe; `lage()` sagt, in welcher Liste beide liegen. */
  async function aufbau() {
    const db = datenbank([karte('a', 'angeschrieben', T1), karte('b', 'angeschrieben', T0)])
    const { qc, wrapper, board } = umgebung()
    const lage = () => ['a', 'b'].map((id) => `${id}:${board().find((k) => k.id === id)?.board_liste}`).join(' ')
    const { result } = renderHook(
      () => ({
        karten: useBoardKarten(),
        zug: useKarteVerschieben(),
        speichern: useKarteSpeichern(),
        anlegen: useKarteAnlegen(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.karten.data).toHaveLength(2))
    const zuvor = db.geladen()
    /** Jede Lage, die das Board ab jetzt einnimmt – auch die kürzeste. */
    const beobachte = () => {
      const lagen = new Set<string>([lage()])
      qc.getQueryCache().subscribe(() => lagen.add(lage()))
      return lagen
    }
    /** Warten, bis nur noch `n` Schreibvorgänge laufen und ein dadurch angestoßenes Neuladen angekommen ist. */
    const ruhe = async (n: number) => {
      await waitFor(() => expect(qc.isMutating()).toBe(n))
      await waitFor(() => expect(qc.isFetching()).toBe(0))
    }
    return { db, qc, lage, result, beobachte, ruhe, neuGeladen: () => db.geladen() - zuvor }
  }

  it.each([
    ['die erste Antwort kommt spät, die zweite früh', 'b', 'a'],
    ['die erste Antwort kommt früh, die zweite spät', 'a', 'b'],
  ])('zwei Züge (%s): keine Karte springt zurück, genau ein Neuladen am Ende', async (_fall, zuerst, danach) => {
    const { db, lage, result, beobachte, ruhe, neuGeladen } = await aufbau()
    act(() => void result.current.zug.mutateAsync({ id: 'a', liste: 'gespraech' }))
    act(() => void result.current.zug.mutateAsync({ id: 'b', liste: 'verloren' }))
    await waitFor(() => expect(lage()).toBe('a:gespraech b:verloren'))
    await waitFor(() => expect(db.unterwegs()).toBe(2))
    const lagen = beobachte()

    await act(async () => db.antworte(zuerst))
    await ruhe(1)
    await act(async () => db.antworte(danach))
    await ruhe(0)

    expect([...lagen]).toEqual(['a:gespraech b:verloren'])
    expect(neuGeladen()).toBe(1)
    expect(lage()).toBe('a:gespraech b:verloren')
  })

  it('Fehler beim ersten von zwei Zügen: nur die erste Karte springt zurück, die zweite bleibt liegen', async () => {
    const konsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db, lage, result, beobachte, ruhe, neuGeladen } = await aufbau()
    act(() => void result.current.zug.mutateAsync({ id: 'a', liste: 'gespraech' }).catch(() => {}))
    act(() => void result.current.zug.mutateAsync({ id: 'b', liste: 'verloren' }))
    await waitFor(() => expect(lage()).toBe('a:gespraech b:verloren'))
    await waitFor(() => expect(db.unterwegs()).toBe(2))
    const lagen = beobachte()

    await act(async () => db.antworte('a', { code: 'P0001', message: 'Das geht gerade nicht' }))
    await ruhe(1)
    expect(lage()).toBe('a:angeschrieben b:verloren')
    expect(neuGeladen()).toBe(0)
    await act(async () => db.antworte('b'))
    await ruhe(0)

    expect([...lagen]).toEqual(['a:gespraech b:verloren', 'a:angeschrieben b:verloren'])
    expect(m.toastFehler).toHaveBeenCalledTimes(1)
    expect(m.toastFehler).toHaveBeenCalledWith('Das geht gerade nicht', undefined)
    expect(neuGeladen()).toBe(1)
    konsole.mockRestore()
  })

  it('Karte anlegen endet, während ein Zug läuft: das Board wartet, alles andere unter „leads“ lädt neu', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { status: 'schon_da', lead_id: 'b', liste: 'angeschrieben', owner_id: V },
      error: null,
    } as never)
    const { db, qc, lage, result, beobachte, ruhe, neuGeladen } = await aufbau()
    qc.setQueryData(qk.leads.detail('b'), { id: 'b' })
    act(() => void result.current.zug.mutateAsync({ id: 'a', liste: 'gespraech' }))
    await waitFor(() => expect(lage()).toBe('a:gespraech b:angeschrieben'))
    await waitFor(() => expect(db.unterwegs()).toBe(1))
    const lagen = beobachte()

    await act(async () => {
      await result.current.anlegen.mutateAsync({ vorname: 'Petra', nachname: 'Probelauf' })
    })
    await ruhe(1)
    expect(neuGeladen()).toBe(0)
    expect(qc.getQueryState(qk.leads.detail('b'))?.isInvalidated).toBe(true)
    await act(async () => db.antworte('a'))
    await ruhe(0)

    expect([...lagen]).toEqual(['a:gespraech b:angeschrieben'])
    expect(neuGeladen()).toBe(1)
  })

  it('ein Zug endet, während das Lead-Blatt speichert: neu geladen wird erst nach dem Speichern', async () => {
    const { db, lage, result, beobachte, ruhe, neuGeladen } = await aufbau()
    act(() => void result.current.speichern.mutateAsync({ id: 'b', patch: { board_liste: 'verloren' } }))
    act(() => void result.current.zug.mutateAsync({ id: 'a', liste: 'gespraech' }))
    await waitFor(() => expect(lage()).toBe('a:gespraech b:angeschrieben'))
    await waitFor(() => expect(db.unterwegs()).toBe(2))
    const lagen = beobachte()

    await act(async () => db.antworte('a'))
    await ruhe(1)
    expect(neuGeladen()).toBe(0)
    await act(async () => db.antworte('b'))
    await ruhe(0)

    expect([...lagen]).toEqual(['a:gespraech b:angeschrieben', 'a:gespraech b:verloren'])
    expect(neuGeladen()).toBe(1)
  })
})
