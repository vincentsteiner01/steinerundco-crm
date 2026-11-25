// Board (25.11.2026): Knöpfe je Liste, Suche/Filter, Aufteilung, Lead-Blatt-Patch, Anrede aus dem Vornamen. Nur erfundene Namen.
import { describe, expect, it } from 'vitest'
import type { BoardKarte } from '@/data/board'
import { anredeAusVorname } from '@/lib/vornamen'
import { blattPatch, blattWerte, pruefeBlatt } from './blatt'
import { BOARD_LISTEN, istBoardListe, KARTEN_KNOEPFE, listenTitel, type BoardListe } from './listen'
import { ALLE, filtereKarten, kartenName, nachListen, sortiereMitglieder } from './logik'
import { darfZiehen, zielListe } from './ziehen'

const V = 'member-v'
const M = 'member-m'

function karte(id: string, liste: BoardListe, patch: Partial<BoardKarte> = {}): BoardKarte {
  return {
    id,
    salutation: 'neutral',
    first_name: 'Petra',
    last_name: 'Probelauf',
    full_name: 'Petra Probelauf',
    company_name: null,
    linkedin_url: null,
    owner_id: V,
    board_liste: liste,
    board_seit: '2026-11-25T09:00:00+00:00',
    ...patch,
  }
}

describe('Listen und Knöpfe', () => {
  it('vier Listen in der Reihenfolge des Auftrags', () => {
    expect(BOARD_LISTEN.map((l) => l.titel)).toEqual([
      'Angeschrieben',
      'Gespräch vereinbart',
      'Im Geschäft',
      'Verloren',
    ])
    expect(listenTitel('gespraech')).toBe('Gespräch vereinbart')
    expect(istBoardListe('im_geschaeft')).toBe(true)
    expect(istBoardListe('kunde')).toBe(false)
    expect(istBoardListe(null)).toBe(false)
  })

  it('Angeschrieben: grün „Hat Interesse“ → Gespräch vereinbart, rot „Kein Interesse“ → Verloren', () => {
    expect(KARTEN_KNOEPFE.angeschrieben).toEqual([
      { label: 'Hat Interesse', ziel: 'gespraech', art: 'positiv' },
      { label: 'Kein Interesse', ziel: 'verloren', art: 'negativ' },
    ])
  })

  it('Gespräch vereinbart: grün „Im Geschäft“ → Im Geschäft, rot „Kein Interesse“ → Verloren', () => {
    expect(KARTEN_KNOEPFE.gespraech).toEqual([
      { label: 'Im Geschäft', ziel: 'im_geschaeft', art: 'positiv' },
      { label: 'Kein Interesse', ziel: 'verloren', art: 'negativ' },
    ])
  })

  it('Im Geschäft und Verloren haben keine Knöpfe', () => {
    expect(KARTEN_KNOEPFE.im_geschaeft).toEqual([])
    expect(KARTEN_KNOEPFE.verloren).toEqual([])
  })
})

describe('Suche und Personen-Filter', () => {
  const karten = [
    karte('a', 'angeschrieben'),
    karte('b', 'gespraech', {
      first_name: 'Max',
      last_name: 'Müller',
      full_name: 'Max Müller',
      company_name: 'Muster Solar GmbH',
      owner_id: M,
    }),
    karte('c', 'verloren', { first_name: 'Jana', last_name: 'Kurz', full_name: 'Jana Kurz', owner_id: M }),
  ]

  it('ohne Suche und mit „Alle“ bleibt alles stehen', () => {
    expect(filtereKarten(karten, { suche: '  ', person: ALLE }).map((k) => k.id)).toEqual(['a', 'b', 'c'])
  })

  it('Suche trifft Name und Firma, Groß/Klein und Umlautpunkte egal, jedes Wort muss vorkommen', () => {
    expect(filtereKarten(karten, { suche: 'probe', person: ALLE }).map((k) => k.id)).toEqual(['a'])
    expect(filtereKarten(karten, { suche: 'MULLER', person: ALLE }).map((k) => k.id)).toEqual(['b'])
    expect(filtereKarten(karten, { suche: 'solar max', person: ALLE }).map((k) => k.id)).toEqual(['b'])
    expect(filtereKarten(karten, { suche: 'solar jana', person: ALLE })).toEqual([])
  })

  it('Personen-Filter zeigt nur die Karten einer Person, zusammen mit der Suche', () => {
    expect(filtereKarten(karten, { suche: '', person: M }).map((k) => k.id)).toEqual(['b', 'c'])
    expect(filtereKarten(karten, { suche: 'kurz', person: M }).map((k) => k.id)).toEqual(['c'])
    expect(filtereKarten(karten, { suche: 'kurz', person: V })).toEqual([])
  })

  it('Aufteilung auf die Listen behält die gelieferte Reihenfolge', () => {
    const l = nachListen([karte('neu', 'angeschrieben'), karte('alt', 'angeschrieben'), karte('x', 'im_geschaeft')])
    expect(l.angeschrieben.map((k) => k.id)).toEqual(['neu', 'alt'])
    expect(l.gespraech).toEqual([])
    expect(l.im_geschaeft.map((k) => k.id)).toEqual(['x'])
    expect(l.verloren).toEqual([])
  })

  it('Name auf der Karte: full_name, sonst Vor- und Nachname, sonst „Ohne Namen“', () => {
    expect(kartenName(karte('a', 'angeschrieben'))).toBe('Petra Probelauf')
    expect(kartenName({ full_name: null, first_name: null, last_name: 'Probelauf' })).toBe('Probelauf')
    expect(kartenName({ full_name: null, first_name: null, last_name: null })).toBe('Ohne Namen')
  })

  it('Mitglieder stehen als Vincent · Mike, auch wenn die Datenbank alphabetisch liefert', () => {
    const sortiert = sortiereMitglieder([
      { id: M, display_name: 'Mike' },
      { id: V, display_name: 'Vincent' },
    ])
    expect(sortiert.map((m) => m.display_name)).toEqual(['Vincent', 'Mike'])
    expect(sortiereMitglieder(undefined)).toEqual([])
  })
})

