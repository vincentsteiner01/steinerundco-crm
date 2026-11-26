// TY-01…TY-06 (ux § 8.14): kein ", ', !, ..., --, „erfolgreich“, „OK“, „Snooze“, „Owner“ in UI-Zeichenketten aus de.ts
import { describe, expect, it } from 'vitest'
import * as de from './de'

const VERBOTEN: [RegExp, string][] = [
  [/"/, 'gerades Anführungszeichen "'],
  [/(^|[^\p{L}])'|'([^\p{L}]|$)/u, "gerades Anführungszeichen '"],
  [/!/, 'Ausrufezeichen'],
  [/\.\.\./, 'drei Punkte statt …'],
  [/--/, 'doppelter Bindestrich'],
  [/\berfolgreich\b/i, '„erfolgreich“'],
  [/\bOK\b/, '„OK“'],
  [/\bSnooze\b/i, '„Snooze“'],
  [/\bOwner\b/i, '„Owner“'],
  [/ - /, 'Bindestrich als Gedankenstrich'],
  [/\d-\d/, 'Bindestrich in Zahlenspannen (E26: „2–3“ mit Halbgeviertstrich)'],
  [/\d %/, 'normales Leerzeichen vor % (E26: U+202F)'],
]

function sammle(wert: unknown, pfad: string, acc: [string, string][]): void {
  if (typeof wert === 'string') acc.push([pfad, wert])
  else if (typeof wert === 'function') {
    const args = Array.from({ length: (wert as (...a: unknown[]) => unknown).length }, (_, i) =>
      i === 0 ? 'Muster' : i === 1 ? 'Mi 14.10.' : 3,
    )
    try {
      sammle((wert as (...a: unknown[]) => unknown)(...args), `${pfad}()`, acc)
    } catch {
      /* Funktionen mit anderen Signaturen liefern hier keinen Text */
    }
  } else if (Array.isArray(wert)) wert.forEach((w, i) => sammle(w, `${pfad}[${i}]`, acc))
  else if (wert && typeof wert === 'object')
    for (const [k, v] of Object.entries(wert as Record<string, unknown>)) sammle(v, `${pfad}.${k}`, acc)
}

describe('texte/de.ts', () => {
  const alle: [string, string][] = []
  sammle(de, 'de', alle)

  it('sammelt Zeichenketten', () => {
    expect(alle.length).toBeGreaterThan(100)
  })

  for (const [muster, name] of VERBOTEN) {
    it(`enthält kein ${name}`, () => {
      const treffer = alle.filter(([, s]) => muster.test(s)).map(([p, s]) => `${p}: ${s}`)
      expect(treffer).toEqual([])
    })
  }

  it('REAKTION_LABEL: kein_bedarf mit Note → „Nein (mit Grund)“, frage → „Rückfrage“', () => {
    expect(de.reaktionLabel('kein_bedarf', true)).toBe('Nein (mit Grund)')
    expect(de.reaktionLabel('kein_bedarf')).toBe('Nein')
    expect(de.REAKTION_LABEL.frage).toBe('Rückfrage')
    expect(de.STUFEN_LABEL.langfristig.label).toBe('Wiedervorlage')
  })
})
