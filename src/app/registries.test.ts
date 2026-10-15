// Integration M1–M8: Registries der Palette (app/befehle.ts) und der `?`-Liste (app/tasten.ts) sind konsistent –
// eindeutige IDs, deutsche Labels ohne Tippfehler-Muster, keine verbotenen Tasten (zusätzlich zu keyboard.verboten.test.ts).
import { describe, expect, it } from 'vitest'
import { anzeigeNachBinding, normalisiere, VERBOTEN } from '@/lib/keyboard'
import { BEFEHLE, type Befehl } from './befehle'
import { TASTEN } from './tasten'

describe('Befehls-Registry', () => {
  it('jede Befehl-ID ist eindeutig', () => {
    const ids = BEFEHLE.map((b) => b.id)
    const doppelt = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(doppelt).toEqual([])
  })
  it('auf jeder Seite ist jedes sichtbare Label je Gruppe eindeutig', () => {
    const ctx = { navigate: () => {}, leadId: 'l1', me: {} } as unknown as Parameters<
      NonNullable<Befehl['sichtbar']>
    >[0]
    for (const pfad of ['/heute', '/leads', '/pipeline', '/telefon', '/email', '/kpis', '/leitfaeden', '/import']) {
      window.history.pushState({}, '', pfad)
      const sichtbar = BEFEHLE.filter((b) => !b.sichtbar || b.sichtbar(ctx)).map((b) => `${b.gruppe}:${b.label}`)
      expect(
        sichtbar.filter((k, i) => sichtbar.indexOf(k) !== i),
        pfad,
      ).toEqual([])
    }
    window.history.pushState({}, '', '/')
  })
  it('Labels typografisch sauber', () => {
    for (const b of BEFEHLE) {
      expect(b.label, b.id).not.toMatch(/["']|\.\.\.|!$| - /)
      expect(['aktionen', 'seiten']).toContain(b.gruppe)
    }
  })
  it('keine verbotene Taste in Befehlen', () => {
    for (const b of BEFEHLE)
      for (const t of b.tasten ?? [])
        expect(VERBOTEN, `${b.id}: ${t}`).not.toContain(normalisiere(anzeigeNachBinding(t)))
  })
})

describe('Tasten-Registry', () => {
  it('jede Gruppe hat Einträge mit Taste und Beschreibung, Gruppennamen eindeutig', () => {
    const namen = TASTEN.map((g) => g.gruppe)
    expect(namen.filter((n, i) => namen.indexOf(n) !== i)).toEqual([])
    for (const g of TASTEN) {
      expect(g.eintraege.length, g.gruppe).toBeGreaterThan(0)
      for (const e of g.eintraege) {
        expect(e.tasten.length, `${g.gruppe}: ${e.beschreibung}`).toBeGreaterThan(0)
        expect(e.beschreibung.trim(), g.gruppe).not.toBe('')
        expect(e.beschreibung, g.gruppe).not.toMatch(/["']|\.\.\.| - /)
      }
    }
  })
  it('innerhalb einer Gruppe hat jede Taste genau eine Bedeutung', () => {
    for (const g of TASTEN) {
      const tasten = g.eintraege.flatMap((e) => e.tasten)
      expect(
        tasten.filter((t, i) => tasten.indexOf(t) !== i),
        g.gruppe,
      ).toEqual([])
    }
  })
})
