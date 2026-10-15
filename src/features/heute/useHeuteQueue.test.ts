// useHeuteQueue.test.ts (BAUPLAN § 3.2 Unit-Tests, § 5.4): 7 View-Sektionen → 9 UI-Sektionen, Sortierung je Sektion, stabile
// Reihenfolge (E15/H-16), Batch-Filter und -Chips (H-10), Zähler Fällig, Realtime-Neuzugang „neu“, „Schon erledigt von …“.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())

import { useAuth } from '@/features/auth/authStore'
import type { QueueItem } from '@/types/domain'
import { ANTWORTEN, ICH, SEQ_A, SEQ_C, zeile, zuruecksetzen } from './_testHilfe'
import {
  batchChips,
  filtereSektionen,
  itemKey,
  sektionenAbleiten,
  sektionVon,
  SEKTIONEN,
  stabileReihenfolge,
  zaehleFaellig,
  type SektionsKontext,
} from './sektionen'
import { useHeuteQueue } from './useHeuteQueue'

const OPENER = SEQ_A.steps[0]!.id
const KF1 = SEQ_A.steps[1]!.id
const KF2 = SEQ_A.steps[2]!.id
const NF1 = SEQ_C.steps[0]!.id

const MITTWOCH: SektionsKontext = {
  heute: '2026-10-14',
  istOpener: (id) => id === OPENER,
  withdrawWeekday: 5,
  kommendDays: 7,
}
const FREITAG: SektionsKontext = { ...MITTWOCH, heute: '2026-10-16' }

const schritt = (id: string) => {
  for (const s of [SEQ_A, SEQ_C]) {
    const st = s.steps.find((x) => x.id === id)
    if (st) return { name: st.name, position: st.position, sequenceKey: s.key }
  }
  return null
}

/** Eine Zeile je Fall – alle sieben View-Sektionen, dazu Rückruf und Opener. */
function alleFaelle(): QueueItem[] {
  return [
    zeile('heute', 1, {
      item_kind: 'rueckruf',
      channel: 'telefon',
      item_id: 'rueckruf',
      due_at: '2026-10-14T10:30:00+02:00',
    }),
    zeile('antworten', 2, { item_id: 'antwort', enrollment_id: null }),
    zeile('heute', 3, { item_id: 'opener', step_id: OPENER }),
    zeile('ueberfaellig', 4, { item_id: 'ueber', step_id: KF1 }),
    zeile('heute', 5, { item_id: 'heute', step_id: KF2 }),
    zeile('annahme_pruefen', 6, { item_id: 'annahme' }),
    zeile('neue_anfragen', 7, { item_id: 'anfrage' }),
    zeile('zurueckziehen', 8, { item_id: 'zurueck' }),
    zeile('kommend', 9, { item_id: 'bald', due_date: '2026-10-19', due_at: '2026-10-19T09:00:00+02:00' }),
    zeile('kommend', 10, { item_id: 'spaet', due_date: '2026-11-30', due_at: '2026-11-30T09:00:00+02:00' }),
  ]
}

