// Eingang – reine Logik: Filter Person/Status, Zähler, Script-Zustand (48-h-Regel), Zeitangaben.
import { describe, expect, it } from 'vitest'
import {
  filtere,
  istEinladungVomLead,
  istOffen,
  scriptZustand,
  seitText,
  STATUS_TON,
  zaehle,
  type EingangZeile,
} from './logik'

const V = 'v'
const M = 'm'
const z = (status: string, member_id: string, extra: Partial<EingangZeile> = {}) => ({ status, member_id, ...extra })

describe('Eingang-Logik', () => {
  const zeilen = [
    z('neu', V),
    z('unbekannt', V),
    z('fehler', M),
    z('verarbeitet', V),
    z('ignoriert', M),
    z('verarbeitet', M),
  ]

  it('offen = neu · unbekannt · fehler; verarbeitet/ignoriert sind abgeschlossen', () => {
    expect(zeilen.filter(istOffen).map((x) => x.status)).toEqual(['neu', 'unbekannt', 'fehler'])
  })

  it('filtert nach Person und Status', () => {
    expect(filtere(zeilen, null, 'offen')).toHaveLength(3)
    expect(filtere(zeilen, V, 'offen')).toHaveLength(2)
    expect(filtere(zeilen, M, 'alle')).toHaveLength(3)
    expect(filtere(zeilen, null, 'verarbeitet')).toHaveLength(2)
    expect(filtere(zeilen, M, 'unbekannt')).toHaveLength(0)
  })

  it('zählt je Status, offen und alle', () => {
    expect(zaehle(zeilen)).toEqual({
      neu: 1,
      verarbeitet: 2,
      unbekannt: 1,
      ignoriert: 1,
      fehler: 1,
      offen: 3,
      alle: 6,
    })
  })

  it('Einladung eines Leads ist nur „neu“ mit Lead', () => {
    expect(istEinladungVomLead({ status: 'neu', art: 'einladung', lead_id: 'l1' })).toBe(true)
    expect(istEinladungVomLead({ status: 'neu', art: 'einladung', lead_id: null })).toBe(false)
    expect(istEinladungVomLead({ status: 'neu', art: 'nachricht', lead_id: 'l1' })).toBe(false)
  })

  it('Töne: Fehler rot, unbekannt Lime (heute zu tun), nie Sage', () => {
    expect(STATUS_TON.fehler).toBe('danger')
    expect(STATUS_TON.unbekannt).toBe('today')
    expect(Object.values(STATUS_TON)).not.toContain('done')
  })

  it('seitText: Minuten, Stunden, Tage mit geschütztem Leerzeichen', () => {
    const jetzt = new Date('2026-10-15T12:00:00Z')
    expect(seitText('2026-10-15T11:59:40Z', jetzt)).toBe('gerade eben')
    expect(seitText('2026-10-15T11:57:00Z', jetzt)).toBe('vor 3 Min.')
    expect(seitText('2026-10-15T09:00:00Z', jetzt)).toBe('vor 3 Std.')
    expect(seitText('2026-10-14T11:00:00Z', jetzt)).toBe('vor 1 Tag')
    expect(seitText('2026-10-11T12:00:00Z', jetzt)).toBe('vor 4 Tagen')
  })

  it('Script-Zustand: ohne Schlüssel aus, ohne Meldung wartet, < 48 h aktiv, ab 48 h still', () => {
    const jetzt = new Date('2026-10-15T12:00:00Z')
    expect(scriptZustand(null, jetzt).art).toBe('aus')
    const s = { created_at: '2026-10-15T08:00:00Z', label: null }
    expect(scriptZustand({ ...s, last_used_at: null }, jetzt).art).toBe('wartet')
    const aktiv = scriptZustand({ ...s, last_used_at: '2026-10-14T20:00:00Z' }, jetzt)
    expect(aktiv).toEqual({ art: 'aktiv', text: 'Läuft – zuletzt übertragen vor 16 Std.' })
    expect(scriptZustand({ ...s, last_used_at: '2026-10-13T11:00:00Z' }, jetzt).art).toBe('still')
  })
})
