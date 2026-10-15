// runde3.test.tsx (QA Runde 3, echte Daten): Telefon-Bedienleiste der Leads (360 px Steuerung vor dem ersten Lead → eine Zeile),
// Spaltensatz nach Tabellenbreite (1024: Tabelle 1040 px in 741 px), Peek-Sheet ohne doppelte Kanal-Icons im Kopf und mit
// Aktionsknöpfen, die in ihrer Rasterzelle bleiben.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DB, leadMitBezug, rendern, vollerLead, zuruecksetzen } from './_testHilfe'
import { Component as LeadsSeite } from './LeadsSeite'
import { LeadPanel, PeekKopfAktionen } from './public'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())

const seite = (query = '') => rendern(<LeadsSeite />, { route: `/leads${query}`, pfad: '/leads' })
const ort = () => screen.getByTestId('ort').textContent ?? ''

/** matchMedia: trifft für die genannten Teilstrings zu (z. B. „max-width: 767px“ = Telefon). */
function setzeMedien(...treffer: string[]) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: treffer.some((t) => query.includes(t)),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

describe('Leads Runde 3', () => {
  const vorher = window.matchMedia
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00+02:00'))
    zuruecksetzen()
    DB.leads = [
      vollerLead(1, { full_name: 'Anna Amsel', stage: 'pitch', next_action_at: '2026-10-12T09:00:00+02:00' }),
      vollerLead(3, { full_name: 'Bernd Biber', stage: 'gespraech_eroeffnet' }),
    ]
  })
  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: vorher })
  })

  it('Telefon: eine Zeile Suche · Filter · Lead anlegen – ohne Spalten, CSV, Schnellimport, Ansicht speichern', async () => {
    setzeMedien('max-width: 767px', 'max-width: 1279px')
    seite()
    await screen.findByText('Anna Amsel')
    const leiste = document.querySelector('[data-toolbar]') as HTMLElement
    expect(within(leiste).getByRole('searchbox', { name: 'Leads durchsuchen' })).toBeInTheDocument()
    expect(within(leiste).getByRole('button', { name: 'Filter' })).toBeInTheDocument()
    expect(within(leiste).getByRole('button', { name: 'Lead anlegen' })).toBeInTheDocument()
    for (const weg of ['Spalten wählen', 'Exportieren (CSV)', 'Schnellimport', 'Ansicht speichern'])
      expect(within(leiste).queryByRole('button', { name: new RegExp(weg.replace(/[()]/g, '\\$&')) })).toBeNull()
    // Kanal-Segment und Favoriten stehen nicht in der Leiste
    expect(within(leiste).queryByRole('group', { name: 'Kanal' })).toBeNull()
  })

  it('Telefon: Ansicht und Kanal im Filter-Popover, aktive Filter mit Zurücksetzen', async () => {
    setzeMedien('max-width: 767px', 'max-width: 1279px')
    seite()
    await screen.findByText('Anna Amsel')
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    const ansicht = await screen.findByRole('combobox', { name: 'Ansicht' })
    fireEvent.change(ansicht, { target: { value: 'ueberfaellig' } })
    await waitFor(() => expect(ort()).toContain('ansicht=ueberfaellig'))
    // das Popover bleibt beim Wechsel der Ansicht offen
    fireEvent.click(within(await screen.findByRole('group', { name: 'Kanal' })).getByText('Telefon'))
    await waitFor(() => expect(ort()).toContain('kanal=telefon'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Filter' })).toHaveTextContent('1'))
    const aktiv = document.querySelector('[data-aktive-filter]') as HTMLElement
    expect(aktiv).toHaveTextContent('Kanal · Telefon')
    fireEvent.click(within(aktiv).getByRole('button', { name: 'Zurücksetzen' }))
    await waitFor(() => expect(ort()).not.toContain('kanal='))
  })

  it('Spaltensatz ohne Messung nach Fensterbreite: unter 1280 schmal (Name · Phase · Schritt · Zuständig · Nächste Aktion)', async () => {
    setzeMedien('max-width: 1279px')
    seite()
    await screen.findByText('Anna Amsel')
    expect(document.querySelector('[data-stufe]')).toHaveAttribute('data-stufe', 'schmal')
    const kopf = screen.getAllByRole('columnheader').map((h) => h.textContent?.replace(/[↑↓]/g, '').trim())
    expect(kopf.filter(Boolean)).toEqual(['Name', 'Phase', 'Schritt', 'Zuständig', 'Nächste Aktion'])
  })

  it('Spaltensatz breit (≥ 1280 ohne Messung): alle Standardspalten, „Zuletzt“ statt „Letzte Bewegung“, Rolle leer → weg', async () => {
    setzeMedien()
    seite()
    await screen.findByText('Anna Amsel')
    expect(document.querySelector('[data-stufe]')).toHaveAttribute('data-stufe', 'breit')
    const kopf = screen.getAllByRole('columnheader').map((h) => h.textContent?.replace(/[↑↓]/g, '').trim())
    expect(kopf).toContain('Zuletzt')
    expect(kopf).toContain('Notiz')
    expect(kopf).toContain('Unternehmen')
  })
})

describe('Peek Runde 3', () => {
  const ID = '10000000-0000-4000-8000-000000000001'
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T10:00:00+02:00'))
    zuruecksetzen()
  })
  afterEach(() => vi.useRealTimers())

  it('Kopf-Icons LinkedIn · Anrufen · E-Mail nur ab 1024 (darunter steht die Aktionszeile), Vollansicht immer', async () => {
    DB.details = [leadMitBezug(1, { full_name: 'Anna Amsel', phone_e164: null })]
    rendern(
      <>
        <PeekKopfAktionen leadId={ID} />
        <LeadPanel leadId={ID} />
      </>,
      { route: `/leads?lead=${ID}` },
    )
    await screen.findByRole('heading', { name: 'Anna Amsel' })
    const kanaele = document.querySelector('[data-kanal-aktionen]') as HTMLElement
    expect(kanaele).toHaveClass('max-lg:hidden')
    expect(within(kanaele).getByRole('button', { name: 'Anrufen (⌘⇧K)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vollansicht (⌘↵)' }).closest('[data-kanal-aktionen]')).toBeNull()
    // Aktionszeile: Zellen min-w-0, Knöpfe füllen die Zelle (gesperrtes „Anrufen“ ragte 7 px in „LinkedIn“)
    const zeile = document.querySelector('[data-mobil-aktionen]') as HTMLElement
    expect(zeile.className).toContain('[&>*]:min-w-0')
    for (const b of within(zeile).getAllByRole('button')) expect(b).toHaveClass('w-full', 'min-w-0')
  })
})
