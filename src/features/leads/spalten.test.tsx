// spalten.test.tsx (BAUPLAN § 3.3): Zeitfarben, Fälligkeitsgruppen, Inline-Edit-Arten je Spalte, Chip „Firma gesperrt“ (LE-17),
// Standard-Spaltensatz (LE-01), CSV-Spalten (LE-14), Mobil-Zeile (MO-07).
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { DataTable } from '@/components/tabelle'
import { csvText } from '@/lib/csv'
import { MEMBER_M, MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import { SETTINGS } from '@/test/fixtures/settings'
import type { Member } from '@/types/domain'
import { STANDARD_SPALTEN } from './ansichten'
import {
  csvSpalten,
  faelligkeitsGruppe,
  kanalZustand,
  leadSpalten,
  mitFirmensperre,
  mobilZeile,
  naechsteAktionText,
  schrittText,
  zeitBalken,
  type Bearbeitung,
  type LeadZeile,
} from './spalten'
import { SPALTEN_LABEL, type SpaltenKey } from './spaltenKeys'

const HEUTE = '2026-10-14' // Mittwoch
const MEMBERS = [
  { id: MEMBER_V, display_name: 'Vincent Steiner', short_name: 'Vincent', initial: 'V' },
  { id: MEMBER_M, display_name: 'Mike Meier', short_name: 'Mike', initial: 'M' },
] as unknown as Member[]

const zeile = (i: number, patch: Parameters<typeof vollerLead>[1] = {}, gesperrt = false): LeadZeile =>
  mitFirmensperre(vollerLead(i, patch), gesperrt, false)

function tabelle(rows: LeadZeile[], keys: readonly SpaltenKey[], bearbeitung: Bearbeitung = null) {
  const onSave = vi.fn()
  const spalten = leadSpalten(keys, {
    heute: HEUTE,
    settings: SETTINGS,
    members: MEMBERS,
    bearbeitung,
    onSave,
    onCancel: vi.fn(),
    onTab: vi.fn(),
  })
  render(<DataTable<LeadZeile> ariaLabel="Leads" daten={rows} spalten={spalten} rowId={(r) => r.id} />)
  return { onSave }
}

describe('Zeitfarben und Fälligkeit', () => {
  it('Zeitbalken: heute Lime, überfällig Amber, später/ohne/beendet nichts', () => {
    expect(zeitBalken({ next_action_at: '2026-10-14T09:00:00+02:00', stage: 'pitch' }, HEUTE)).toBe('today')
    expect(zeitBalken({ next_action_at: '2026-10-08T09:00:00+02:00', stage: 'pitch' }, HEUTE)).toBe('overdue')
    expect(zeitBalken({ next_action_at: '2026-10-16T09:00:00+02:00', stage: 'pitch' }, HEUTE)).toBeNull()
    expect(zeitBalken({ next_action_at: null, stage: 'pitch' }, HEUTE)).toBeNull()
    expect(zeitBalken({ next_action_at: '2026-10-08T09:00:00+02:00', stage: 'beendet' }, HEUTE)).toBeNull()
  })

  it('Nächste Aktion: „Mi 08.10. −6 T“ Amber, „heute“ Lime, Rückruf mit Uhrzeit, später ink-3', () => {
    const l = (at: string | null, kind: 'rueckruf' | 'sequenz_schritt' | null = null) => ({
      next_action_at: at,
      next_action_kind: kind,
      stage: 'pitch' as const,
    })
    // relativ() setzt ein geschütztes Leerzeichen vor „T“ (TY-03)
    expect(naechsteAktionText(l('2026-10-08T09:00:00+02:00'), HEUTE)).toEqual({
      text: 'Do 08.10. −6\u00a0T',
      ton: 'overdue',
    })
    expect(naechsteAktionText(l('2026-10-14T09:00:00+02:00'), HEUTE)).toEqual({ text: 'Mi 14.10. heute', ton: 'today' })
    expect(naechsteAktionText(l('2026-10-14T10:30:00+02:00', 'rueckruf'), HEUTE)).toEqual({
      text: 'Mi 14.10. 10:30',
      ton: 'today',
    })
    expect(naechsteAktionText(l('2026-10-16T09:00:00+02:00'), HEUTE)).toEqual({ text: 'Fr 16.10.', ton: 'later' })
    expect(naechsteAktionText(l(null), HEUTE)).toEqual({ text: '–', ton: null })
  })

  it('Gruppierung Fälligkeit (LE-09): Überfällig · Heute · Diese Woche (≤ Sonntag) · Später · Ohne', () => {
    expect(faelligkeitsGruppe({ next_action_at: '2026-10-13T09:00:00+02:00' }, HEUTE)).toBe('ueberfaellig')
    expect(faelligkeitsGruppe({ next_action_at: '2026-10-14T18:00:00+02:00' }, HEUTE)).toBe('heute')
    expect(faelligkeitsGruppe({ next_action_at: '2026-10-18T09:00:00+02:00' }, HEUTE)).toBe('woche')
    expect(faelligkeitsGruppe({ next_action_at: '2026-10-19T09:00:00+02:00' }, HEUTE)).toBe('spaeter')
    expect(faelligkeitsGruppe({ next_action_at: null }, HEUTE)).toBe('ohne')
  })

  it('Schritt und Kanal-Glyphen', () => {
    expect(
      schrittText({
        next_action_kind: 'sequenz_schritt',
        next_action_label: 'Kurzfristig 2',
        next_action_at: null,
        stage: 'pitch',
      }),
    ).toBe('Kurzfristig 2')
    expect(
      schrittText({
        next_action_kind: 'rueckruf',
        next_action_label: null,
        next_action_at: '2026-10-14T10:30:00+02:00',
        stage: 'pitch',
      }),
    ).toBe('Rückruf 10:30')
    expect(
      schrittText({
        next_action_kind: 'sequenz_schritt',
        next_action_label: 'x',
        next_action_at: null,
        stage: 'beendet',
      }),
    ).toBe('–')
    const k = kanalZustand({
      linkedin_url: 'https://linkedin.com/in/x',
      phone_e164: '+4940123456',
      email: 'a@b.de',
      call_basis: null,
      email_consent_basis: 'requested_linkedin',
      stage: 'pitch',
    })
    expect(k).toEqual({ linkedin: 'aktiv', telefon: 'vorhanden', email: 'aktiv' })
  })
})

describe('Spalten der Tabelle', () => {
  beforeEach(() => useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], peekLeadId: null, peekListe: [] }))

  it('Standard-Spaltensatz in ux-Reihenfolge (LE-01)', () => {
    expect([...STANDARD_SPALTEN]).toEqual([
      'name',
      'unternehmen',
      'rolle',
      'kanal',
      'phase',
      'schritt',
      'zustaendig',
      'letzteBewegung',
      'naechsteAktion',
      'notiz',
    ])
    tabelle([zeile(1)], STANDARD_SPALTEN)
    const kopf = screen.getAllByRole('columnheader').map((h) => h.textContent?.replace(/[↑↓]/g, '').trim())
    for (const k of STANDARD_SPALTEN) expect(kopf).toContain(SPALTEN_LABEL[k])
  })

  it('Chip „Firma gesperrt“ in der Name-Zelle (LE-17) und „fehlt“ bei leerem Unternehmen', () => {
    tabelle([zeile(1, { company_name: null }, true), zeile(3)], ['name', 'unternehmen'])
    const zeilen = screen.getAllByRole('row').slice(1)
    expect(within(zeilen[0] as HTMLElement).getByText('Firma gesperrt')).toBeInTheDocument()
    expect(within(zeilen[0] as HTMLElement).getByText('fehlt')).toBeInTheDocument()
    expect(within(zeilen[1] as HTMLElement).queryByText('Firma gesperrt')).toBeNull()
  })

  it('Zeitfarbe in der Spalte Nächste Aktion', () => {
    tabelle(
      [
        zeile(1, { next_action_at: '2026-10-08T09:00:00+02:00' }),
        zeile(3, { next_action_at: '2026-10-14T09:00:00+02:00' }),
      ],
      ['name', 'naechsteAktion'],
    )
    expect(screen.getByText('Do 08.10. −6 T')).toHaveClass('text-overdue')
    expect(screen.getByText('Mi 14.10. heute')).toHaveClass('text-signal')
  })

  it.each<[SpaltenKey, string]>([
    ['name', 'textbox'],
    ['unternehmen', 'textbox'],
    ['rolle', 'combobox'],
    ['phase', 'combobox'],
    ['zustaendig', 'combobox'],
    ['notiz', 'textbox'],
    ['naechsteAktion', 'textbox'],
  ])('Inline-Edit %s → %s', (spalte, rolle) => {
    const l = zeile(1)
    tabelle([l], spalte === 'name' ? ['name'] : ['name', spalte], { rowId: l.id, spalte })
    const zelle = screen.getAllByRole('row')[1] as HTMLElement
    expect(within(zelle).getAllByRole(rolle).length).toBeGreaterThan(0)
  })

  it('Datum-Inline-Edit zeigt die Presets Heute · +3 T · +7 T · +14 T · +3 Mo (LE-06)', () => {
    const l = zeile(1)
    tabelle([l], ['name', 'naechsteAktion'], { rowId: l.id, spalte: 'naechsteAktion' })
    const presets = screen.getByRole('group', { name: 'Presets' })
    for (const p of ['Heute', '+3 T', '+7 T', '+14 T', '+3 Mo'])
      expect(within(presets).getByText(p)).toBeInTheDocument()
  })

  it('Phase-Inline-Edit bietet Beendet an (Pflichtgrund regelt LeadsSeite, LE-07)', () => {
    const l = zeile(1, { stage: 'pitch' })
    tabelle([l], ['name', 'phase'], { rowId: l.id, spalte: 'phase' })
    const select = screen.getByRole('combobox', { name: 'Phase' })
    expect(
      within(select)
        .getAllByRole('option')
        .some((o) => (o as HTMLOptionElement).value === 'beendet'),
    ).toBe(true)
  })
})