describe('sektionenAbleiten – § 5.4 Zuordnung', () => {
  it('7 View-Sektionen → 9 UI-Sektionen in fester Reihenfolge (H-02, ux § 1.5)', () => {
    const s = sektionenAbleiten(alleFaelle(), FREITAG)
    expect(SEKTIONEN).toEqual([
      'rueckrufe',
      'antworten',
      'ueberfaellig',
      'heute',
      'annahme_pruefen',
      'opener',
      'neue_anfragen',
      'zurueckziehen',
      'spaeter',
    ])
    const ids = Object.fromEntries(SEKTIONEN.map((k) => [k, s[k].map((i) => i.item_id)]))
    expect(ids).toEqual({
      rueckrufe: ['rueckruf'],
      antworten: ['antwort'],
      ueberfaellig: ['ueber'],
      heute: ['heute'],
      annahme_pruefen: ['annahme'],
      opener: ['opener'],
      neue_anfragen: ['anfrage'],
      zurueckziehen: ['zurueck'],
      spaeter: ['bald'],
    })
  })

  it('„Später“ nur bis heute + kommend_days; darüber hinaus nicht angezeigt', () => {
    const [, , , , , , , , bald, spaet] = alleFaelle()
    expect(sektionVon(bald!, MITTWOCH)).toBe('spaeter')
    expect(sektionVon(spaet!, MITTWOCH)).toBeNull()
  })

  it('Rückruf und Opener in „kommend“ landen in Später, nicht oben', () => {
    const r = zeile('kommend', 1, { item_kind: 'rueckruf', due_date: '2026-10-15' })
    const o = zeile('kommend', 2, { step_id: OPENER, due_date: '2026-10-15' })
    expect(sektionVon(r, MITTWOCH)).toBe('spaeter')
    expect(sektionVon(o, MITTWOCH)).toBe('spaeter')
  })

  it('Überfälliger Opener steht unter „Opener senden“ (Regel 3 vor Regel 4)', () => {
    expect(sektionVon(zeile('ueberfaellig', 1, { step_id: OPENER }), MITTWOCH)).toBe('opener')
  })

  it('H-14: „Zurückziehen“ nur am withdraw_weekday (Fr) oder mit ?sektion=zurueckziehen', () => {
    const z = zeile('zurueckziehen', 1)
    expect(sektionVon(z, MITTWOCH)).toBeNull()
    expect(sektionVon(z, FREITAG)).toBe('zurueckziehen')
    expect(sektionVon(z, { ...MITTWOCH, zeigeZurueckziehen: true })).toBe('zurueckziehen')
    expect(sektionVon(z, { ...MITTWOCH, withdrawWeekday: 3 })).toBe('zurueckziehen')
  })
})

describe('Sortierung je Sektion (E15, ux § 3.1.4)', () => {
  it('Karten: rank_score ↓ → Firma ↑ (leer zuletzt) → Angelegt ↑', () => {
    const a = zeile('heute', 1, { item_id: 'a', rank_score: 10, company_name: 'Beta', lead_created_at: '2026-10-02' })
    const b = zeile('heute', 2, { item_id: 'b', rank_score: 30, company_name: 'Zeta' })
    const c = zeile('heute', 3, { item_id: 'c', rank_score: 10, company_name: 'Alpha', lead_created_at: '2026-10-05' })
    const d = zeile('heute', 4, { item_id: 'd', rank_score: 10, company_name: null })
    const e = zeile('heute', 5, { item_id: 'e', rank_score: 10, company_name: 'Beta', lead_created_at: '2026-10-01' })
    expect(sektionenAbleiten([a, b, c, d, e], MITTWOCH).heute.map((i) => i.item_id)).toEqual(['b', 'c', 'e', 'a', 'd'])
  })

  it('H-13: Annahme prüfen nach Anfragedatum absteigend (neueste zuerst)', () => {
    const alt = zeile('annahme_pruefen', 1, { item_id: 'alt', due_at: '2026-10-08T10:00:00+02:00' })
    const neu = zeile('annahme_pruefen', 2, { item_id: 'neu', due_at: '2026-10-13T10:00:00+02:00' })
    const mitte = zeile('annahme_pruefen', 3, { item_id: 'mitte', due_at: '2026-10-10T10:00:00+02:00' })
    expect(sektionenAbleiten([alt, neu, mitte], MITTWOCH).annahme_pruefen.map((i) => i.item_id)).toEqual([
      'neu',
      'mitte',
      'alt',
    ])
  })

  it('H-18: Rückrufe nach Uhrzeit aufsteigend; Neue Anfragen nach Angelegt aufsteigend', () => {
    const r1 = zeile('heute', 1, {
      item_kind: 'rueckruf',
      item_id: 'r1',
      due_at: '2026-10-14T15:00:00+02:00',
      rank_score: 99,
    })
    const r2 = zeile('ueberfaellig', 2, { item_kind: 'rueckruf', item_id: 'r2', due_at: '2026-10-14T09:30:00+02:00' })
    const n1 = zeile('neue_anfragen', 3, { item_id: 'n1', lead_created_at: '2026-10-14T08:00:00Z' })
    const n2 = zeile('neue_anfragen', 4, { item_id: 'n2', lead_created_at: '2026-10-13T08:00:00Z' })
    const s = sektionenAbleiten([r1, r2, n1, n2], MITTWOCH)
    expect(s.rueckrufe.map((i) => i.item_id)).toEqual(['r2', 'r1'])
    expect(s.neue_anfragen.map((i) => i.item_id)).toEqual(['n2', 'n1'])
  })
})

