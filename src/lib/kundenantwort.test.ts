import { describe, expect, it } from 'vitest'
import { istKundenPause, kundenantwortUmschalten, kundenZeile, ohneKundenMarker } from './kundenantwort'

describe('kundenZeile', () => {
  it('erkennt „>“ mit und ohne Leerzeichen', () => {
    expect(kundenZeile('> Antwort abwarten.')).toEqual({ kunde: true, text: 'Antwort abwarten.' })
    expect(kundenZeile('>Wenn Ja')).toEqual({ kunde: true, text: 'Wenn Ja' })
    expect(kundenZeile('Hallo > da')).toEqual({ kunde: false, text: 'Hallo > da' })
  })
})

describe('ohneKundenMarker', () => {
  it('entfernt nur Marker am Zeilenanfang', () => {
    expect(ohneKundenMarker('Frage?\n> Antwort abwarten.\nWeiter > hier')).toBe(
      'Frage?\nAntwort abwarten.\nWeiter > hier',
    )
  })
})

describe('istKundenPause', () => {
  it('[…] und [...]', () => {
    expect(istKundenPause('…')).toBe(true)
    expect(istKundenPause('...')).toBe(true)
    expect(istKundenPause('Nachname')).toBe(false)
  })
})

describe('kundenantwortUmschalten', () => {
  const text = 'Frage?\n\nAntwort abwarten.\nWeiter.'

  it('markiert die Zeile unter dem Cursor', () => {
    const pos = text.indexOf('abwarten')
    const r = kundenantwortUmschalten(text, pos, pos)
    expect(r.text).toBe('Frage?\n\n> Antwort abwarten.\nWeiter.')
    expect(r.text.slice(r.start, r.ende)).toBe('> Antwort abwarten.')
  })

  it('entfernt den Marker, wenn alle berührten Zeilen markiert sind', () => {
    const t = 'Frage?\n> Ja\n> Nein'
    const r = kundenantwortUmschalten(t, t.indexOf('Ja'), t.length)
    expect(r.text).toBe('Frage?\nJa\nNein')
  })

  it('markiert gemischte Auswahl vollständig und lässt Leerzeilen in Ruhe', () => {
    const t = 'A\n\n> B\nC'
    const r = kundenantwortUmschalten(t, 0, t.length)
    expect(r.text).toBe('> A\n\n> B\n> C')
  })

  it('nimmt die nächste Zeile nicht mit, wenn die Auswahl am Zeilenumbruch endet', () => {
    const t = 'A\nB'
    const r = kundenantwortUmschalten(t, 0, 2)
    expect(r.text).toBe('> A\nB')
  })
})
