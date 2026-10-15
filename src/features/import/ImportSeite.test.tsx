// ImportSeite: Stepper-Zustände, Preset-Zeilen, Dropzone, Allgemein-Fluss (CSV → Spalten → Dry-Run → Import → Fertig), CRM-Tabelle (XLSX lazy),
// KPI-Monat und Leitfäden ohne DB-Dry-Run, ?preset=, mobil „Am Desktop bearbeiten“, Tastatur Enter/Esc.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())
vi.mock('@/features/auth/authStore', () => ({
  useAuth: (sel: (s: { status: string; member: { user_id: string } }) => unknown) =>
    sel({ status: 'mitglied', member: { user_id: '00000000-0000-4000-8000-000000000001' } }),
}))

import { useUiStore } from '@/app/uiStore'
import { supabase } from '@/data/supabase'
import { Component } from './ImportSeite'
import { MEMBER_V, rendernMitRouter, rpcAntworten, rpcAufrufe } from './_testHilfe'

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>

function datei(inhalt: BlobPart, name: string): File {
  const f = new File([inhalt], name)
  if (typeof (f as Blob).arrayBuffer !== 'function')
    Object.defineProperty(f, 'arrayBuffer', {
      value: async () => (typeof inhalt === 'string' ? new TextEncoder().encode(inhalt).buffer : inhalt),
    })
  return f
}

async function xlsxDatei(name: string, tabs: Record<string, unknown[][]>): Promise<File> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const [tab, zeilen] of Object.entries(tabs))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(zeilen), tab)
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return datei(buf, name)
}

const CSV =
  'Name;Unternehmen;LinkedIn;Umsatz\nMax Mustermann;Sonnenkraft GmbH;https://www.linkedin.com/in/max-mustermann/;12\nEva Lang;;https://www.linkedin.com/in/eva-lang/;\n'