describe('Batch-Chips und Filter (H-10, DESIGN-SYSTEM § 5.6)', () => {
  const items = [
    zeile('heute', 1, { item_id: 'o1', step_id: OPENER }),
    zeile('heute', 2, { item_id: 'k2a', step_id: KF2 }),
    zeile('ueberfaellig', 3, { item_id: 'k2b', step_id: KF2 }),
    zeile('heute', 4, { item_id: 'k1', step_id: KF1 }),
    zeile('heute', 5, { item_id: 'nf', step_id: NF1 }),
    zeile('heute', 6, { item_id: 'tel', channel: 'telefon', step_id: null }),
    zeile('heute', 7, { item_id: 'mail', channel: 'email', step_id: null }),
    zeile('antworten', 8, { item_id: 'ant' }),
    zeile('annahme_pruefen', 9, { item_id: 'ann' }),
  ]
  const s = sektionenAbleiten(items, MITTWOCH)

  it('„Alle 8 · Opener 1 · Kurzfristig 1 1 · Kurzfristig 2 2 · Nachfassen 1 1 · Anrufe 1 · E-Mail 1 · Antworten 1“, ⌥0/⌥1–9', () => {
    const chips = batchChips(s, schritt)
    expect(chips.map((c) => [c.label, c.zaehler, c.kbd])).toEqual([
      ['Alle', 8, '⌥0'],
      ['Opener', 1, '⌥1'],
      ['Kurzfristig 1', 1, '⌥2'],
      ['Kurzfristig 2', 2, '⌥3'],
      ['Nachfassen 1', 1, '⌥4'],
      ['Anrufe', 1, '⌥5'],
      ['E-Mail', 1, '⌥6'],
      ['Antworten', 1, '⌥7'],
    ])
  })

  it('gleichnamige Schritte zweier Sequenzen (A und B) teilen sich einen Chip', () => {
    const b = { name: 'Kurzfristig 1', position: 2, sequenceKey: SEQ_C.key }
    const z = sektionenAbleiten(
      [zeile('heute', 1, { step_id: KF1 }), zeile('heute', 2, { step_id: 'b-kf1' })],
      MITTWOCH,
    )
    const chips = batchChips(z, (id) => (id === 'b-kf1' ? b : schritt(id)))
    expect(chips.map((c) => [c.label, c.zaehler])).toEqual([
      ['Alle', 2],
      ['Kurzfristig 1', 2],
    ])
    expect(chips[1]?.filter).toEqual({ art: 'schritt', stepIds: ['b-kf1', KF1].sort() })
  })

  it('Nullwerte erscheinen nicht', () => {
    const nurA = sektionenAbleiten([zeile('heute', 1, { step_id: KF1 })], MITTWOCH)
    expect(batchChips(nurA, schritt).map((c) => c.label)).toEqual(['Alle', 'Kurzfristig 1'])
  })

  it('Chip „Kurzfristig 2 (2)“ zeigt genau die 2 Karten dieses Schritts; null zeigt wieder alle', () => {
    const f = filtereSektionen(s, { art: 'schritt', stepIds: [KF2] })
    expect(SEKTIONEN.flatMap((k) => f[k].map((i) => i.item_id))).toEqual(['k2b', 'k2a'])
    expect(filtereSektionen(s, null)).toBe(s)
    const ant = filtereSektionen(s, { art: 'antworten' })
    expect(SEKTIONEN.flatMap((k) => ant[k].map((i) => i.item_id))).toEqual(['ant'])
    const tel = filtereSektionen(s, { art: 'anrufe' })
    expect(SEKTIONEN.flatMap((k) => tel[k].map((i) => i.item_id))).toEqual(['tel'])
  })

  it('Fällig = Rückrufe + Antworten + Überfällig + Heute + Opener (ohne Abhakzeilen)', () => {
    expect(zaehleFaellig(s)).toEqual({ faellig: 8, ueberfaellig: 1 })
  })
})

