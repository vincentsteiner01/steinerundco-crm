// Runde 3 (QA mit echten Daten), Daten-Schicht: Sperrliste-Status (leer = kein Chip), doppelter Sheet-Import in der Timeline,
// Kontakt-Typen wie crm.ist_kontakt, eine Zählweise für Heute/Team/Sidebar, A-Pfad ohne doppelte Antwort (set_reply_label).
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())

import { supabase } from '@/data/supabase'
import { kette } from '@/test/supabaseMock'
import type { Activity, ActivityType, QueueItem, SperrlisteEintrag } from '@/types/domain'
import { istKontakt, KONTAKT_TYPEN, ohneDoppelteEmailSendung, ohneDoppeltenImport } from './activities'
import { antwortErfassen, lastUnlabeledReply } from './antworten'
import { rpc } from './rpc'
import { sperrlistenStatus, useSperrlistenTreffer } from './sperrliste'
import { ERLEDIGT_TYPEN, zaehleErledigt } from './tagesbilanz'
import { useQueueZaehler, zaehleQueue } from './queue'
import { qk } from './queryKeys'

const LEAD = '00000000-0000-4000-8000-0000000000aa'
const ANDERER = '00000000-0000-4000-8000-0000000000bb'
const V = '00000000-0000-4000-8000-000000000001'
const M = '00000000-0000-4000-8000-000000000002'

let qc: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
)
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.mocked(supabase.from).mockReset()
  vi.mocked(supabase.from).mockImplementation(() => kette() as never)
  vi.mocked(supabase.rpc).mockReset()
  vi.mocked(supabase.rpc).mockImplementation((async () => ({ data: null, error: null })) as never)
})

const eintrag = (p: Partial<SperrlisteEintrag>): SperrlisteEintrag =>
  ({
    id: 'e1',
    channels: ['linkedin', 'telefon', 'email'],
    company: null,
    created_at: '2026-10-01T09:00:00Z',
    created_by: null,
    email: null,
    lead_id: null,
    linkedin_url_norm: null,
    name: 'E2E – Gesperrt',
    note: null,
    phone_e164: null,
    reason: 'manuell',
    ...p,
  }) as SperrlisteEintrag

describe('Sperrliste (Befund: roter Chip an jedem Lead bei leerer Sperrliste)', () => {
  const lead = { id: LEAD, email: 'Anna@Example.de', phone_e164: null, linkedin_url_norm: 'in/e2e-anna' }

  it('leere Sperrliste → nicht gesperrt, keine Einträge (leeres Array ist kein Treffer)', () => {
    expect(sperrlistenStatus([], lead)).toEqual({ eintraege: [], gesperrt: false })
    expect(sperrlistenStatus(undefined, lead)).toEqual({ eintraege: [], gesperrt: false })
    expect(sperrlistenStatus([eintrag({ email: 'x@y.de' })], null).gesperrt).toBe(false)
  })

  it('leere Felder treffen nie: Eintrag ohne Daten vs. Lead ohne Telefon/E-Mail', () => {
    const leer = eintrag({ email: '', phone_e164: '', linkedin_url_norm: '', lead_id: null })
    expect(sperrlistenStatus([leer], { id: LEAD, email: '', phone_e164: '', linkedin_url_norm: '' }).gesperrt).toBe(
      false,
    )
    expect(sperrlistenStatus([eintrag({ lead_id: ANDERER })], lead).gesperrt).toBe(false)
  })

  it('Treffer über Lead-ID, E-Mail (Groß/klein egal) und LinkedIn-URL', () => {
    expect(sperrlistenStatus([eintrag({ lead_id: LEAD })], lead).gesperrt).toBe(true)
    expect(sperrlistenStatus([eintrag({ email: 'anna@example.de' })], lead).eintraege).toHaveLength(1)
    expect(sperrlistenStatus([eintrag({ linkedin_url_norm: 'in/e2e-anna' })], lead).gesperrt).toBe(true)
  })

  it('useSperrlistenTreffer: live leere Tabelle → gesperrt false; Eintrag für den Lead → true', async () => {
    const leerA = renderHook(() => useSperrlistenTreffer(lead), { wrapper })
    await waitFor(() => expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('sperrliste'))
    await waitFor(() => expect(qc.getQueryData(['sperrliste'])).toEqual([]))
    expect(leerA.result.current.gesperrt).toBe(false)

    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.mocked(supabase.from).mockImplementation(
      () => kette({ data: [eintrag({ lead_id: LEAD })], error: null }) as never,
    )
    const { result } = renderHook(() => useSperrlistenTreffer(lead), { wrapper })
    await waitFor(() => expect(result.current.gesperrt).toBe(true))
    expect(result.current.eintraege).toHaveLength(1)
  })
})

