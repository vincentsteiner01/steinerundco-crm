// Kleine Helfer aus § 3.1.9: telefon, csv, zwischenablage.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { csvExport, csvText, csvZelle } from './csv'
import { istGueltig, nachE164, telHref, telefonTyp } from './telefon'
import { kopieren } from './zwischenablage'

describe('telefon (DE)', () => {
  it('nachE164 akzeptiert beliebige Schreibweisen', () => {
    expect(nachE164('040 123456')).toBe('+4940123456')
    expect(nachE164('+49 (0)40 / 12 34 56')).toBe('+4940123456')
    expect(nachE164('0049 171 1234567')).toBe('+491711234567')
    expect(nachE164('0171-1234567')).toBe('+491711234567')
    expect(nachE164('+41 44 668 18 00')).toBe('+41446681800')
  })
  it('unvollständig oder leer → null', () => {
    expect(nachE164('')).toBeNull()
    expect(nachE164(null)).toBeNull()
    expect(nachE164('123')).toBeNull()
    expect(nachE164('keine Nummer')).toBeNull()
    expect(istGueltig('+4940123456')).toBe(true)
    expect(istGueltig('+4940')).toBe(false)
    expect(istGueltig(null)).toBe(false)
  })
  it('Typ und tel:-Link', () => {
    expect(telefonTyp('+491711234567')).toBe('mobil')
    expect(telefonTyp('+4940123456')).toBe('unbekannt')
    expect(telHref('+49 40 123456')).toBe('tel:+4940123456')
  })
})

describe('csv (LE-14)', () => {
  type Z = { name: string; datum: string | null; wann: string; n: number; ok: boolean; liste: string[] }
  const zeilen: Z[] = [
    { name: 'Test; "Person"', datum: '2026-10-14', wann: '2026-10-16T08:00:00Z', n: 1.5, ok: true, liste: ['a', 'b'] },
    { name: '=SUMME(A1)', datum: null, wann: '2026-10-16T08:00:00Z', n: 2, ok: false, liste: [] },
  ]
  const spalten = [
    { key: 'name', label: 'Name' },
    { key: 'datum', label: 'Datum' },
    { key: 'wann', label: 'Wann' },
    { key: 'n', label: 'Zahl' },
    { key: 'ok', label: 'Aktiv' },
    { key: 'liste', label: 'Tags' },
    { key: 'x', label: 'Berechnet', wert: (z: Z) => z.n * 2 },
  ]
  it('Semikolon, CRLF, Datum DD.MM.YYYY, Dezimalkomma, Maskierung', () => {
    const text = csvText(zeilen, spalten)
    const [kopf, z1, z2, rest] = text.split('\r\n')
    expect(kopf).toBe('Name;Datum;Wann;Zahl;Aktiv;Tags;Berechnet')
    // Komma braucht bei `;`-Trennung keine Maskierung (Excel DE)
    expect(z1).toBe('"Test; ""Person""";14.10.2026;16.10.2026, 10:00;1,5;ja;a, b;3')
    expect(z2).toBe("'=SUMME(A1);;16.10.2026, 10:00;2;nein;;4")
    expect(rest).toBe('')
  })
  it('Blob mit BOM und MIME-Typ', async () => {
    const blob = csvExport(zeilen, spalten)
    expect(blob.type).toBe('text/csv;charset=utf-8')
    // jsdom entfernt die BOM in blob.text() – deshalb die Rohbytes prüfen
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes).slice(1)).toBe(csvText(zeilen, spalten))
  })
  it('csvZelle', () => {
    expect(csvZelle(null)).toBe('')
    expect(csvZelle(undefined)).toBe('')
    expect(csvZelle(new Date('2026-10-14T14:12:00Z'))).toBe('14.10.2026, 16:12')
    expect(csvZelle({ a: 1 })).toBe('{"a":1}')
    expect(csvZelle('kein Datum 2026-10')).toBe('kein Datum 2026-10')
  })
})

describe('zwischenablage (ux § 4.3)', () => {
  const original = navigator.clipboard
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: original })
  })
  it('ok über die Clipboard-API', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await expect(kopieren('Hallo')).resolves.toBe('ok')
    expect(writeText).toHaveBeenCalledWith('Hallo')
  })
  it('fallback ohne API und ohne execCommand', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    const exec = document.execCommand
    document.execCommand = undefined as unknown as typeof document.execCommand
    try {
      await expect(kopieren('Hallo')).resolves.toBe('fallback')
    } finally {
      document.execCommand = exec
    }
  })
  it('fallback, wenn die API ablehnt und execCommand fehlschlägt', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(async () => {
          throw new Error('NotAllowed')
        }),
      },
    })
    const exec = document.execCommand
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand
    try {
      await expect(kopieren('Hallo')).resolves.toBe('fallback')
      expect(document.body.querySelector('textarea')).toBeNull()
    } finally {
      document.execCommand = exec
    }
  })
})
