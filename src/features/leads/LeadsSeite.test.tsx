// LeadsSeite.test.tsx (ux § 3.2, § 8.4): Zustände Liste · leer (Filter) · leer (Suche mit Vorschlag) · Fehler; Kopf-Zähler und Fuß;
// System-Ansicht aus der URL (LE-03), Gruppierung Fälligkeit (LE-09), Filter-Chips in der URL (LE-04), Enter → Peek (LE-05),
// Inline-Edit Datum „+3“ (LE-06), Phase → Beendet verlangt Grund (LE-07), Bulk „Beenden“ + Stapel-Undo Z (LE-08), Konflikt-Toast
// (LE-16), Chip „Firma gesperrt“ (LE-17), Spaltenwahl je Ansicht (LE-01), Palette „Exportieren (CSV)“ (LE-14).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toastFehler, toastUndo, undoAusfuehren } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { download } from '@/lib/csv'
import { tagZuDate } from '@/lib/zeit'
import {
  DB,
  FIRMA_GESPERRT,
  FIRMA_GESPERRT_ID,
  MEMBER_M,
  NEUE_FIRMA_ID,
  aktivitaet,
  erstesArg,
  rendern,
  taste,
  vollerLead,
  zugriffeMit,
  zuruecksetzen,
} from './_testHilfe'
import { EVENT_LEADS_BEFEHL } from './befehle'
import { Component as LeadsSeite } from './LeadsSeite'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())
vi.mock('@/components/toast', async (original) => {
  const o = await original<typeof import('@/components/toast')>()
  return { ...o, toast: vi.fn(), toastFehler: vi.fn(), toastUndo: vi.fn(o.toastUndo) }
})
vi.mock('@/lib/csv', async (original) => ({ ...(await original<typeof import('@/lib/csv')>()), download: vi.fn() }))

const UEBER = vollerLead(1, {
  full_name: 'Anna Amsel',
  stage: 'pitch',
  next_action_at: '2026-10-12T09:00:00+02:00',
  company_id: FIRMA_GESPERRT_ID,
  updated_at: '2026-10-14T07:00:00.000Z',
})
const HEUTE_LEAD = vollerLead(3, {
  full_name: 'Bernd Biber',
  stage: 'gespraech_eroeffnet',
  next_action_at: '2026-10-14T09:00:00+02:00',
  updated_at: '2026-10-14T07:00:00.000Z',
})
const SPAETER = vollerLead(5, {
  full_name: 'Carla Calla',
  stage: 'vernetzt',
  next_action_at: '2026-10-28T09:00:00+02:00',
  updated_at: '2026-10-14T07:00:00.000Z',
})

const seite = (query = '') => rendern(<LeadsSeite />, { route: `/leads${query}`, pfad: '/leads' })
const ort = () => screen.getByTestId('ort').textContent ?? ''
const zeilen = async () => {
  const t = await screen.findByRole('table', { name: 'Leads' })
  return within(t)
    .getAllByRole('row')
    .filter((r) => r.querySelector('[data-zelle]'))
}