const akt = (p: Partial<Activity>): Activity =>
  ({ id: 1, lead_id: LEAD, type: 'notiz', source: 'app', occurred_at: '2026-10-01T07:00:00Z', ...p }) as Activity

describe('Timeline: doppelter Sheet-Import (Befund: „Importiert aus CRM-Tabelle“ zweimal)', () => {
  const importZeile = akt({ id: 9, type: 'import', source: 'import_sheet', occurred_at: '2026-10-14T23:31:10Z' })
  const angelegt = akt({ id: 2, type: 'angelegt', source: 'import_sheet', occurred_at: '2026-10-06T07:00:00Z' })
  const kontakt = akt({
    id: 5,
    type: 'vernetzung_angenommen',
    source: 'import_sheet',
    occurred_at: '2026-10-06T07:00:00Z',
  })

  it('angelegt + import aus dem Sheet → nur die rückdatierte angelegt-Zeile bleibt', () => {
    expect(ohneDoppeltenImport([importZeile, kontakt, angelegt]).map((a) => a.id)).toEqual([5, 2])
  })

  it('Re-Import ohne neues angelegt (oder angelegt aus der App) → import bleibt sichtbar', () => {
    expect(ohneDoppeltenImport([importZeile, kontakt]).map((a) => a.id)).toEqual([9, 5])
    const appAngelegt = akt({ id: 3, type: 'angelegt', source: 'app' })
    expect(ohneDoppeltenImport([importZeile, appAngelegt]).map((a) => a.id)).toEqual([9, 3])
  })

  it('seitenübergreifend: import auf Seite 1, angelegt auf Seite 2 → import fällt weg, sobald Seite 2 geladen ist', () => {
    const seite1 = [importZeile, kontakt]
    const seite2 = [angelegt]
    const alle = [...seite1, ...seite2]
    expect(ohneDoppeltenImport(seite1, alle).map((a) => a.id)).toEqual([5])
    expect(ohneDoppeltenImport(seite2, alle).map((a) => a.id)).toEqual([2])
  })

  it('anderer Lead bleibt unberührt; Doppel-Mail-Filter funktioniert weiter', () => {
    const fremd = akt({ id: 11, lead_id: ANDERER, type: 'import', source: 'import_sheet' })
    expect(ohneDoppeltenImport([fremd, angelegt]).map((a) => a.id)).toEqual([11, 2])
    expect(ohneDoppelteEmailSendung([importZeile])).toHaveLength(1)
  })
})

describe('Kontakt-Typen („Letzte Bewegung“) wie crm.ist_kontakt (Migration 8)', () => {
  it('16 Kontakt-Typen; System-Einträge zählen nicht', () => {
    expect(KONTAKT_TYPEN).toHaveLength(16)
    for (const t of [
      'nachricht_erhalten',
      'anruf',
      'email_gesendet',
      'meeting_stattgefunden',
      'vernetzung_angenommen',
    ] as const)
      expect(istKontakt(t)).toBe(true)
    for (const t of ['angelegt', 'import', 'stage_wechsel', 'sequenz_gestartet', 'notiz', 'uebergabe'] as const)
      expect(istKontakt(t)).toBe(false)
    expect(istKontakt(null)).toBe(false)
  })
})

