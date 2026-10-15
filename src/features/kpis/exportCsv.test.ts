// exportCsv: Funnel-Zeilen + Tageswerte des Zeitraums in einer CSV (K-12), Dateiname, Download mit BOM.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SETTINGS } from '@/test/fixtures/settings'
import { exportiereKpis, kpisCsvText, kpisDateiname, type KpiExport } from './exportCsv'
import { ausSummen, funnelZeilen, tageswerte } from './kennzahlen'

const EXPORT: KpiExport = {
  person: 'Vincent',
  kanal: 'Alle Kanäle',
  zeitraumLabel: 'KW 42',
  von: '2026-10-12',
  bis: '2026-10-18',
  vorLabel: 'KW 41',
  zeilen: funnelZeilen(
    ausSummen({ vernetzungen_versendet: 10, vernetzungen_angenommen: 3 }),
    ausSummen({ vernetzungen_versendet: 8, vernetzungen_angenommen: 1 }),
    SETTINGS.kpi_targets,
    new Set(),
    true,
  ),
  tage: tageswerte(
    [
      {
        day: '2026-10-12',
        gespraeche_eroeffnet: 17,
        vernetzungen_versendet: 0,
        dm_beantwortet: 0,
        anrufe: 0,
        anrufe_erreicht: 0,
        emails_gesendet: 0,
      },
    ],
    '2026-10-12',
    '2026-10-18',
  ),
}

describe('exportCsv', () => {
  afterEach(() => vi.restoreAllMocks())

  it('enthält Kopf, Funnel-Zeilen und Tageswerte, `;`-getrennt mit CRLF', () => {
    const text = kpisCsvText(EXPORT)
    const zeilen = text.split('\r\n')
    expect(zeilen[0]).toBe('Person;Kanal;Zeitraum;Von;Bis;Vorperiode')
    expect(zeilen[1]).toBe('Vincent;Alle Kanäle;KW 42;12.10.2026;18.10.2026;KW 41')
    expect(zeilen[3]).toBe(
      'Nr.;Kennzahl;Wert;Konversion;Vorperiode;Konversion Vorperiode;Delta;Delta pp;Ziel;Ziel erreicht;Quelle',
    )
    expect(zeilen[4]).toBe('01;Vernetzung versendet;10;;8;;2;;;;Zähler, teilweise manuell')
    expect(zeilen[5]).toBe('02;Angenommen;3;30\u202F%;1;13\u202F%;2;17,5;25\u202F%;ja;')
    const tageKopf = zeilen.indexOf('Tag;Gespräche eröffnet;Anfragen;Antworten;Dials;Connects;E-Mails gesendet')
    expect(tageKopf).toBeGreaterThan(5)
    expect(zeilen[tageKopf + 1]).toBe('12.10.2026;17;0;0;0;0;0')
    expect(zeilen.slice(tageKopf + 1).filter(Boolean)).toHaveLength(7)
  })

  it('Dateiname und Download mit BOM', async () => {
    expect(kpisDateiname(EXPORT)).toBe('crm-kpis-vincent-2026-10-12_2026-10-18.csv')
    const blobs: Blob[] = []
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((b: Blob) => (blobs.push(b), 'blob:x')),
      revokeObjectURL: vi.fn(),
    })
    const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    exportiereKpis(EXPORT)
    expect(klick).toHaveBeenCalled()
    expect(blobs).toHaveLength(1)
    expect(blobs[0]!.type).toContain('text/csv')
    const bytes = new Uint8Array(await blobs[0]!.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]) // UTF-8-BOM (Blob.text() verschluckt ihn)
    vi.unstubAllGlobals()
  })
})
