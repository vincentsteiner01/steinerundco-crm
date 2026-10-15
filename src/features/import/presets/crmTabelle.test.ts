// Kopfzeile → Keys, Datum, #ERROR!, System-ID-Dublette (BAUPLAN § 3.8 Unit-Tests).
import { describe, expect, it } from 'vitest'
import type { Tab } from '../parser/xlsx'
import { CRM_SPALTEN, crmHinweise, crmTabelleDokument, kopfZuKeys } from './crmTabelle'

const KOPF = [
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
  'System-ID',
]

function tab(zeilen: Tab['zeilen']): Tab[] {
  return [
    { name: 'CRM', zeilen: [KOPF, ...zeilen] },
    { name: 'INFO', zeilen: [['Regeln']] },
  ]
}

describe('presets/crmTabelle', () => {
  it('Kopfzeile → snake_case-Keys (Umlaute transliteriert), zweite System-ID → system_id_2', () => {
    expect(kopfZuKeys(KOPF)).toEqual([...CRM_SPALTEN])
  })

  it('wandelt Datum (Date und DD.MM.YYYY) → ISO, Ja bleibt Ja, leer → null, int-Spalten → int', () => {
    const d = crmTabelleDokument(
      tab([
        [
          4,
          'Test Person',
          'https://www.linkedin.com/in/test-person/',
          null,
          'Solar GmbH',
          null,
          'Ja',
          '16.09.2026',
          'ja',
          new Date(2026, 8, 17),
          'Mike',
          'Mike',
          null,
          new Date(2026, 8, 30),
          1,
          null,
          null,
          'DM Follow-Up',
          'Mike',
          'LinkedIn Lead',
          '12.10.2026',
          'Zeile 1\r\nZeile 2',
          'abc',
          null,
        ],
      ]),
      'crm.xlsx',
    )
    expect(d.tab).toBe('CRM')
    expect(d.fehlend).toEqual([])
    expect(d.rows).toHaveLength(1)
    expect(d.rows[0]).toMatchObject({
      _row: 2,
      id: 4,
      vor_und_nachname: 'Test Person',
      mike_akzeptiert: 'Ja',
      vincent_anfrage_gesendet_am: '2026-09-16',
      vincent_akzeptiert: 'Ja',
      gespraechseroeffnung_am: '2026-09-17',
      letztes_dm_follow_up_am: '2026-09-30',
      dm_follow_ups_anzahl: 1,
      naechster_follow_up_am: '2026-10-12',
      notizen: 'Zeile 1\nZeile 2',
      system_id: 'abc',
      system_id_2: null,
      dm_zustaendigkeit_resolved: 'Mike',
      telefonnummer: null,
    })
    expect(d.rows[0]).not.toHaveProperty('_errors')
    const doc = d.doc as { source: { file: string; sheet_title: string; tabs: string[] }; crm: { rows: unknown[] } }
    expect(doc.source).toEqual({ file: 'crm.xlsx', sheet_title: 'CRM - Steiner & Co.', tabs: ['CRM', 'INFO'] })
    expect(doc.crm.rows).toHaveLength(1)
  })

  it('#ERROR! → _errors + dm_zustaendigkeit_resolved = Mitarbeiter; ohne Mitarbeiter → null (Pflichtauswahl)', () => {
    const z = (zust: string | null, mitarbeiter: string | null) => {
      const r = Array<null | string | number>(24).fill(null)
      r[0] = 1
      r[1] = 'Test Person'
      r[11] = zust
      r[18] = mitarbeiter
      return r
    }
    const d = crmTabelleDokument(
      tab([z('#ERROR!', 'Vincent'), z('#ERROR!', null), z('Frei', 'Mike'), z('Mike', 'Vincent')]),
      'x.xlsx',
    )
    expect(d.rows[0]).toMatchObject({
      _errors: ['dm_zustaendigkeit'],
      dm_zustaendigkeit: '#ERROR!',
      dm_zustaendigkeit_resolved: 'Vincent',
    })
    expect(d.rows[1]).toMatchObject({ _errors: ['dm_zustaendigkeit'], dm_zustaendigkeit_resolved: null })
    expect(d.rows[2]).toMatchObject({ dm_zustaendigkeit: 'Frei', dm_zustaendigkeit_resolved: 'Mike' })
    expect(d.rows[3]).toMatchObject({ dm_zustaendigkeit_resolved: 'Mike' })
    expect(crmHinweise(d.rows)).toMatchObject({
      zeilen: 4,
      mitError: 2,
      ohneZustaendig: 1,
      ohneUnternehmen: 4,
      ohneStatus: 4,
    })
  })

  it('überspringt Zeilen ohne Name und ID, meldet fehlende Spalten und zählt Hinweise', () => {
    const d = crmTabelleDokument(
      [
        {
          name: 'CRM',
          zeilen: [
            ['ID', 'Vor- und Nachname', 'Unternehmen', 'Mike: akzeptiert?', 'Vincent: akzeptiert?', 'Notizen'],
            [1, 'A B', 'X GmbH', 'Ja', 'Ja', 'NICHT ANSCHREIBEN – Partner'],
            [null, null, null, null, null, null],
            [2, 'C D', null, null, null, null],
          ],
        },
      ],
      'x.xlsx',
    )
    expect(d.rows).toHaveLength(2)
    expect(d.fehlend).toContain('linkedin_url')
    expect(d.spalten.map((s) => s.erkannt)).toEqual([true, true, true, true, true, true])
    expect(crmHinweise(d.rows)).toMatchObject({ beideAngefragt: 1, nichtAnschreiben: 1, ohneUnternehmen: 1 })
  })

  it('leere Datei → leeres Dokument', () => {
    const d = crmTabelleDokument([], 'leer.xlsx')
    expect(d.rows).toEqual([])
    expect(d.fehlend).toHaveLength(24)
  })
})
