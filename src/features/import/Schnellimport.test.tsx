// Schnellimport (I-07, I-09, I-11, I-14): Parser → Chips, Dry-Run nach 500 ms, Anrede-Pflicht, Tasten, Übernehmen, Modus vernetzt, Entwurf.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/data/supabase', async () => {
  const { supabaseAntworten } = await import('./_testHilfe')
  return supabaseAntworten((t) =>
    t === 'leads' ? { data: [{ id: 'l1' }, { id: 'l2' }], error: null, count: 2 } : null,
  )
})
vi.mock('@/features/auth/authStore', () => ({
  useAuth: (sel: (s: { status: string; member: { user_id: string } }) => unknown) =>
    sel({ status: 'mitglied', member: { user_id: '00000000-0000-4000-8000-000000000001' } }),
}))

import { useUiStore } from '@/app/uiStore'
import { supabase } from '@/data/supabase'
import { MEMBER_V, rendernMitRouter, rpcAntworten, rpcAufrufe } from './_testHilfe'
import { Component, ENTWURF_KEY, sendbar, zeileZuRow } from './SchnellimportSeite'
import { parseSchnellimport } from './parser/schnellimport'

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>

const LISTE = `| Name | Position | Unternehmen | Ort | LinkedIn |
|---|---|---|---|---|
| Max Mustermann | Geschäftsführer | Sonnenkraft GmbH | Hamburg | https://www.linkedin.com/in/max-mustermann/ |
| Frau Eva Lang | Kundenbetreuung | Sonnenfeld Solar Rostock & MV | Rostock | https://www.linkedin.com/in/eva-lang/ |
| Sven Ott | Projektleiter | Ott & Co KG | Kiel | https://www.linkedin.com/company/ott-co |
| Ole Brandt | | Brandt Energie | | https://www.linkedin.com/sales/lead/ACwAAAbc123 |
| Lisa Krause | | Krause PV | | unbekannt |`

type Row = Record<string, unknown>
function serverAntwort(rows: Row[], dry: boolean) {
  const status = (r: Row) => {
    if (r['linkedin_url'] === 'https://www.linkedin.com/in/max-mustermann/') return 'duplikat'
    if (r['linkedin_url'] === 'https://www.linkedin.com/in/eva-lang/') return 'neu'
    if (r['first_name'] === 'Lisa') return 'archiv'
    return 'neu'
  }
  const out = rows.map((r) => ({
    status: status(r),
    name: `${r['first_name'] ?? ''} ${r['last_name'] ?? ''}`.trim(),
    company: r['company'] ?? null,
    linkedin_url_norm: null,
    existing_id: status(r) === 'duplikat' ? 'l0' : null,
    existing_stage: status(r) === 'duplikat' ? 'gespraech_eroeffnet' : null,
    existing_owner: status(r) === 'duplikat' ? MEMBER_V : null,
  }))
  return {
    batch_id: dry ? null : 'batch-1',
    dry_run: dry,
    inserted: out.filter((r) => r.status === 'neu').length,
    updated: out.filter((r) => r.status === 'duplikat').length,
    skipped: out.filter((r) => r.status === 'archiv').length,
    blocked: 0,
    invalid: 0,
    rows: out,
  }
}

function rendern(start = '/import/schnell?zurueck=%2Fheute') {
  return rendernMitRouter(Component, start, '/import/schnell')
}
const textarea = () => screen.getByLabelText('Liste') as HTMLTextAreaElement
const uebernehmen = () => screen.getByRole('button', { name: /Übernehmen/ })

