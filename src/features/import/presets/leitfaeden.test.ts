import { describe, expect, it } from 'vitest'
import { leitfaedenDokument, phaseAusTab } from './leitfaeden'

describe('presets/leitfaeden', () => {
  it('Phase aus dem Tab-Präfix', () => {
    expect(phaseAusTab('1 Gesprächseröffnung')).toBe(1)
    expect(phaseAusTab('4 Follow-ups')).toBe(4)
    expect(phaseAusTab('Übersicht')).toBeNull()
  })

  it('Tabs 1–4: Kopfzeile wird gesucht, laufende Nummer je Tab, Zeilenumbrüche bleiben, leere Texte gezählt', () => {
    const d = leitfaedenDokument([
      { name: 'Übersicht', zeilen: [['Stufe 1', 'Problem erkennen']] },
      {
        name: '1 Gesprächseröffnung',
        zeilen: [
          ['Neue Leitfäden: einfach ergänzen.'],
          ['Leitfaden', 'Wann verwenden?', 'Nachricht – Copy & Paste', 'Notizen / Tests'],
          ['Gesprächseröffnung (V1)', 'Erste Nachricht', 'Hallo Herr [Nachname],\r\n\r\nText', null],
          [null, null, null, null],
          ['Gesprächseröffnung (V2)', null, '', 'Test ab KW 43'],
        ],
      },
      {
        name: '4 Follow-ups',
        zeilen: [
          ['Leitfaden', 'Wann verwenden?', 'Nachricht', 'Notizen'],
          ['Kurzfristig 1', 'nach 3 Tagen', 'Kurz nachgefragt …', null],
        ],
      },
    ])
    expect(d.uebersprungen).toEqual(['Übersicht'])
    expect(d.ohneText).toBe(1)
    expect(d.rows).toEqual([
      {
        legacy_phase: 1,
        legacy_order: 1,
        name: 'Gesprächseröffnung (V1)',
        when_to_use: 'Erste Nachricht',
        body: 'Hallo Herr [Nachname],\n\nText',
        notes: null,
      },
      {
        legacy_phase: 1,
        legacy_order: 2,
        name: 'Gesprächseröffnung (V2)',
        when_to_use: null,
        body: '',
        notes: 'Test ab KW 43',
      },
      {
        legacy_phase: 4,
        legacy_order: 1,
        name: 'Kurzfristig 1',
        when_to_use: 'nach 3 Tagen',
        body: 'Kurz nachgefragt …',
        notes: null,
      },
    ])
    expect(d.tabs.map((t) => [t.phase, t.kopfErkannt, t.zeilen.length])).toEqual([
      [1, true, 2],
      [4, true, 1],
    ])
  })

  it('Tab ohne erkennbare Kopfzeile liefert keine Zeilen, aber kopfErkannt = false', () => {
    const d = leitfaedenDokument([{ name: '2 Bedarfsermittlung', zeilen: [['x', 'y']] }])
    expect(d.tabs[0]).toMatchObject({ phase: 2, kopfErkannt: false, zeilen: [] })
  })
})