describe('Eine Zählweise für Heute, Team und Sidebar', () => {
  const q = (p: Partial<QueueItem>): QueueItem =>
    ({ section: 'ueberfaellig', item_kind: 'sequenz_schritt', ...p }) as QueueItem
  const items = [
    q({ step_id: 'kf1' }),
    q({ step_id: 'opener' }),
    q({ item_kind: 'rueckruf', step_id: null }),
    q({ item_kind: 'wiedervorlage', step_id: null }),
    q({ section: 'heute', step_id: 'kf1' }),
    q({ section: 'heute', step_id: 'opener' }),
    q({ section: 'heute', item_kind: 'rueckruf', step_id: null }),
    q({ section: 'antworten', item_kind: 'antwort', step_id: null }),
    q({ section: 'kommend', step_id: 'kf1' }),
  ]

  it('überfällig/heute wie die Heute-Sektionen (Rückrufe und Opener haben eigene Sektionen), fällig = alle fälligen', () => {
    const z = zaehleQueue(items, (id) => id === 'opener')
    expect(z.ueberfaelligSektion).toBe(2) // kf1 · Wiedervorlage
    expect(z.heuteSektion).toBe(1)
    expect(z.opener).toBe(2)
    expect(z.rueckrufe).toBe(2)
    expect(z.faellig).toBe(8) // Rückrufe 2 + Antworten 1 + Überfällig 2 + Heute 1 + Opener 2
    expect(z.faellig).toBe(z.ueberfaelligSektion + z.heuteSektion + z.opener + z.rueckrufe + z.je.antworten)
    expect(z.ueberfaellig).toBe(4) // View-Sektion roh
  })

  it('useQueueZaehler ohne istOpener: Opener aus den geladenen Sequenzen (Cache), kein eigener sequences-Request', async () => {
    vi.mocked(supabase.from).mockImplementation(() => kette({ data: items, error: null }) as never)
    const ohne = renderHook(() => useQueueZaehler(V, '2026-10-15'), { wrapper })
    await waitFor(() => expect(ohne.result.current.data).toBeTruthy())
    expect(ohne.result.current.data?.ueberfaelligSektion).toBe(3) // ohne Sequenzen im Cache zählt der Opener mit

    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(qk.sequences, [
      {
        key: 'k',
        steps: [
          { id: 'opener', is_opener: true },
          { id: 'kf1', is_opener: false },
        ],
      },
    ])
    const mit = renderHook(() => useQueueZaehler(V, '2026-10-15'), { wrapper })
    await waitFor(() => expect(mit.result.current.data).toBeTruthy())
    expect(mit.result.current.data).toMatchObject({ ueberfaelligSektion: 2, heuteSektion: 1, opener: 2, faellig: 8 })
    expect(vi.mocked(supabase.from).mock.calls.map((c) => c[0])).not.toContain('sequences')
  })

  it('useQueueZaehler liest Sequenzen nur aus dem Cache: Neuladen ohne „No queryFn“-Fehler, neue Sequenzen zählen sofort', async () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(supabase.from).mockImplementation(() => kette({ data: items, error: null }) as never)
    const laden = vi.fn(async () => [{ key: 'k', steps: [{ id: 'kf1', is_opener: false }] }])
    await qc.prefetchQuery({ queryKey: qk.sequences, queryFn: laden }) // wie useSequences auf Heute/Team
    const r = renderHook(() => useQueueZaehler(V, '2026-10-15'), { wrapper })
    await waitFor(() => expect(r.result.current.data?.ueberfaelligSektion).toBe(3))
    const query = qc.getQueryCache().find({ queryKey: qk.sequences })
    expect(query?.getObserversCount()).toBe(0) // kein Beobachter ohne queryFn an der Query
    await query?.fetch() // Neuladen nach Invalidierung/Fokus nutzt die Optionen der Query
    expect(laden).toHaveBeenCalledTimes(2)
    qc.setQueryData(qk.sequences, [{ key: 'k', steps: [{ id: 'opener', is_opener: true }] }])
    await waitFor(() => expect(r.result.current.data?.ueberfaelligSektion).toBe(2))
    expect(fehler.mock.calls.flat().join(' ')).not.toMatch(/No queryFn|skipToken/)
    fehler.mockRestore()
  })

  it('Cache-Abo meldet nicht im Render einer anderen Komponente (Sidebar + neu gemountete EingangZahl, echt gesehen 15.10.)', async () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(supabase.from).mockImplementation(() => kette({ data: items, error: null }) as never)
    function Zaehler() {
      useQueueZaehler(V, '2026-10-15')
      return null
    }
    function NeueQuery() {
      useQuery({ queryKey: ['eingang', 'offen'], queryFn: async () => 0 }) // legt die Query im Render an („added“)
      return null
    }
    const r = render(
      <QueryClientProvider client={qc}>
        <Zaehler />
      </QueryClientProvider>,
    )
    await act(async () => {
      qc.setQueryData(qk.sequences, [{ key: 'k', steps: [{ id: 'opener', is_opener: true }] }])
      r.rerender(
        <QueryClientProvider client={qc}>
          <Zaehler />
          <NeueQuery />
        </QueryClientProvider>,
      )
    })
    expect(fehler.mock.calls.flat().join(' ')).not.toMatch(/Cannot update a component/)
    fehler.mockRestore()
  })

  it('erledigt: dieselben Typen für Heute und Team; je Person und je Tag (Europe/Berlin)', () => {
    const z = (type: ActivityType, member_id: string, occurred_at = '2026-10-15T08:00:00Z') => ({
      type,
      member_id,
      occurred_at,
    })
    const zeilen = [
      z('nachricht_gesendet', V),
      z('anruf', M),
      z('vernetzung_angenommen', V),
      z('notiz', V),
      z('stage_wechsel', V),
      z('nachricht_erhalten', V),
      z('gespraech_eroeffnet', V, '2026-10-14T21:59:00Z'), // 14.10. 23:59 Berlin
      z('pitch_gesendet', V, '2026-10-14T22:01:00Z'), // 15.10. 00:01 Berlin
    ]
    expect(ERLEDIGT_TYPEN).toContain('anruf')
    expect(ERLEDIGT_TYPEN).not.toContain('nachricht_erhalten')
    expect(zaehleErledigt(zeilen, V, '2026-10-15')).toBe(3)
    expect(zaehleErledigt(zeilen, M, '2026-10-15')).toBe(1)
    expect(zaehleErledigt(zeilen)).toBe(5)
  })
})

