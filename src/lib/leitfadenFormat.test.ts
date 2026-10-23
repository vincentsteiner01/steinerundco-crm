import { describe, expect, it } from 'vitest'
import { auszug, bloecke, inline, ohneFormat } from './leitfadenFormat'

describe('inline', () => {
  it('fett, kursiv, unterstrichen, markiert', () => {
    expect(inline('Das ist **wichtig**, *leise*, __klar__ und ==neu==.')).toEqual([
      { art: 'text', text: 'Das ist ' },
      { art: 'fett', text: 'wichtig' },
      { art: 'text', text: ', ' },
      { art: 'kursiv', text: 'leise' },
      { art: 'text', text: ', ' },
      { art: 'unter', text: 'klar' },
      { art: 'text', text: ' und ' },
      { art: 'mark', text: 'neu' },
      { art: 'text', text: '.' },
    ])
  })

  it('ein einzelnes Sternchen bleibt Text („[Anzahl]* Anlagen“)', () => {
    expect(inline('mit [Anzahl]* Anlagen')).toEqual([{ art: 'text', text: 'mit [Anzahl]* Anlagen' }])
  })
})

describe('bloecke', () => {
  it('Absätze, Kundenantwort, Überschrift, Listen', () => {
    const b = bloecke(
      '# Einstieg\nHallo hier ist Mike.\nSpreche ich mit X?\n\n> Antwort abwarten.\n\nA: eins\n- Punkt 1\n- Punkt 2\n1. erst\n2. dann',
    )
    expect(b).toEqual([
      { art: 'ueberschrift', text: 'Einstieg' },
      { art: 'absatz', zeilen: ['Hallo hier ist Mike.', 'Spreche ich mit X?'] },
      { art: 'kunde', zeilen: ['Antwort abwarten.'] },
      { art: 'absatz', zeilen: ['A: eins'] },
      { art: 'liste', punkte: ['Punkt 1', 'Punkt 2'] },
      { art: 'nummern', punkte: ['erst', 'dann'] },
    ])
  })

  it('Leerzeile trennt zwei Kundenantworten', () => {
    expect(bloecke('> Ja\n\n> Ja')).toEqual([
      { art: 'kunde', zeilen: ['Ja'] },
      { art: 'kunde', zeilen: ['Ja'] },
    ])
    expect(bloecke('> Wenn Nein\n> (kurz warten)')).toEqual([{ art: 'kunde', zeilen: ['Wenn Nein', '(kurz warten)'] }])
  })
})

describe('ohneFormat / auszug', () => {
  it('entfernt Auszeichnung, lässt Text und Listen stehen', () => {
    expect(ohneFormat('# Titel\n**Hallo** [Vorname] :)\n> Ja\n- Punkt')).toBe('Titel\nHallo [Vorname] :)\nJa\n- Punkt')
  })

  it('auszug kürzt und zieht Zeilen zusammen', () => {
    expect(auszug('Zeile **eins**\n\n> Antwort\nZeile drei', 200)).toBe('Zeile eins Antwort Zeile drei')
    expect(auszug('x'.repeat(50), 10)).toBe('xxxxxxxxx…')
  })
})
