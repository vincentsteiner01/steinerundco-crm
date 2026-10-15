// PipelineSeite.test.tsx (ux § 3.4, § 8.6): Spaltenreihenfolge + eingeklappt (P-01), Kopf mit Zähler und Konversion (P-07),
// ⇧→ setzt die Phase und markiert den Beleg „per Pipeline“ (P-02, P-05), Pflicht-Popovers: Erstgespräch abbrechen = kein Wechsel (P-03),
// Beendet ohne Grund nicht möglich (P-04), Drop ändert nie Zuständig (P-06), Kunde fragt das Vertragsdatum, J/K/H/L + ↵, leere Spalte.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toastUndo } from '@/components/toast'
import {
  DB,
  FIRMA_GESPERRT,
  FIRMA_GESPERRT_ID,
  aktivitaet,
  erstesArg,
  rendern,
  taste,
  vollerLead,
  zugriffeMit,
  zuruecksetzen,
} from '@/features/leads/_testHilfe'
import { konversion, sortiereSpalte } from './logik'
import { Component as Pipeline } from './PipelineSeite'

vi.mock('@/data/supabase', async () => (await import('@/features/leads/_supabaseM2')).supabaseM2())
vi.mock('@/components/toast', async (original) => ({
  ...(await original<typeof import('@/components/toast')>()),
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(() => 'undo'),
}))

const ERO = vollerLead(3, { full_name: 'Emil Eule', stage: 'gespraech_eroeffnet', company_id: FIRMA_GESPERRT_ID })
const PITCH = vollerLead(7, { full_name: 'Paula Pfau', stage: 'pitch' })
const V1 = vollerLead(2, { full_name: 'Vera Vogel', stage: 'vernetzt' })
const V2 = vollerLead(4, { full_name: 'Viktor Wal', stage: 'vernetzt' })
const V3 = vollerLead(6, { full_name: 'Wanda Wolf', stage: 'vernetzt' })
const V4 = vollerLead(8, { full_name: 'Xaver Yak', stage: 'vernetzt' })
const WV = vollerLead(9, { full_name: 'Wilma Wiesel', stage: 'langfristig' })

const seite = (query = '') => rendern(<Pipeline />, { route: `/pipeline${query}`, pfad: '/pipeline' })
const ort = () => screen.getByTestId('ort').textContent ?? ''
const spalte = (key: string) => document.querySelector(`[data-spalte="${key}"]`) as HTMLElement
const shiftPfeil = (key: 'ArrowRight' | 'ArrowLeft') => fireEvent.keyDown(document.body, { key, shiftKey: true })

