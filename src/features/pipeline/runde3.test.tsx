// runde3.test.tsx (QA Runde 3, echte Daten): Konversion > 100 % war als „92 %“ / „2 %“ zu lesen, 184 Karten in „Eröffnet“ wurden alle
// gerendert (virtuelle Spalte), auf dem Telefon standen vier Zeilen Bedienleiste über dem Board (Filter-Popover).
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { DB, rendern, vollerLead, zuruecksetzen } from '@/features/leads/_testHilfe'
import { Component as Pipeline } from './PipelineSeite'
import { konversionText, VIRTUELL_AB } from './logik'

vi.mock('@/data/supabase', async () => (await import('@/features/leads/_supabaseM2')).supabaseM2())

const seite = (query = '') => rendern(<Pipeline />, { route: `/pipeline${query}`, pfad: '/pipeline' })
const ort = () => screen.getByTestId('ort').textContent ?? ''
const spalte = (key: string) => document.querySelector(`[data-spalte="${key}"]`) as HTMLElement

function setzeTelefon(telefon: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: telefon && query.includes('max-width: 767px'),
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

describe('Pipeline Runde 3', () => {
  const vorher = window.matchMedia
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T10:00:00+02:00'))
    zuruecksetzen()
  })
  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: vorher })
  })

  it('konversionText rechnet immer ×100: 25 %, 2 %, über 100 % als „> 100 %“ (vorher 184 / 2 → „92 %“)', () => {
    const t = (k: number) => konversionText(k).replace(/ /g, ' ')
    expect(t(0.25)).toBe('25 %')
    expect(t(3 / 184)).toBe('2 %')
    expect(t(0)).toBe('0 %')
    expect(t(1)).toBe('100 %')
    expect(t(184 / 2)).toBe('> 100 %')
    expect(t(2)).toBe('> 100 %')
  })

  it('Spaltenkopf: Konversion über 100 % als „> 100 %“, title nennt „n von m“', async () => {
    DB.leads = [
      vollerLead(2, { full_name: 'Vera Vogel', stage: 'vernetzt' }),
      ...Array.from({ length: 5 }, (_, i) =>
        vollerLead(10 + i, { full_name: `Erik Eröffnet ${i}`, stage: 'gespraech_eroeffnet' }),
      ),
    ]
    seite()
    await screen.findByText('Vera Vogel')
    const kopf = within(spalte('eroeffnet')).getByRole('button', { expanded: true })
    expect(kopf.textContent?.replace(/ /g, ' ')).toContain('> 100 %')
    expect(within(kopf).getByTitle(/5 von 1/)).toBeInTheDocument()
  })

  it(`lange Spalte (> ${VIRTUELL_AB} Karten) rendert virtuell nur einen Ausschnitt, kurze Spalten alle Karten`, async () => {
    // jsdom kennt kein Layout: die Kartenliste bekommt eine Höhe von 600 px (wie eine Spalte im 1440er Fenster)
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute('data-karten') ? 600 : 0
      },
    })
    onTestFinished(() => {
      if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
    })
    DB.leads = [
      vollerLead(2, { full_name: 'Vera Vogel', stage: 'vernetzt' }),
      vollerLead(4, { full_name: 'Viktor Wal', stage: 'vernetzt' }),
      ...Array.from({ length: 60 }, (_, i) =>
        vollerLead(100 + i, {
          full_name: `Erik Eröffnet ${i}`,
          stage: 'gespraech_eroeffnet',
          next_action_at: `2026-10-${String(10 + (i % 5)).padStart(2, '0')}T09:00:00+02:00`,
        }),
      ),
    ]
    seite()
    await screen.findByText('Vera Vogel')
    const liste = spalte('eroeffnet').querySelector('[data-karten]') as HTMLElement
    expect(liste).toHaveAttribute('data-virtuell')
    const karten = liste.querySelectorAll('article').length
    expect(karten).toBeGreaterThan(0)
    expect(karten).toBeLessThan(60)
    // Zähler im Kopf bleibt die volle Zahl
    expect(within(spalte('eroeffnet')).getByRole('button', { expanded: true })).toHaveTextContent('60')
    const kurz = spalte('vernetzt').querySelector('[data-karten]') as HTMLElement
    expect(kurz).not.toHaveAttribute('data-virtuell')
    expect(kurz.querySelectorAll('article')).toHaveLength(2)
  })

  it('Telefon: eine Zeile Suche + „Filter“; Zuständig/Kanal/Tag im Popover, „Als Tabelle“ entfällt', async () => {
    setzeTelefon(true)
    DB.leads = [vollerLead(2, { full_name: 'Vera Vogel', stage: 'vernetzt' })]
    seite()
    await screen.findByText('Vera Vogel')
    const leiste = document.querySelector('[data-toolbar]') as HTMLElement
    expect(within(leiste).queryByRole('group', { name: 'Zuständig' })).toBeNull()
    expect(within(leiste).queryByText('Als Tabelle')).toBeNull()
    fireEvent.click(within(leiste).getByRole('button', { name: 'Filter' }))
    const zustaendig = await screen.findByRole('group', { name: 'Zuständig' })
    fireEvent.click(within(zustaendig).getByText('Ich'))
    await waitFor(() => expect(ort()).toContain('zustaendig=me'))
    // aktiver Filter zählt am Knopf
    await waitFor(() => expect(within(leiste).getByRole('button', { name: 'Filter' })).toHaveTextContent('1'))
  })

  it('Desktop: Filter stehen direkt in der Leiste, „Als Tabelle“ vorhanden', async () => {
    setzeTelefon(false)
    DB.leads = [vollerLead(2, { full_name: 'Vera Vogel', stage: 'vernetzt' })]
    seite()
    await screen.findByText('Vera Vogel')
    const leiste = document.querySelector('[data-toolbar]') as HTMLElement
    expect(within(leiste).getByRole('group', { name: 'Zuständig' })).toBeInTheDocument()
    expect(within(leiste).getByText('Als Tabelle')).toBeInTheDocument()
    expect(within(leiste).queryByRole('button', { name: 'Filter' })).toBeNull()
  })
})