describe('LeadsSeite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00+02:00'))
    zuruecksetzen()
    DB.leads = [UEBER, HEUTE_LEAD, SPAETER]
    DB.companies = [FIRMA_GESPERRT]
    vi.mocked(toastFehler).mockClear()
    vi.mocked(toastUndo).mockClear()
    vi.mocked(supabase.rpc).mockClear()
    vi.mocked(download).mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('Liste: Kopf-Zähler, Zeilen, Chip „Firma gesperrt“ (LE-17), Fuß „n von m · sortiert nach …“', async () => {
    seite()
    const z = await zeilen()
    expect(z).toHaveLength(3)
    expect(within(z[0] as HTMLElement).getByText('Anna Amsel')).toBeInTheDocument()
    expect(within(z[0] as HTMLElement).getByText('Firma gesperrt')).toBeInTheDocument()
    expect(within(z[1] as HTMLElement).queryByText('Firma gesperrt')).toBeNull()
    const fuss = document.querySelector('[data-fuss]') as HTMLElement
    expect(fuss).toHaveTextContent('3 von 3 · sortiert nach Nächste Aktion')
    expect(screen.getByRole('button', { name: /Lead anlegen/ })).toHaveTextContent('⌥N')
  })

  it('System-Ansicht „Überfällig“ aus der URL liefert nur Nächste Aktion < heute (LE-03)', async () => {
    seite('?ansicht=ueberfaellig')
    const z = await zeilen()
    expect(z).toHaveLength(1)
    expect(z[0]).toHaveTextContent('Anna Amsel')
    expect(screen.getByRole('button', { name: 'Ansicht: Überfällig' })).toBeInTheDocument()
  })

  it('Gruppierung Fälligkeit: Gruppen mit Zählern (LE-09)', async () => {
    seite('?gruppe=faelligkeit')
    await zeilen()
    const gruppen = [...document.querySelectorAll('[data-gruppe]')].map((g) => g.getAttribute('data-gruppe'))
    expect(gruppen).toEqual(['ueberfaellig', 'heute', 'spaeter'])
    expect(document.querySelector('[data-gruppe="ueberfaellig"]')).toHaveTextContent('Überfällig')
  })

  it('Filter-Chip aus der URL, × entfernt ihn, Zurücksetzen leert die Overrides (LE-04)', async () => {
    seite('?phase=gepitcht&kanal=telefon')
    await zeilen()
    expect(screen.getByText('Phase · Gepitcht')).toBeInTheDocument()
    expect(screen.getByText('Kanal · Telefon')).toBeInTheDocument()
    const chip = screen.getByText('Phase · Gepitcht').closest('span,div') as HTMLElement
    fireEvent.click(within(chip.parentElement as HTMLElement).getAllByRole('button')[0] as HTMLElement)
    await waitFor(() => expect(ort()).not.toContain('phase='))
    expect(ort()).toContain('kanal=telefon')
    fireEvent.click(screen.getByRole('button', { name: /Zurücksetzen/ }))
    await waitFor(() => expect(ort()).toBe('/leads'))
  })

  it('Suche schreibt ?q= (entprellt) und der Leerzustand schlägt „Meintest du …“ vor (LE-02)', async () => {
    seite()
    await zeilen()
    DB.leads = []
    DB.suche = [{ id: '10000000-0000-4000-8000-000000000033', full_name: 'Jonas Bergfeld', stage: 'pitch' }]
    fireEvent.change(screen.getByRole('searchbox', { name: 'Leads durchsuchen' }), { target: { value: 'conrd' } })
    await waitFor(() => expect(ort()).toContain('q=conrd'), { timeout: 1500 })
    expect(await screen.findByText('Nichts gefunden für ‚conrd‘.')).toBeInTheDocument()
    expect(await screen.findByText('Meintest du Jonas Bergfeld?')).toBeInTheDocument()
  })

  it('Leerzustand Filter: „Kein Lead passt zu diesem Filter.“ mit Zurücksetzen', async () => {
    DB.leads = []
    seite('?phase=kunde')
    expect(await screen.findByText('Kein Lead passt zu diesem Filter.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Filter zurücksetzen/ })).toBeInTheDocument()
  })

  it('Fehlerzustand', async () => {
    DB.leadsFehler = { code: '500', message: 'kaputt' }
    seite()
    expect(await screen.findByText('Leads konnten nicht geladen werden – erneut versuchen.')).toBeInTheDocument()
  })

  it('J setzt den Cursor, Enter öffnet den Peek (?lead=), J bei offenem Peek wechselt den Lead (LE-05)', async () => {
    seite()
    await zeilen()
    taste('j')
    taste('Enter')
    await waitFor(() => expect(ort()).toContain(`lead=${UEBER.id}`))
    taste('j')
    await waitFor(() => expect(ort()).toContain(`lead=${HEUTE_LEAD.id}`))
  })

  it('LE-06: „+3“ auf Nächste Aktion verschiebt die Quelle (Sequenzschritt → snooze_step), nie next_action_at', async () => {
    DB.leads = [UEBER, { ...HEUTE_LEAD, next_action_kind: 'sequenz_schritt', next_action_ref: 'enr-1' }, SPAETER]
    seite()
    const z = await zeilen()
    fireEvent.doubleClick((z[1] as HTMLElement).querySelector('[data-zelle="naechsteAktion"]') as HTMLElement)
    const feld = await screen.findByRole('textbox', { name: 'Nächste Aktion' })
    fireEvent.change(feld, { target: { value: '+3' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalled())
    expect(vi.mocked(supabase.rpc).mock.calls[0]).toEqual([
      'snooze_step',
      { p_enrollment_id: 'enr-1', p_until: tagZuDate('2026-10-17', '09:00').toISOString() },
      undefined,
    ])
    // Review: next_action_at ist von recompute_lead_next_action gepflegt – kein direkter Lead-Patch mehr
    expect(zugriffeMit('leads', 'update')).toHaveLength(0)
  })

  it('LE-06: Rückruf/Aufgabe → snooze_task; ohne nächste Aktion entsteht eine Aufgabe „Nachfassen“', async () => {
    DB.leads = [{ ...UEBER, next_action_kind: 'rueckruf', next_action_ref: 'task-1' }, HEUTE_LEAD, SPAETER]
    seite()
    let z = await zeilen()
    fireEvent.doubleClick((z[0] as HTMLElement).querySelector('[data-zelle="naechsteAktion"]') as HTMLElement)
    let feld = await screen.findByRole('textbox', { name: 'Nächste Aktion' })
    fireEvent.change(feld, { target: { value: '+3' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalled())
    expect(vi.mocked(supabase.rpc).mock.calls[0]?.[0]).toBe('snooze_task')
    expect(vi.mocked(supabase.rpc).mock.calls[0]?.[1]).toEqual({
      p_task_id: 'task-1',
      p_until: tagZuDate('2026-10-17', '09:00').toISOString(),
    })

    z = await zeilen()
    fireEvent.doubleClick((z[1] as HTMLElement).querySelector('[data-zelle="naechsteAktion"]') as HTMLElement)
    feld = await screen.findByRole('textbox', { name: 'Nächste Aktion' })
    fireEvent.change(feld, { target: { value: '+3' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    await waitFor(() => expect(zugriffeMit('tasks', 'insert')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('tasks', 'insert')[0] ?? [], 'insert')).toMatchObject({
      lead_id: HEUTE_LEAD.id,
      kind: 'aufgabe',
      title: 'Nachfassen',
      due_at: tagZuDate('2026-10-17', '09:00').toISOString(),
    })
    expect(zugriffeMit('leads', 'update')).toHaveLength(0)
  })

  it('Inline-Name schreibt nur Vor- und Nachname – full_name ist eine generierte Spalte (Review)', async () => {
    seite()
    const z = await zeilen()
    fireEvent.doubleClick((z[1] as HTMLElement).querySelector('[data-zelle="name"]') as HTMLElement)
    const feld = await screen.findByRole('textbox', { name: 'Name' })
    fireEvent.change(feld, { target: { value: 'Bernd Maria Biber' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('leads', 'update')[0] ?? [], 'update')).toEqual({
      first_name: 'Bernd Maria',
      last_name: 'Biber',
    })
  })

  it('Inline-Unternehmen verknüpft die Firma (company_id) statt nur company_name zu schreiben', async () => {
    seite()
    const z = await zeilen()
    fireEvent.doubleClick((z[1] as HTMLElement).querySelector('[data-zelle="unternehmen"]') as HTMLElement)
    const feld = await screen.findByRole('textbox', { name: 'Unternehmen' })
    fireEvent.change(feld, { target: { value: 'Neue Solar GmbH' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('companies', 'insert')[0] ?? [], 'insert')).toEqual({ name: 'Neue Solar GmbH' })
    expect(erstesArg(zugriffeMit('leads', 'update')[0] ?? [], 'update')).toEqual({
      company_id: NEUE_FIRMA_ID,
      company_name: 'Neue Solar GmbH',
    })
  })

  it('Gruppieren → Phase rendert Gruppen mit Phasen-Namen (vorher Absturz „Unbekannte Stufe“)', async () => {
    seite('?gruppe=phase')
    const t = await screen.findByRole('table', { name: 'Leads' })
    expect(t).toHaveTextContent('Gepitcht')
    expect(t).toHaveTextContent('Eröffnet')
    expect(t).toHaveTextContent('Vernetzt')
  })

  it('Ladefehler: Fehlerzeile mit „Erneut versuchen R“ statt Leerzustand', async () => {
    DB.leadsFehler = { code: '500', message: 'kaputt' }
    seite()
    const alarm = await screen.findByRole('alert')
    expect(alarm).toHaveTextContent('Leads konnten nicht geladen werden – erneut versuchen.')
    DB.leadsFehler = null
    const vorher = DB.zugriffe.filter((x) => x.tabelle === 'leads').length
    taste('r')
    await waitFor(() => expect(DB.zugriffe.filter((x) => x.tabelle === 'leads').length).toBeGreaterThan(vorher))
  })

  it('Phase per Inline-Edit auf Beendet speichert nicht ohne Grund – das Grund-Popover öffnet (LE-07)', async () => {
    seite()
    const z = await zeilen()
    fireEvent.doubleClick((z[0] as HTMLElement).querySelector('[data-zelle="phase"]') as HTMLElement)
    const select = await screen.findByRole('combobox', { name: 'Phase' })
    fireEvent.change(select, { target: { value: 'beendet' } })
    fireEvent.blur(select)
    expect(await screen.findByText('Nicht qualifiziert')).toBeInTheDocument()
    expect(zugriffeMit('leads', 'update')).toHaveLength(0)
  })

  it('Konflikt (veraltetes updated_at) → Toast „… hat den Lead gerade geändert – neu geladen.“ (LE-16)', async () => {
    DB.konflikt = true
    seite()
    const z = await zeilen()
    fireEvent.doubleClick((z[1] as HTMLElement).querySelector('[data-zelle="unternehmen"]') as HTMLElement)
    const feld = await screen.findByRole('textbox', { name: 'Unternehmen' })
    fireEvent.change(feld, { target: { value: 'Biber Solar' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    await waitFor(() => expect(toastFehler).toHaveBeenCalled())
    expect(vi.mocked(toastFehler).mock.calls[0]?.[0]).toMatch(/hat den Lead gerade geändert – neu geladen\.$/)
  })

  it('Bulk: 3 auswählen, ⌥B öffnet das Menü, „Beenden · Kein Bedarf“ = 3 Patches + ein Stapel-Toast, Z macht alle 3 rückgängig (LE-08)', async () => {
    DB.activities = [UEBER, HEUTE_LEAD, SPAETER].map((l, i) =>
      aktivitaet({ id: 500 + i, lead_id: l.id, type: 'stage_wechsel', member_id: MEMBER_M }),
    )
    seite()
    await zeilen()
    for (const box of screen.getAllByRole('checkbox', { name: 'Auswählen' })) fireEvent.click(box)
    const leiste = await screen.findByRole('toolbar', { name: 'Bulk-Aktionen' })
    expect(leiste).toHaveTextContent('3 ausgewählt')
    fireEvent.keyDown(document.body, { key: '∫', code: 'KeyB', altKey: true })
    expect(await screen.findByRole('menu', { name: 'Bulk-Menü' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Beenden (Grund)' }))
    fireEvent.change(await screen.findByLabelText('Grund'), { target: { value: 'kein_bedarf' } })
    fireEvent.click(screen.getByRole('button', { name: 'Beenden' }))
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(3))
    for (const z of zugriffeMit('leads', 'update'))
      expect(erstesArg(z, 'update')).toEqual({ stage: 'beendet', ended_reason: 'kein_bedarf', ended_note: null })
    // Stapel-Toast über M0 (toastUndo mit ID-Liste); `Z` ist die globale Taste (GlobaleTasten → undoAusfuehren)
    await waitFor(() => expect(toastUndo).toHaveBeenCalledWith(expect.any(String), [500, 501, 502]))
    await act(async () => {
      await undoAusfuehren()
    })
    await waitFor(() =>
      expect(vi.mocked(supabase.rpc).mock.calls.filter((c) => c[0] === 'undo_activity')).toHaveLength(3),
    )
  })

  it('Bulk „Sequenz starten“ prüft die Gates je Lead: Firmensperre/Sperrliste werden übersprungen, Grund im Toast (Review)', async () => {
    DB.sperrliste = [{ id: 's1', email: null, lead_id: SPAETER.id, channels: ['linkedin', 'telefon', 'email'] }]
    seite()
    await zeilen()
    for (const box of screen.getAllByRole('checkbox', { name: 'Auswählen' })) fireEvent.click(box)
    const leiste = await screen.findByRole('toolbar', { name: 'Bulk-Aktionen' })
    fireEvent.click(within(leiste).getByRole('button', { name: 'Sequenz starten' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Sequenz'), { target: { value: 'linkedin_standard' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sequenz starten' }))
    await waitFor(() => expect(toastUndo).toHaveBeenCalled())
    const enroll = vi.mocked(supabase.rpc).mock.calls.filter((c) => c[0] === 'enroll')
    expect(enroll).toHaveLength(1)
    expect(enroll[0]?.[1]).toMatchObject({ p_lead_id: HEUTE_LEAD.id, p_sequence_key: 'linkedin_standard' })
    expect(vi.mocked(toastUndo).mock.calls.at(-1)?.[0]).toBe(
      '1 Lead in Sequenz A gestartet · 2 übersprungen (Firma gesperrt – nicht anschreiben, Auf der Sperrliste).',
    )
  })

  it('K-05: Funnel-Link aus den KPIs (?ereignis&von&bis) zeigt den Ereignis-Chip und fragt activities!inner ab', async () => {
    seite('?ereignis=nachricht_erhalten&von=2026-10-01&bis=2026-10-14')
    expect(await screen.findByText(/Antwort erhalten · 01\.10\.–14\.10\./)).toBeInTheDocument()
    await waitFor(() =>
      expect(
        zugriffeMit('leads', 'select').some((z) => String(erstesArg(z, 'select')).includes('activities!inner(id)')),
      ).toBe(true),
    )
    const z = zugriffeMit('leads', 'select').find((x) => String(erstesArg(x, 'select')).includes('activities!inner'))
    expect(
      z?.some((a) => a.methode === 'eq' && a.args[0] === 'activities.type' && a.args[1] === 'nachricht_erhalten'),
    ).toBe(true)
  })

  it('Spaltenwahl persistiert je Ansicht (LE-01) und Palette „Spalten wählen“ öffnet den Wähler', async () => {
    seite()
    await zeilen()
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENT_LEADS_BEFEHL, { detail: { befehl: 'spalten' } }))
    })
    const gruppe = await screen.findByRole('group', { name: 'Spalten' })
    fireEvent.click(within(gruppe).getByLabelText('Ort'))
    expect(JSON.parse(localStorage.getItem('crm.leads.spalten.alle') ?? '[]')).toContain('ort')
    expect(screen.getAllByRole('columnheader').some((h) => h.textContent?.includes('Ort'))).toBe(true)
  })

  it('Palette „Exportieren (CSV)“ lädt die aktuelle Ansicht herunter (LE-14)', async () => {
    seite()
    await zeilen()
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENT_LEADS_BEFEHL, { detail: { befehl: 'export' } }))
    })
    expect(download).toHaveBeenCalledTimes(1)
    expect(vi.mocked(download).mock.calls[0]?.[1]).toBe('crm-leads-alle-2026-10-14.csv')
  })

  it('Peek aus der Palette (?lead=) setzt den Cursor der Liste; nach dem Schließen geht es von dort weiter (S-07)', async () => {
    seite(`?lead=${HEUTE_LEAD.id}`)
    await zeilen()
    await waitFor(() =>
      expect(document.querySelector(`tr[data-id="${HEUTE_LEAD.id}"]`)).toHaveAttribute('aria-selected', 'true'),
    )
    taste('j')
    await waitFor(() => expect(ort()).toContain(`lead=${SPAETER.id}`))
  })

  it('1.000 Leads: virtualisiert, erste Zeilen in < 1 s (LE-10)', async () => {
    DB.leads = Array.from({ length: 1000 }, (_, i) =>
      vollerLead(1, {
        id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        full_name: `Test Person ${i}`,
        next_action_at: '2026-10-20T09:00:00+02:00',
      }),
    )
    const start = performance.now()
    seite()
    const z = await zeilen()
    expect(performance.now() - start).toBeLessThan(1000)
    expect(z.length).toBeGreaterThan(0)
    expect(z.length).toBeLessThan(200)
    expect(document.querySelector('[data-fuss]')).toHaveTextContent('1000 von 1000')
  })
})