const rendern = (start = '/import') => rendernMitRouter(Component, start, '/import')
const upload = (f: File) => fireEvent.change(screen.getByLabelText('Datei auswählen'), { target: { files: [f] } })
const preset = (name: string) => fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${name}`) }))
const weiter = () => screen.getByRole('button', { name: /^(Weiter|Prüfen|Importieren)/ })

describe('ImportSeite', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    rpc.mockReset()
    rpcAntworten(rpc, (name, args) => {
      if (name === 'import_leads') {
        const rows = args['p_rows'] as Record<string, unknown>[]
        return {
          batch_id: args['p_dry_run'] ? null : 'b-leads',
          dry_run: !!args['p_dry_run'],
          inserted: rows.length - 1,
          updated: 1,
          skipped: 0,
          blocked: 0,
          invalid: 0,
          rows: rows.map((r, i) => ({
            status: i === 1 ? 'duplikat' : 'neu',
            name: String(r['name'] ?? ''),
            company: (r['company'] as string) ?? null,
            linkedin_url_norm: null,
            existing_id: i === 1 ? 'x' : null,
            existing_stage: i === 1 ? 'vernetzt' : null,
            existing_owner: i === 1 ? MEMBER_V : null,
          })),
        }
      }
      if (name === 'import_sheet_leads') {
        const dry = !!args['p_dry_run']
        const doc = args['p_doc'] as { crm: { rows: Record<string, unknown>[] } }
        return {
          batch_id: dry ? null : 'b-sheet',
          dry_run: dry,
          vorschau: dry ? doc.crm.rows.length : 0,
          leads_neu: dry ? 0 : doc.crm.rows.length,
          leads_aktualisiert: 0,
          uebersprungen: 0,
          sequenzen: 1,
          aufgaben: 0,
          hinweise: doc.crm.rows.map((r) => ({
            id: r['id'],
            name: r['vor_und_nachname'],
            stufe: 'dm_follow_up',
            grund: null,
            owner: MEMBER_V,
            naechster: '2026-10-12',
            hinweis: r['unternehmen'] ? undefined : 'Unternehmen fehlt',
          })),
        }
      }
      if (name === 'import_sheet_kpis') return { monatswerte: 11, tageswerte: 20, monate: ['2026-09'] }
      if (name === 'import_templates') return { inserted: 2, updated: 0 }
      if (name === 'undo_import') return { batch_id: 'b-leads', deleted_leads: 1 }
      return null
    })
  })

  it('Schritt 1: Stepper, fünf Preset-Zeilen (LinkedIn-Export deaktiviert v1.1), Dropzone erst nach Preset-Wahl, Link Schnellimport', () => {
    rendern()
    expect(screen.getByRole('heading', { name: 'Import' })).toBeInTheDocument()
    const schritte = screen.getByRole('list', { name: 'Schritte' })
    expect(within(schritte).getAllByRole('listitem')).toHaveLength(4)
    expect(within(schritte).getByRole('listitem', { current: 'step' })).toHaveTextContent('1Quelle')
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    for (const name of ['CRM-Tabelle', 'KPI-Monat', 'DM-Leitfäden', 'LinkedIn-Export', 'Allgemein'])
      expect(screen.getByRole('radio', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /LinkedIn-Export/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /LinkedIn-Export/ })).toHaveTextContent('v1.1')
    expect(screen.getByLabelText('Datei auswählen')).toBeDisabled()
    expect(screen.getByText('Erst ein Preset wählen')).toBeInTheDocument()
    expect(weiter()).toBeDisabled()
    expect(screen.getByRole('button', { name: /Schnellimport \(Text einfügen\)/ })).toBeInTheDocument()
    preset('Allgemein')
    expect(screen.getByRole('radio', { name: /^Allgemein/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Datei auswählen')).toBeEnabled()
  })

  it('?preset=kpi_monat belegt das Preset vor; falsche Endung → Fehlertext', async () => {
    rendern('/import?preset=kpi_monat')
    expect(screen.getByRole('radio', { name: /^KPI-Monat/ })).toHaveAttribute('aria-checked', 'true')
    upload(datei('x', 'daten.csv'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/erwartet XLSX/))
  })

  it('Allgemein: CSV → Spalten (erkannt/unerkannt, Select) → Dry-Run-Chips → Dublette überspringen → Import → Fertig mit Rückgängig', async () => {
    const { router } = rendern()
    preset('Allgemein')
    upload(datei(CSV, 'leads.csv'))
    await screen.findByRole('table', { name: 'Spaltenzuordnung' })
    expect(screen.getByRole('list', { name: 'Schritte' })).toHaveTextContent('2Spalten')
    const umsatz = screen.getByLabelText('Zielfeld für Umsatz') as HTMLSelectElement
    expect(umsatz.value).toBe('')
    expect((screen.getByLabelText('Zielfeld für Name') as HTMLSelectElement).value).toBe('name')
    expect(screen.getByText('2 Zeilen mit Name oder URL · 2 Zeilen in der Datei')).toBeInTheDocument()
    fireEvent.change(umsatz, { target: { value: 'notes' } })
    expect(umsatz.value).toBe('notes')
    expect(screen.getByText('kein Datum erkannt')).toBeInTheDocument()
    expect(weiter()).toHaveTextContent('Prüfen (Dry-Run)')
    fireEvent.click(weiter())
    await screen.findByRole('table', { name: 'Vorschau Import' })
    expect(rpcAufrufe(rpc, 'import_leads')[0]).toMatchObject({
      p_dry_run: true,
      p_source: 'import_csv',
      p_label: 'leads.csv',
    })
    expect(screen.getByText('Neu')).toBeInTheDocument()
    expect(screen.getByText('Dublette')).toBeInTheDocument()
    expect(screen.getByText('Vernetzt · Vincent')).toBeInTheDocument()
    const seg = screen.getByRole('group', { name: 'Dublette Eva Lang' })
    fireEvent.click(within(seg).getByRole('button', { name: 'Überspringen' }))
    expect(weiter()).toHaveTextContent('Importieren')
    fireEvent.click(weiter())
    await screen.findByText('neu angelegt')
    const echt = rpcAufrufe(rpc, 'import_leads')[1]
    expect(echt?.['p_dry_run']).toBe(false)
    expect(echt?.['p_rows']).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Zu den Leads (Filter: dieser Import)' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/aktualisierte Leads bleiben auf dem neuen Stand/)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rückgängig machen' }))
    await waitFor(() => expect(rpcAufrufe(rpc, 'undo_import')[0]).toEqual({ p_batch_id: 'b-leads' }))
    await screen.findByText(/Rückgängig gemacht – 1 Leads gelöscht/)
    fireEvent.click(screen.getByRole('button', { name: 'Zu den Leads (Filter: dieser Import)' }))
    await waitFor(() => expect(router.state.location.search).toBe('?quelle=b-leads'))
  })

  it('CRM-Tabelle: XLSX (lazy) → 24 Spalten erkannt → Dry-Run mit Stufe/Zuständig/Chips → Pflichtauswahl → Import', async () => {
    rendern()
    preset('CRM-Tabelle')
    const kopf = [
      'ID',
      'Vor- und Nachname',
      'LinkedIn URL',
      'Telefonnummer',
      'Unternehmen',
      'Mike: Anfrage gesendet am',
      'Mike: akzeptiert?',
      'Vincent: Anfrage gesendet am',
      'Vincent: akzeptiert?',
      'Gesprächseröffnung am',
      'Gespräch eröffnet von',
      'DM-Zuständigkeit',
      'Für anderen freigegeben?',
      'Letztes DM Follow-Up am',
      'DM Follow-Ups Anzahl',
      'Erstgespräch am',
      'Strategiegespräch am',
      'Status',
      'Mitarbeiter',
      'Lead-Phase',
      'Nächster Follow-Up am',
      'Notizen',
      'System-ID',
      'System-ID 2',
    ]
    const z1 = [
      1,
      'Test Person 01',
      'https://www.linkedin.com/in/test-person-01/',
      null,
      'Solar 01 GmbH',
      null,
      'Ja',
      null,
      'Ja',
      '17.09.2026',
      'Mike',
      'Mike',
      null,
      '30.09.2026',
      1,
      null,
      null,
      'DM Follow-Up',
      'Mike',
      'LinkedIn Lead',
      '12.10.2026',
      null,
      null,
      null,
    ]
    const z2 = [
      2,
      'Test Person 02',
      'https://www.linkedin.com/in/test-person-02/',
      null,
      null,
      null,
      null,
      null,
      'Ja',
      '01.10.2026',
      'Vincent',
      '#ERROR!',
      null,
      null,
      null,
      null,
      null,
      'Eröffnung',
      null,
      'LinkedIn Lead',
      null,
      'NICHT ANSCHREIBEN – Partner',
      null,
      null,
    ]
    upload(await xlsxDatei('crm.xlsx', { CRM: [kopf, z1, z2], INFO: [['Regeln']] }))
    await screen.findByRole('table', { name: 'Erkannte Spalten' })
    expect(screen.getByText(/von 24 Spalten erkannt/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Erkannte Spalten' })).toHaveTextContent('system_id_2')
    fireEvent.click(weiter())
    await screen.findByRole('table', { name: 'Vorschau CRM-Tabelle' })
    expect(rpcAufrufe(rpc, 'import_sheet_leads')[0]?.['p_dry_run']).toBe(true)
    const doc = rpcAufrufe(rpc, 'import_sheet_leads')[0]?.['p_doc'] as {
      source: { tabs: string[] }
      crm: { rows: Record<string, unknown>[] }
    }
    expect(doc.source.tabs).toEqual(['CRM', 'INFO'])
    expect(doc.crm.rows[0]).toMatchObject({
      id: 1,
      gespraechseroeffnung_am: '2026-09-17',
      mike_akzeptiert: 'Ja',
      dm_follow_ups_anzahl: 1,
    })
    expect(doc.crm.rows[1]).toMatchObject({ _errors: ['dm_zustaendigkeit'], dm_zustaendigkeit_resolved: null })
    expect(screen.getByText('1 ×')).toBeInTheDocument() // „Unternehmen fehlt“
    expect(screen.getAllByText('Nicht anschreiben').length).toBeGreaterThanOrEqual(2) // Zähler + Chip
    expect(screen.getByText('Ohne Zuständigen')).toBeInTheDocument()
    expect(screen.getAllByText('beide angefragt').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Eröffnet').length).toBeGreaterThan(0) // Stufe aus dem Dry-Run (dm_follow_up → Phase Eröffnet)
    expect(weiter()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Alle ohne Zuständigen → Vincent' }))
    await waitFor(() => expect(weiter()).toBeEnabled())
    fireEvent.click(weiter())
    await screen.findByText('Leads neu')
    const echt = rpcAufrufe(rpc, 'import_sheet_leads')[1]?.['p_doc'] as { crm: { rows: Record<string, unknown>[] } }
    expect(echt.crm.rows[1]?.['dm_zustaendigkeit_resolved']).toBe('Vincent')
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).not.toBeInTheDocument() // Sheet-Import idempotent
    expect(screen.getByText(/idempotent/)).toBeInTheDocument()
  })

  it('KPI-Monat: Person wählbar, lokale Vorschau, Import ohne Dry-Run', async () => {
    const { router } = rendern()
    preset('KPI-Monat')
    const d = (t: number) => new Date(Date.UTC(2026, 8, t))
    upload(
      await xlsxDatei('kpis.xlsx', {
        'KPIs - SEPTEMBER 2026': [
          [null, 'LINKEDIN VERTRIEBS-KPI DASHBOARD - Vincent Steiner'],
          [null, 'CONNECTIONS', null, null, null, null, 'Tag', 'Gespräche eröffnet'],
          [null, 'Vernetzung versendet', 288, null, null, null, d(1), 3],
          [null, 'Angenommene Vernetzungen', 55, null, null, null, d(2), 4],
          [null, 'OUTREACH'],
          [null, 'DM beantwortet', 10],
        ],
        Anleitung: [['1', 'Monat wechseln', 'Text']],
      }),
    )
    await screen.findByRole('list', { name: 'Erkannte Monate' })
    expect(screen.getByText(/2026-09 · 3 Werte · 2 Tage · Σ 7/)).toBeInTheDocument()
    // Runde 3: Werte sind Vornamen (Vincent hat das Kürzel „VS“), Standard Vincent ist ausgewählt
    const person = screen.getByLabelText('Person') as HTMLSelectElement
    expect([...person.options].map((o) => [o.value, o.textContent])).toEqual([
      ['Vincent', 'Vincent'],
      ['Mike', 'Mike'],
    ])
    expect(person.value).toBe('Vincent')
    fireEvent.change(person, { target: { value: 'Mike' } })
    fireEvent.click(weiter())
    await screen.findByText('Monatswerte')
    expect(rpc).not.toHaveBeenCalledWith('import_leads', expect.anything())
    fireEvent.click(weiter())
    await screen.findByText('Tageswerte')
    const doc = rpcAufrufe(rpc, 'import_sheet_kpis')[0]?.['p_doc'] as {
      months: { person: string; month: string; daily: unknown[] }[]
    }
    expect(doc.months[0]).toMatchObject({ person: 'Mike', month: '2026-09' })
    expect(doc.months[0]?.daily).toHaveLength(2)
    expect(screen.getByText('September 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Zu den KPIs' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/kpis'))
  })

  it('DM-Leitfäden: Tabs 1–4 → import_templates', async () => {
    rendern()
    preset('DM-Leitfäden')
    upload(
      await xlsxDatei('leitfaeden.xlsx', {
        Übersicht: [['Stufe 1']],
        '1 Gesprächseröffnung': [
          ['Leitfaden', 'Wann verwenden?', 'Nachricht – Copy & Paste', 'Notizen / Tests'],
          ['Gesprächseröffnung (V1)', 'Erste Nachricht', 'Hallo Herr [Nachname]', null],
          ['Gesprächseröffnung (V2)', null, '', null],
        ],
      }),
    )
    await screen.findByRole('list', { name: 'Erkannte Tabs' })
    expect(screen.getByText('2 Leitfäden · 1 ohne Text (werden inaktiv) · übersprungen: Übersicht')).toBeInTheDocument()
    fireEvent.click(weiter())
    await screen.findByRole('table', { name: 'Vorschau Leitfäden' })
    fireEvent.click(weiter())
    await screen.findByText('Leitfäden neu')
    expect(rpcAufrufe(rpc, 'import_templates')[0]?.['p_rows']).toEqual([
      {
        legacy_phase: 1,
        legacy_order: 1,
        name: 'Gesprächseröffnung (V1)',
        when_to_use: 'Erste Nachricht',
        body: 'Hallo Herr [Nachname]',
        notes: null,
      },
      { legacy_phase: 1, legacy_order: 2, name: 'Gesprächseröffnung (V2)', when_to_use: null, body: '', notes: null },
    ])
  })

  it('Tastatur: Enter = weiter, Esc = zurück (nicht in Feldern/Buttons)', async () => {
    rendern()
    preset('Allgemein')
    upload(datei(CSV, 'leads.csv'))
    await screen.findByRole('table', { name: 'Spaltenzuordnung' })
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.getByRole('list', { name: 'Schritte' })).toHaveTextContent('1Quelle'))
    expect(screen.getByText(/leads\.csv/)).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'Enter' })
    await screen.findByRole('table', { name: 'Spaltenzuordnung' })
    const select = screen.getByLabelText('Zielfeld für Umsatz')
    select.focus()
    fireEvent.keyDown(select, { key: 'Enter' })
    expect(screen.getByRole('table', { name: 'Spaltenzuordnung' })).toBeInTheDocument()
    expect(rpcAufrufe(rpc, 'import_leads')).toHaveLength(0)
  })

  it('< 768 px: „Am Desktop bearbeiten“ mit Schnellimport-Button', () => {
    const alt = window.matchMedia
    window.matchMedia = ((q: string) => ({
      ...alt(q),
      matches: /max-width: 767px/.test(q),
    })) as typeof window.matchMedia
    try {
      rendern()
      expect(screen.getByRole('heading', { name: 'Am Desktop bearbeiten.' })).toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Schritte' })).not.toBeInTheDocument()
    } finally {
      window.matchMedia = alt
    }
  })
})