describe('CSV und Mobil', () => {
  it('CSV-Spalten = sichtbare Spalten mit Wortlaut und Datum DD.MM.YYYY (LE-14)', () => {
    const rows = [zeile(1, { next_action_at: '2026-10-16T09:00:00+02:00', owner_id: MEMBER_V })]
    const text = csvText(
      rows,
      csvSpalten(['name', 'phase', 'zustaendig', 'naechsteAktion'], {
        heute: HEUTE,
        settings: SETTINGS,
        members: MEMBERS,
      }),
    )
    const [kopf, erste] = text.replace(/^﻿/, '').split(/\r?\n/)
    expect(kopf).toBe('Name;Phase;Zuständig;Nächste Aktion')
    expect(erste).toContain('Test Person 01')
    expect(erste).toContain('Vincent')
    expect(erste).toContain('16.10.2026')
  })

  it('Mobil-Zeile: drei Zeilen mit Name, Unternehmen + Phase-Chip, Nächste Aktion (MO-07)', () => {
    render(
      <>
        {mobilZeile(
          zeile(1, { next_action_at: '2026-10-14T09:00:00+02:00' }, true),
          { heute: HEUTE, settings: SETTINGS, members: MEMBERS },
          {
            cursor: false,
            ausgewaehlt: true,
            zeit: 'today',
          },
        )}
      </>,
    )
    expect(screen.getByText('Test Person 01')).toBeInTheDocument()
    expect(screen.getByText('Solar 01 GmbH')).toBeInTheDocument()
    expect(screen.getByText('Mi 14.10. heute')).toBeInTheDocument()
    expect(screen.getByText('Firma gesperrt')).toBeInTheDocument()
    expect(screen.getByText('gewählt')).toBeInTheDocument()
  })
})