describe('PipelineSeite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00+02:00'))
    zuruecksetzen()
    DB.leads = [ERO, PITCH, V1, V2, V3, V4, WV]
    DB.companies = [FIRMA_GESPERRT]
    vi.mocked(toastUndo).mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('10 Spalten in Funnel-Reihenfolge, Angefragt · Wiedervorlage · Beendet eingeklappt (P-01)', async () => {
    seite()
    await screen.findByText('Emil Eule')
    const keys = [...document.querySelectorAll('[data-spalte]')].map((s) => s.getAttribute('data-spalte'))
    expect(keys).toEqual([
      'angefragt',
      'vernetzt',
      'eroeffnet',
      'beantwortet',
      'gepitcht',
      'erstgespraech',
      'strategiegespraech',
      'kunde',
      'wiedervorlage',
      'beendet',
    ])
    const zu = [...document.querySelectorAll('[data-eingeklappt]')].map((s) => s.getAttribute('data-spalte'))
    expect(zu).toEqual(['angefragt', 'wiedervorlage', 'beendet'])
    expect(within(spalte('beantwortet')).getByText('Keine Leads')).toBeInTheDocument()
    expect(within(spalte('eroeffnet')).getByText('Firma gesperrt')).toBeInTheDocument()
  })

  it('Spaltenkopf: Zähler und Konversion zur Vorstufe aus dem Bestand (P-07: 1 / 4 = 25 %)', async () => {
    seite()
    await screen.findByText('Emil Eule')
    const kopf = within(spalte('eroeffnet')).getByRole('button', { expanded: true })
    expect(kopf).toHaveTextContent('Eröffnet')
    expect(kopf).toHaveTextContent('1')
    expect(kopf.textContent?.replace(/ /g, ' ')).toContain('25 %')
    expect(within(spalte('vernetzt')).getByRole('button', { expanded: true })).toHaveTextContent('4')
    expect(konversion([0, 82, 19], 2)).toBeCloseTo(19 / 82)
    expect(konversion([5, 4], 0)).toBeNull()
    expect(konversion([1, 1, 1, 1, 1, 1, 1, 1, 3, 3], 8)).toBeNull()
  })

  it('eingeklappte Spalte per Klick ausklappen (localStorage)', async () => {
    seite()
    await screen.findByText('Emil Eule')
    fireEvent.click(screen.getByRole('button', { name: 'Wiedervorlage ausklappen' }))
    expect(await screen.findByText('Wilma Wiesel')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('crm.pipeline.eingeklappt') ?? '[]')).toEqual(['angefragt', 'beendet'])
  })

  it('⇧→ auf Eröffnet → Beantwortet: nur stage, Beleg „per Pipeline“ + Undo-Toast (P-02, P-05, P-06)', async () => {
    DB.activities = [
      aktivitaet({
        lead_id: ERO.id,
        type: 'stage_wechsel',
        metadata: { from: 'gespraech_eroeffnet', to: 'dm_beantwortet' },
      }),
    ]
    seite(`?lead=${ERO.id}`)
    await screen.findByText('Emil Eule')
    shiftPfeil('ArrowRight')
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('leads', 'update')[0] ?? [], 'update')).toEqual({ stage: 'dm_beantwortet' })
    await waitFor(() => expect(zugriffeMit('activities', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('activities', 'update')[0] ?? [], 'update')).toEqual({
      metadata: { from: 'gespraech_eroeffnet', to: 'dm_beantwortet', via: 'pipeline' },
    })
    await waitFor(() => expect(toastUndo).toHaveBeenCalled())
    expect(vi.mocked(toastUndo).mock.calls[0]?.[0]).toBe('Phase geändert: Eröffnet → Beantwortet.')
  })

  it('⇧← rückwärts: „Phase zurückgesetzt“', async () => {
    DB.activities = [aktivitaet({ lead_id: PITCH.id, type: 'stage_wechsel' })]
    seite(`?lead=${PITCH.id}`)
    await screen.findByText('Paula Pfau')
    shiftPfeil('ArrowLeft')
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('leads', 'update')[0] ?? [], 'update')).toEqual({ stage: 'dm_beantwortet' })
    await waitFor(() => expect(toastUndo).toHaveBeenCalled())
    expect(vi.mocked(toastUndo).mock.calls[0]?.[0]).toBe('Phase zurückgesetzt: Gepitcht → Beantwortet.')
  })

  it('Drop auf Erstgespräch öffnet den Termin-Dialog; Abbrechen = kein Wechsel (P-03)', async () => {
    seite(`?lead=${PITCH.id}`)
    await screen.findByText('Paula Pfau')
    shiftPfeil('ArrowRight')
    const dialog = await screen.findByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(zugriffeMit('leads', 'update')).toHaveLength(0)
    expect(zugriffeMit('meetings', 'insert')).toHaveLength(0)
    expect(within(spalte('gepitcht')).getByText('Paula Pfau')).toBeInTheDocument()
  })

  it('Drop auf Beendet verlangt einen Grund (P-04) – ohne Auswahl keine Änderung', async () => {
    localStorage.setItem('crm.pipeline.eingeklappt', '[]')
    seite(`?lead=${WV.id}`)
    await screen.findByText('Wilma Wiesel')
    shiftPfeil('ArrowRight')
    expect(await screen.findByText('Nicht qualifiziert')).toBeInTheDocument()
    expect(zugriffeMit('leads', 'update')).toHaveLength(0)
  })

  it('Drop auf Kunde fragt „Datum Vertragsabschluss“ und schreibt Stufe + Notiz', async () => {
    const SG = vollerLead(10, { full_name: 'Sina Specht', stage: 'strategiegespraech' })
    DB.leads = [...DB.leads, SG]
    seite(`?lead=${SG.id}`)
    await screen.findByText('Sina Specht')
    shiftPfeil('ArrowRight')
    const dialog = await screen.findByRole('dialog', { name: 'Datum Vertragsabschluss' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Als Kunde eintragen' }))
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('leads', 'update')[0] ?? [], 'update')).toEqual({ stage: 'kunde' })
    await waitFor(() => expect(zugriffeMit('activities', 'insert')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('activities', 'insert')[0] ?? [], 'insert')).toMatchObject({
      type: 'notiz',
      note: 'Vertragsabschluss am 14.10.2026',
    })
  })

  it('J/K in der Spalte, L/H wechseln die Spalte, ↵ öffnet den Peek', async () => {
    seite()
    await screen.findByText('Emil Eule')
    taste('j')
    taste('Enter')
    await waitFor(() => expect(ort()).toMatch(/lead=10000000-0000-4000-8000-0000000000(02|04|06|08)/))
    taste('l')
    taste('Enter')
    await waitFor(() => expect(ort()).toContain(`lead=${ERO.id}`))
  })

  it('Zuständig-Filter steht in der URL', async () => {
    seite()
    await screen.findByText('Emil Eule')
    fireEvent.click(within(screen.getByRole('group', { name: 'Zuständig' })).getByText('Ich'))
    await waitFor(() => expect(ort()).toContain('zustaendig=me'))
  })

  it('sortiereSpalte: nächste Aktion ↑, ohne zuletzt, dann Letzte Bewegung ↓', () => {
    const r = sortiereSpalte([
      { id: 'a', next_action_at: null, last_activity_at: '2026-10-10T09:00:00Z' },
      { id: 'b', next_action_at: '2026-10-20T09:00:00Z', last_activity_at: null },
      { id: 'c', next_action_at: '2026-10-15T09:00:00Z', last_activity_at: null },
      { id: 'd', next_action_at: null, last_activity_at: '2026-10-12T09:00:00Z' },
    ])
    expect(r.map((x) => x.id)).toEqual(['c', 'b', 'd', 'a'])
  })
})