describe('Schnellimport', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    rpc.mockReset()
    rpcAntworten(rpc, (name, args) => {
      if (name === 'import_leads') return serverAntwort(args['p_rows'] as Row[], !!args['p_dry_run'])
      if (name === 'mark_accepted') return { id: 'conn', status: 'angenommen' }
      if (name === 'undo_import') return { batch_id: 'batch-1', deleted_leads: 2 }
      return null
    })
  })
  afterEach(() => vi.useRealTimers())

  it('zeigt den Leerzustand mit Prompt-Vorlage und setzt den Scope formular', () => {
    rendern()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Nichts erkannt.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prompt-Vorlage kopieren' })).toBeInTheDocument()
    expect(useUiStore.getState().hotkeyScope).toBe('formular')
    expect(uebernehmen()).toBeDisabled()
  })

  it('I-07: parst die Liste live und zeigt je Zeile den lokalen Chip, nach dem Dry-Run die Server-Chips', async () => {
    rendern()
    fireEvent.change(textarea(), { target: { value: LISTE } })
    const grid = screen.getByRole('grid', { name: 'Erkannte Zeilen' })
    expect(within(grid).getAllByRole('row')).toHaveLength(6) // Kopf + 5
    expect(within(grid).getByText('Firmenseite')).toBeInTheDocument()
    expect(within(grid).getByText('Sales-Nav')).toBeInTheDocument()
    expect(within(grid).getByText('Unvollständig')).toBeInTheDocument()
    expect(rpcAufrufe(rpc, 'import_leads')).toHaveLength(0)
    // Zwei Zeilen je Eintrag: Name oben, Unternehmen · Position · Ort darunter mit vollem Text im title (326-px-Spalte)
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Name · Unternehmen', 'Status · Anrede'])
    const eva = within(grid).getByTitle('Sonnenfeld Solar Rostock & MV · Kundenbetreuung · Rostock')
    expect(eva).toHaveTextContent('Sonnenfeld Solar Rostock & MV · Kundenbetreuung · Rostock')
    await within(grid).findByText('Firma gesperrt') // Firmen-Query (useCompanies) ist asynchron
    await waitFor(() => expect(rpcAufrufe(rpc, 'import_leads')).toHaveLength(1), { timeout: 2000 })
    const dry = rpcAufrufe(rpc, 'import_leads')[0]
    expect(dry).toMatchObject({ p_dry_run: true, p_source: 'schnellimport', p_owner: MEMBER_V })
    expect(String(dry?.['p_label'])).toMatch(/^ChatGPT · \d{2}\.\d{2}\.\d{4}$/)
    await waitFor(() => expect(within(grid).getByText('Dublette')).toBeInTheDocument())
    expect(within(grid).getByText('Archiv')).toBeInTheDocument()
    expect(within(grid).getByText('Eröffnet')).toBeInTheDocument() // Phase der Dublette
  })

  it('I-09: Übernehmen ist ohne Anrede gesperrt; H/F/– auf der markierten Zeile und ⌘↵ importieren', async () => {
    const { router } = rendern()
    fireEvent.change(textarea(), { target: { value: LISTE } })
    await waitFor(() => expect(rpcAufrufe(rpc, 'import_leads')).toHaveLength(1), { timeout: 2000 })
    await waitFor(() => expect(screen.getByText('Dublette')).toBeInTheDocument())
    expect(uebernehmen()).toBeDisabled()
    expect(screen.getByText(/ohne Anrede/)).toBeInTheDocument()
    // Eva hat „Frau“ aus dem Text; Sven, Ole und Lisa? Lisa ist Archiv → keine Pflicht. Max ist Dublette → keine Pflicht.
    textarea().blur()
    const zeilen = screen.getAllByRole('row').slice(1)
    expect(zeilen[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    fireEvent.keyDown(document.body, { key: 'h' })
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    fireEvent.keyDown(document.body, { key: '-' })
    await waitFor(() => expect(uebernehmen()).toBeEnabled())
    const segSven = screen.getByRole('group', { name: 'Anrede Sven Ott' })
    expect(within(segSven).getByRole('button', { name: 'H' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(document.body, { key: 'Enter', metaKey: true })
    await waitFor(() => expect(rpcAufrufe(rpc, 'import_leads')).toHaveLength(2), { timeout: 2000 })
    const echt = rpcAufrufe(rpc, 'import_leads')[1]
    expect(echt?.['p_dry_run']).toBe(false)
    const rows = echt?.['p_rows'] as Row[]
    expect(rows.map((r) => r['salutation'])).toEqual([undefined, 'frau', 'herr', 'neutral', undefined])
    expect(rows[1]).toMatchObject({
      first_name: 'Eva',
      last_name: 'Lang',
      company: 'Sonnenfeld Solar Rostock & MV',
      role_title: 'Kundenbetreuung',
      city: 'Rostock',
    })
    // 17.10.2026: nach dem Import direkt die neuen Leads (Leadliste, gefiltert auf den Import)
    await waitFor(() => expect(router.state.location.pathname).toBe('/leads'))
    expect(router.state.location.search).toBe('?quelle=batch-1')
    expect(localStorage.getItem(ENTWURF_KEY)).toBeNull()
    expect(rpcAufrufe(rpc, 'mark_accepted')).toHaveLength(0)
  })

  it('I-14: Modus „bereits vernetzt“ ruft mark_accepted je angelegtem Lead', async () => {
    rendern('/import/schnell?zurueck=%2Fheute&modus=vernetzt')
    const seg = screen.getByRole('group', { name: 'Ziel-Modus' })
    expect(within(seg).getByRole('button', { name: 'Bereits vernetzt' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(textarea(), {
      target: { value: '1. Frau Eva Lang – Kundenbetreuung – https://www.linkedin.com/in/eva-lang/' },
    })
    await waitFor(() => expect(rpcAufrufe(rpc, 'import_leads')).toHaveLength(1), { timeout: 2000 })
    await waitFor(() => expect(uebernehmen()).toBeEnabled())
    fireEvent.click(uebernehmen())
    await waitFor(() => expect(rpcAufrufe(rpc, 'mark_accepted')).toHaveLength(2), { timeout: 2000 })
    expect(rpcAufrufe(rpc, 'mark_accepted')[0]).toMatchObject({ p_lead_id: 'l1', p_member_id: MEMBER_V })
    expect(String(rpcAufrufe(rpc, 'mark_accepted')[0]?.['p_date'])).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('Telefonliste (Nummer, kein Profil): Ziel-Modus „Anrufliste“ automatisch, Nummer geht an den Server, kein mark_accepted', async () => {
    const { router } = rendern()
    fireEvent.change(textarea(), {
      target: {
        value:
          'Anrede;Vorname;Nachname;Unternehmen;Telefon\nHerr;Max;Beispiel;Beispiel Solar GmbH;040 123456\nFrau;Anna;Muster;Muster Energie GmbH;+49 30 9876543',
      },
    })
    const seg = screen.getByRole('group', { name: 'Ziel-Modus' })
    expect(within(seg).getByRole('button', { name: 'Anrufliste' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/stehen sofort in deiner Anrufliste/)).toBeInTheDocument()
    await waitFor(() => expect(rpcAufrufe(rpc, 'import_leads')).toHaveLength(1), { timeout: 2000 })
    await waitFor(() => expect(uebernehmen()).toBeEnabled())
    fireEvent.click(uebernehmen())
    await waitFor(() => expect(rpcAufrufe(rpc, 'import_leads')).toHaveLength(2), { timeout: 2000 })
    const rows = rpcAufrufe(rpc, 'import_leads')[1]?.['p_rows'] as Row[]
    expect(rows.map((r) => r['phone'])).toEqual(['040 123456', '+49 30 9876543'])
    await waitFor(() => expect(router.state.location.pathname).toBe('/leads'))
    expect(rpcAufrufe(rpc, 'mark_accepted')).toHaveLength(0)
  })

  it('⌫ entfernt die markierte Zeile; Esc bricht ab und behält den Entwurf', async () => {
    const { router } = rendern()
    fireEvent.change(textarea(), {
      target: {
        value:
          '- Max Mustermann – Sonnenkraft GmbH – https://www.linkedin.com/in/max-mustermann/\n- Eva Lang – https://www.linkedin.com/in/eva-lang/',
      },
    })
    expect(screen.getAllByRole('row')).toHaveLength(3)
    textarea().blur()
    fireEvent.keyDown(document.body, { key: 'Backspace' })
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.queryByText('Max Mustermann')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/heute'))
    const entwurf = JSON.parse(localStorage.getItem(ENTWURF_KEY) ?? '{}') as { text: string; entfernt: number[] }
    expect(entwurf.text).toContain('Eva Lang')
    expect(entwurf.entfernt).toEqual([1])
  })

  it('lädt den Entwurf aus localStorage und bietet Anrede-Vorschläge nur auf Klick an', async () => {
    localStorage.setItem(
      ENTWURF_KEY,
      JSON.stringify({
        text: '- Max Mustermann – https://www.linkedin.com/in/max-m/',
        anreden: {},
        modus: 'anfrage',
        entfernt: [],
      }),
    )
    rpcAntworten(rpc, (name, args) =>
      name === 'import_leads'
        ? {
            ...serverAntwort(args['p_rows'] as Row[], true),
            rows: [
              {
                status: 'neu',
                name: 'Max Mustermann',
                company: null,
                linkedin_url_norm: 'linkedin.com/in/max-m',
                existing_id: null,
                existing_stage: null,
                existing_owner: null,
              },
            ],
            updated: 0,
          }
        : null,
    )
    rendern()
    expect(textarea().value).toContain('Max Mustermann')
    expect(screen.getByText('H?')).toBeInTheDocument() // Vorschlag, nicht gesetzt
    expect(uebernehmen()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Vorschläge übernehmen' }))
    await waitFor(() => expect(uebernehmen()).toBeEnabled())
    expect(screen.queryByText('H?')).not.toBeInTheDocument()
  })

  it('Hilfsfunktionen: sendbar und zeileZuRow', () => {
    const { zeilen } = parseSchnellimport(LISTE)
    expect(zeilen.map(sendbar)).toEqual([true, true, true, true, true])
    const z = zeilen[1]
    if (!z) throw new Error('keine Zeile')
    expect(zeileZuRow(z, 'frau')).toEqual({
      first_name: 'Eva',
      last_name: 'Lang',
      salutation: 'frau',
      company: 'Sonnenfeld Solar Rostock & MV',
      role_title: 'Kundenbetreuung',
      linkedin_url: 'https://www.linkedin.com/in/eva-lang/',
      city: 'Rostock',
    })
    // § 6.3 Beispiel 1: der akademische Titel geht als `title` an import_leads (Review: vorher verloren)
    const dr = parseSchnellimport('Dr. Anna Beispiel – Geschäftsführerin – https://www.linkedin.com/in/anna-beispiel/')
      .zeilen[0]
    if (!dr) throw new Error('keine Zeile')
    expect(zeileZuRow(dr, 'frau')).toMatchObject({ title: 'Dr.', first_name: 'Anna', last_name: 'Beispiel' })
    const dub = parseSchnellimport('a – https://www.linkedin.com/in/x/\nb – https://www.linkedin.com/in/x/').zeilen
    expect(dub.map(sendbar)).toEqual([true, false])
    act(() => {})
  })
})
