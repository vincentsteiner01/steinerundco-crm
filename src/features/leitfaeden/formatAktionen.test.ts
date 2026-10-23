import { describe, expect, it } from 'vitest'
import { formatLoeschen, umschliessen, zeilenPraefix } from './formatAktionen'
import { bereichAusParam, kartenVon, kategorienFuer, zielOptionen } from './kategorien'
import type { Template } from '@/types/domain'

describe('umschliessen', () => {
  it('Auswahl fett machen und wieder lösen', () => {
    const r = umschliessen('Hallo Welt', 6, 10, '**')
    expect(r.text).toBe('Hallo **Welt**')
    expect(r.text.slice(r.start, r.ende)).toBe('Welt')
    const zurueck = umschliessen(r.text, r.start, r.ende, '**')
    expect(zurueck.text).toBe('Hallo Welt')
  })

  it('ohne Auswahl: Marker-Paar, Cursor dazwischen', () => {
    const r = umschliessen('Hallo ', 6, 6, '==')
    expect(r.text).toBe('Hallo ====')
    expect(r.start).toBe(8)
  })
})

describe('zeilenPraefix', () => {
  it('Liste und nummerierte Liste über mehrere Zeilen, ersetzt anderes Präfix', () => {
    const t = 'eins\nzwei\n\ndrei'
    expect(zeilenPraefix(t, 0, t.length, 'liste').text).toBe('- eins\n- zwei\n\n- drei')
    expect(zeilenPraefix('- eins\n- zwei', 0, 13, 'nummern').text).toBe('1. eins\n2. zwei')
  })

  it('zweiter Klick entfernt', () => {
    expect(zeilenPraefix('# Titel', 2, 2, 'ueberschrift').text).toBe('Titel')
    expect(zeilenPraefix('Ja', 0, 0, 'kunde').text).toBe('> Ja')
  })
})

describe('formatLoeschen', () => {
  it('Auswahl → nur diese Zeilen; ohne Auswahl → alles', () => {
    expect(formatLoeschen('**a**\n> b', 0, 3).text).toBe('a\n> b')
    expect(formatLoeschen('**a**\n> b\n- c', 0, 0).text).toBe('a\nb\nc')
  })
})

describe('Kategorien', () => {
  it('Telefon & Sales = Mikes Kategorien; ?kanal= → Bereich', () => {
    expect(kategorienFuer('telefon').map((k) => k.label)).toEqual([
      'Telefonakquise',
      'Erstgespräch',
      'Strategiegespräch',
      'Einwandbehandlung',
      'Angebot & Abschluss',
    ])
    expect(kategorienFuer('linkedin')[1]?.label).toBe('Gesprächseröffnung')
    expect(bereichAusParam('sonstiges')).toBe('telefon')
    expect(bereichAusParam(null)).toBe('linkedin')
  })

  it('Karten: aktive zuerst, dann Phase und Reihenfolge', () => {
    const t = (name: string, phase: string, active: boolean, sort_order: number) =>
      ({ id: name, name, channel: 'telefon', phase, active, sort_order }) as unknown as Template
    const k = kategorienFuer('telefon')[0]!
    const r = kartenVon(
      [t('Mailbox', 'mailbox', true, 1), t('Alt', 'gatekeeper', false, 0), t('Zentrale', 'gatekeeper', true, 5)],
      k,
    )
    expect(r.map((x) => x.name)).toEqual(['Zentrale', 'Mailbox', 'Alt'])
  })

  it('Editor-Ziele: Telefonakquise je Phase, Sales je Kategorie', () => {
    const z = zielOptionen('telefon')
    expect(z[0]).toEqual({ value: 'telefon:gatekeeper', label: 'Telefonakquise · Zentrale' })
    expect(z.find((x) => x.value === 'sonstiges:erstgespraech')?.label).toBe('Erstgespräch')
  })
})