describe('Ziehen', () => {
  it('Ziel ist nur eine der vier Listen', () => {
    expect(zielListe({ over: { id: 'verloren' } } as Parameters<typeof zielListe>[0])).toBe('verloren')
    expect(zielListe({ over: { id: 'irgendwas' } } as Parameters<typeof zielListe>[0])).toBeNull()
    expect(zielListe({ over: null })).toBeNull()
  })

  it('Link und Knöpfe (data-kein-ziehen) starten kein Ziehen, die übrige Karte schon', () => {
    document.body.innerHTML =
      '<li><div id="flaeche"><a data-kein-ziehen><span id="im-link">x</span></a><button data-kein-ziehen id="knopf"></button></div></li>'
    expect(darfZiehen(document.getElementById('flaeche'))).toBe(true)
    expect(darfZiehen(document.getElementById('im-link'))).toBe(false)
    expect(darfZiehen(document.getElementById('knopf'))).toBe(false)
    expect(darfZiehen(null)).toBe(true)
    document.body.innerHTML = ''
  })
})

describe('Lead-Blatt: Prüfung und Patch', () => {
  const lead = {
    first_name: 'Petra',
    last_name: 'Probelauf',
    salutation: 'frau' as const,
    company_name: null,
    linkedin_url: 'https://www.linkedin.com/in/petra-probelauf/',
    owner_id: V,
    board_liste: 'angeschrieben',
    notes: null,
  }
  const basis = blattWerte(lead)

  it('ohne Änderung ist der Patch leer', () => {
    expect(blattPatch(basis, { ...basis })).toEqual({})
    expect(blattPatch(basis, { ...basis, first_name: ' Petra ', notes: '  ' })).toEqual({})
  })

  it('nur geänderte Felder, leere Texte werden null', () => {
    expect(
      blattPatch(basis, {
        ...basis,
        last_name: 'Probelauf-Muster',
        company_name: ' Muster Solar GmbH ',
        linkedin_url: '',
        owner_id: M,
        board_liste: 'gespraech',
        notes: 'Ruft Dienstag zurück',
        salutation: 'neutral',
      }),
    ).toEqual({
      last_name: 'Probelauf-Muster',
      company_name: 'Muster Solar GmbH',
      linkedin_url: null,
      owner_id: M,
      board_liste: 'gespraech',
      notes: 'Ruft Dienstag zurück',
      salutation: 'neutral',
    })
  })

  it('alter Lead ohne Liste: nichts gewählt; unbekannte Werte zählen nicht als Liste', () => {
    expect(blattWerte({ ...lead, board_liste: null }).board_liste).toBeNull()
    expect(blattWerte({ ...lead, board_liste: 'kunde' }).board_liste).toBeNull()
  })

  it('ohne Namen und Link: Fehler; ein neuer Link muss ein Profil-Link sein, ein alter bleibt unbeanstandet', () => {
    expect(pruefeBlatt(basis, { ...basis, first_name: '', last_name: '', linkedin_url: '' }).name).toBe(
      'Bitte einen Namen eingeben',
    )
    expect(
      pruefeBlatt(basis, { ...basis, linkedin_url: 'https://www.linkedin.com/company/muster-solar' }).link,
    ).toMatch(/kein LinkedIn-Profil-Link/)
    expect(pruefeBlatt(basis, { ...basis, linkedin_url: 'linkedin.com/in/petra-neu' })).toEqual({})
    const firma = blattWerte({ ...lead, linkedin_url: 'https://www.linkedin.com/company/muster-solar' })
    expect(pruefeBlatt(firma, { ...firma, notes: 'x' })).toEqual({})
  })
})

describe('Anrede aus dem Vornamen', () => {
  it('bekannte Vornamen ergeben Herr/Frau, alles andere neutral', () => {
    expect(anredeAusVorname('Petra')).toBe('frau')
    expect(anredeAusVorname(' max ')).toBe('herr')
    expect(anredeAusVorname('Hans-Peter')).toBe('herr')
    expect(anredeAusVorname('Kim')).toBe('neutral')
    expect(anredeAusVorname('')).toBe('neutral')
  })
})