describe('stabileReihenfolge (H-16)', () => {
  it('ohne alte Reihenfolge gilt die Sortierung', () => {
    expect(stabileReihenfolge(undefined, ['a', 'b'])).toEqual({ reihenfolge: ['a', 'b'], neue: [] })
  })
  it('alte Reihenfolge bleibt, neue Schlüssel unten, verschwundene fallen weg (außer behalten)', () => {
    const r = stabileReihenfolge(['a', 'b', 'c'], ['c', 'x', 'a'], new Set(['b']))
    expect(r).toEqual({ reihenfolge: ['a', 'b', 'c', 'x'], neue: ['x'] })
    expect(stabileReihenfolge(['a', 'b', 'c'], ['c', 'a']).reihenfolge).toEqual(['a', 'c'])
  })
})

describe('useHeuteQueue (Hook)', () => {
  let qc: QueryClient
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)

  beforeEach(() => {
    zuruecksetzen()
    useAuth.setState({ status: 'mitglied', member: ICH })
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  it('friert die Reihenfolge ein; Realtime-Neuzugang wird unten angehängt und als „neu“ markiert (H-16)', async () => {
    ANTWORTEN.queue = [
      zeile('heute', 1, { item_id: 'a', rank_score: 50, step_id: KF2 }),
      zeile('heute', 2, { item_id: 'b', rank_score: 40, step_id: KF2 }),
    ]
    const { result } = renderHook(() => useHeuteQueue(ICH.user_id, { heute: '2026-10-14' }), { wrapper })
    await waitFor(() => expect(result.current.sektionen.heute.map((i) => i.item_id)).toEqual(['a', 'b']))
    await waitFor(() => expect(result.current.schritt(KF2)?.name).toBe('Kurzfristig 2'))

    // Server sortiert neu (b vor a) und liefert eine neue Zeile mit höchstem Rang
    ANTWORTEN.queue = [
      zeile('heute', 3, { item_id: 'c', rank_score: 99, step_id: KF2 }),
      zeile('heute', 2, { item_id: 'b', rank_score: 60, step_id: KF2 }),
      zeile('heute', 1, { item_id: 'a', rank_score: 10, step_id: KF2 }),
    ]
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ['queue'] })
    })
    await waitFor(() => expect(result.current.sektionen.heute.map((i) => i.item_id)).toEqual(['a', 'b', 'c']))
    expect(result.current.neu.has('c')).toBe(true)
    expect(result.current.zaehler.faellig).toBe(3)

    // ⌥R baut neu nach Rang
    act(() => result.current.neuSortieren())
    await waitFor(() => expect(result.current.sektionen.heute.map((i) => i.item_id)).toEqual(['c', 'b', 'a']))
  })

  it('„Schon erledigt von Mike“ nur für fremd verschwundene Zeilen; eigene (markiereEigen) nicht', async () => {
    ANTWORTEN.queue = [zeile('heute', 1, { item_id: 'a' }), zeile('heute', 2, { item_id: 'b' })]
    const { result } = renderHook(() => useHeuteQueue(ICH.user_id, { heute: '2026-10-14' }), { wrapper })
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    await waitFor(() => expect(result.current.byKey.size).toBe(2))
    act(() => result.current.markiereEigen('a'))
    ANTWORTEN.queue = []
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ['queue'] })
    })
    await waitFor(() => expect(result.current.fremdErledigt.map((f) => f.key)).toEqual(['b']))
    expect(result.current.fremdErledigt[0]).toMatchObject({ sektion: 'heute', von: 'Mike', name: 'Max Muster2' })
  })

  it('?schritt=<step_id> startet mit Batch-Filter; behalten hält die Position einer erledigten Zeile', async () => {
    ANTWORTEN.queue = [
      zeile('heute', 1, { item_id: 'a', step_id: KF1, rank_score: 9 }),
      zeile('heute', 2, { item_id: 'b', step_id: KF2, rank_score: 8 }),
    ]
    const behalten = new Set(['a'])
    const { result } = renderHook(() => useHeuteQueue(ICH.user_id, { heute: '2026-10-14', schritt: KF2, behalten }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(SEKTIONEN.flatMap((k) => result.current.sektionen[k].map(itemKey))).toEqual(['b'])
    ANTWORTEN.queue = [zeile('heute', 2, { item_id: 'b', step_id: KF2 })]
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ['queue'] })
    })
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.reihenfolge.heute).toEqual(['a', 'b'])
  })
})