describe('A-Pfad: Antwort aus dem Gmail-Eingang nur beschriften (keine zweite nachricht_erhalten)', () => {
  const antwort = akt({
    id: 41,
    type: 'nachricht_erhalten',
    channel: 'linkedin',
    reply_label: null,
    occurred_at: '2026-10-14T10:00:00Z',
  })
  /** Antworten je Aufruf von from('activities'): 1. jüngste Antwort, 2. eigene Kontakte danach */
  const antworten = (...daten: unknown[][]) => {
    const reihe = [...daten]
    vi.mocked(supabase.from).mockImplementation(() => kette({ data: reihe.shift() ?? [], error: null }) as never)
  }

  it('lastUnlabeledReply: jüngste Antwort ohne Reaktion und ohne eigene Nachricht danach → diese Aktivität', async () => {
    antworten([antwort], [])
    await expect(lastUnlabeledReply(LEAD, 'linkedin')).resolves.toMatchObject({ id: 41 })
    const k = vi.mocked(supabase.from).mock.results[0]?.value as ReturnType<typeof kette>
    expect(k['eq']).toHaveBeenCalledWith('lead_id', LEAD)
    expect(k['eq']).toHaveBeenCalledWith('channel', 'linkedin')
    expect(k['in']).toHaveBeenCalledWith('type', ['nachricht_erhalten', 'email_erhalten'])
    const k2 = vi.mocked(supabase.from).mock.results[1]?.value as ReturnType<typeof kette>
    expect(k2['gt']).toHaveBeenCalledWith('occurred_at', antwort.occurred_at)
  })

  it('lastUnlabeledReply: schon beschriftet, keine Antwort oder eigene Nachricht danach → null', async () => {
    antworten([{ ...antwort, reply_label: 'interessiert' }])
    await expect(lastUnlabeledReply(LEAD)).resolves.toBeNull()
    antworten([])
    await expect(lastUnlabeledReply(LEAD)).resolves.toBeNull()
    antworten([antwort], [{ id: 50 }])
    await expect(lastUnlabeledReply(LEAD)).resolves.toBeNull()
  })

  it('antwortErfassen: offene Antwort → set_reply_label (nachgetragen), sonst log_reply', async () => {
    antworten([antwort], [])
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 41, error: null } as never)
    await expect(
      antwortErfassen({ leadId: LEAD, channel: 'linkedin', label: 'interessiert', note: 'E2E – Zitat' }),
    ).resolves.toEqual({ activityId: 41, nachgetragen: true })
    expect(supabase.rpc).toHaveBeenCalledWith(
      'set_reply_label',
      { p_activity_id: 41, p_label: 'interessiert', p_note: 'E2E – Zitat' },
      undefined,
    )

    vi.mocked(supabase.rpc).mockClear()
    antworten([])
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 77, error: null } as never)
    await expect(antwortErfassen({ leadId: LEAD, label: 'spaeter' })).resolves.toEqual({
      activityId: 77,
      nachgetragen: false,
    })
    expect(supabase.rpc).toHaveBeenCalledWith('log_reply', { p_lead_id: LEAD, p_label: 'spaeter' }, undefined)
  })

  it('rpc.setReplyLabel sendet genau p_activity_id, p_label (+ p_note)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 41, error: null } as never)
    await rpc.setReplyLabel({ activityId: 41, label: 'widerspruch' })
    expect(supabase.rpc).toHaveBeenCalledWith(
      'set_reply_label',
      { p_activity_id: 41, p_label: 'widerspruch' },
      undefined,
    )
  })
})
