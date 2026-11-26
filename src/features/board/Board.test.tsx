// Board-Seite (25.11.2026) mit gemockten Daten-Hooks: Listen und Karte nach der Skizze der Inhaber, Knöpfe je Liste, Verschieben
// mit „Rückgängig“ (Liste und board_seit), Suche/Filter, „Weitere anzeigen“, Lead hinzufügen (neu · übernommen · schon da · Fehler),
// Klick auf die Karte setzt ?lead= als neuen Verlaufseintrag. Nur erfundene Namen. Die Daten-Schicht selbst prüft daten.test.tsx.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardKarte } from '@/data/board'
import type { BoardListe } from './listen'

const V = 'member-v'
const M = 'member-m'
const SEIT = '2026-11-25T09:00:00+00:00'

const m = vi.hoisted(() => ({
  karten: [] as unknown[],
  vorlagen: [] as unknown[],
  laedt: false,
  fehler: false,
  refetch: vi.fn(),
  verschieben: vi.fn(),
  anlegen: vi.fn(),
  toast: vi.fn(),
  toastUndo: vi.fn(),
}))

vi.mock('@/data/board', () => ({
  useBoardKarten: () => ({
    data: m.laedt || m.fehler ? undefined : m.karten,
    isPending: m.laedt,
    isError: m.fehler,
    refetch: m.refetch,
  }),
  useKarteVerschieben: () => ({ mutateAsync: m.verschieben }),
  useKarteAnlegen: () => ({ mutateAsync: m.anlegen, isPending: false }),
}))
vi.mock('@/data/templates', () => ({ useTemplates: () => ({ data: m.vorlagen }) }))
vi.mock('@/data/members', () => ({
  // absichtlich alphabetisch wie aus der Datenbank – die Seite zeigt Vincent · Mike
  useMembers: () => ({
    data: [
      { id: 'member-m', display_name: 'Mike', short_name: 'Mike', email: 'mike@beispiel.test' },
      { id: 'member-v', display_name: 'Vincent', short_name: 'VS', email: 'vincent@beispiel.test' },
    ],
  }),
  useMeId: () => 'member-v',
}))
vi.mock('@/components/toast', () => ({ toast: m.toast, toastUndo: m.toastUndo, toastFehler: vi.fn() }))

import { Component as BoardSeite } from './BoardSeite'
import { Liste } from './Liste'
import { blattImVerlauf } from './verlauf'

function karte(id: string, liste: BoardListe, name = 'Petra Probelauf', patch: Partial<BoardKarte> = {}): BoardKarte {
  const [vor, ...rest] = name.split(' ')
  return {
    id,
    salutation: 'neutral',
    first_name: vor ?? null,
    last_name: rest.join(' ') || null,
    full_name: name,
    company_name: null,
    linkedin_url: `https://www.linkedin.com/in/${id}/`,
    owner_id: V,
    board_liste: liste,
    board_seit: SEIT,
    ...patch,
  }
}

function Ort() {
  const { pathname, search, state } = useLocation()
  const art = useNavigationType()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="ort">{pathname + search}</output>
      {/* wie der Eintrag entstand (PUSH = neuer Verlaufseintrag) und ob er als „Blatt geöffnet“ markiert ist */}
      <output data-testid="verlauf">{`${art}${blattImVerlauf(state) ? ' Blatt' : ''}`}</output>
      <button type="button" onClick={() => void navigate(-1)}>
        Browser zurück
      </button>
    </>
  )
}

function zeigen(karten: BoardKarte[] = [], start = '/leads') {
  m.karten = karten
  return render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route
          path="/leads"
          element={
            <>
              <BoardSeite />
              <Ort />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

const liste = (titel: string) => screen.getByRole('region', { name: titel })
const kartenIn = (titel: string) => Array.from(liste(titel).querySelectorAll<HTMLElement>('[data-karte]'))
/** Listenkopf als Text: „Angeschrieben2 Karten“ (die Zahl sichtbar, „Karten“ nur für Screenreader). */
const kopf = (titel: string) => liste(titel).querySelector('header')
const karteVon = (id: string) => document.querySelector<HTMLElement>(`[data-karte="${id}"]`)!

beforeEach(() => {
  m.vorlagen = []
  window.localStorage.clear()
  m.laedt = false
  m.fehler = false
  m.refetch.mockClear()
  m.verschieben.mockReset().mockResolvedValue(null)
  m.anlegen.mockReset()
  m.toast.mockClear()
  m.toastUndo.mockClear()
})

describe('Board: Listen und Karten', () => {
  it('vier Listen mit Titel und Kartenzahl, Karten in ihrer Liste und in der gelieferten Reihenfolge', () => {
    zeigen([
      karte('neu', 'angeschrieben', 'Petra Probelauf'),
      karte('alt', 'angeschrieben', 'Max Muster'),
      karte('g', 'gespraech', 'Jana Kurz'),
    ])
    expect(screen.getByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument()
    expect(screen.getAllByRole('region').map((r) => within(r).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Angeschrieben',
      'Gespräch vereinbart',
      'Im Geschäft',
      'Verloren',
    ])
    expect(kartenIn('Angeschrieben').map((k) => k.dataset['karte'])).toEqual(['neu', 'alt'])
    expect(kopf('Angeschrieben')).toHaveTextContent(/^Angeschrieben2 Karten$/)
    expect(kartenIn('Gespräch vereinbart')).toHaveLength(1)
    expect(kopf('Gespräch vereinbart')).toHaveTextContent(/^Gespräch vereinbart1 Karten$/)
    expect(kopf('Im Geschäft')).toHaveTextContent(/^Im Geschäft0 Karten$/)
    // leere Liste: ruhige Leerfläche statt Karten
    expect(within(liste('Im Geschäft')).getByText('Leer')).toBeInTheDocument()
    expect(within(liste('Verloren')).getByText('Leer')).toBeInTheDocument()
  })

  it('das Board startet leer: vier Leerflächen und der Knopf „Lead hinzufügen“', () => {
    zeigen([])
    expect(screen.getAllByText('Leer')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Lead hinzufügen' })).toBeInTheDocument()
  })

  it('während des Ladens steht in keiner Liste „Leer“', () => {
    m.laedt = true
    zeigen([])
    expect(screen.queryByText('Leer')).toBeNull()
    expect(screen.getAllByRole('region')).toHaveLength(4)
  })

  it('Laden gescheitert: Fehlerzeile mit „Erneut versuchen“, keine Liste behauptet „Leer“', () => {
    m.fehler = true
    zeigen([])
    expect(screen.getByRole('alert')).toHaveTextContent('Die Leads konnten nicht geladen werden')
    expect(screen.queryByText('Leer')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ }))
    expect(m.refetch).toHaveBeenCalledTimes(1)
  })

  it('Fehlerzeile wie auf Leitfäden und Team: ein Satz, großer Knopf, kein Tastenhinweis', () => {
    m.fehler = true
    zeigen([])
    const zeile = screen.getByRole('alert')
    expect(zeile).toHaveTextContent(/^Die Leads konnten nicht geladen werden\.Erneut versuchen$/)
    expect(zeile.querySelector('kbd')).toBeNull()
    expect(within(zeile).getByRole('button', { name: 'Erneut versuchen' })).toHaveClass('h-11')
  })

  it('Karte nach Skizze: @Zugehörigkeit, Name, LinkedIn-Link in neuem Tab, grüner und roter Knopf', () => {
    zeigen([karte('a', 'angeschrieben', 'Petra Probelauf'), karte('b', 'angeschrieben', 'Max Muster', { owner_id: M })])
    const a = within(karteVon('a'))
    expect(a.getByText('@Vincent')).toBeInTheDocument()
    expect(a.getByRole('heading', { level: 3, name: 'Petra Probelauf' })).toBeInTheDocument()
    const link = a.getByRole('link', { name: 'LinkedIn-Profil' })
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/a/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(a.getByRole('button', { name: 'Hat Interesse' })).toHaveClass('bg-done', 'h-11')
    expect(a.getByRole('button', { name: 'Kein Interesse' })).toHaveClass('bg-danger', 'h-11')
    expect(within(karteVon('b')).getByText('@Mike')).toBeInTheDocument()
  })

  it('die zwei Knöpfe stehen nebeneinander und gleich breit; die Reihe bricht nur um, wenn ein Text nicht passt – 44 px hoch', () => {
    zeigen([karte('a', 'angeschrieben')])
    const gruen = within(karteVon('a')).getByRole('button', { name: 'Hat Interesse' })
    const rot = within(karteVon('a')).getByRole('button', { name: 'Kein Interesse' })
    // jsdom rechnet kein Layout: geprüft wird die Bauart (flex-wrap als Sicherung, gleiche Grundbreite 0, nie schmaler als
    // der Text); dass bei 1280/1366/1440/1024/390 px beide nebeneinander stehen und nichts abgeschnitten ist, misst die
    // Sichtprüfung im Browser
    expect(gruen.parentElement).toBe(rot.parentElement)
    expect(gruen.parentElement).toHaveClass('flex', 'flex-wrap', 'gap-1.5', '-mx-1')
    for (const knopf of [gruen, rot]) {
      expect(knopf).toHaveClass('h-11', 'grow', 'basis-0', 'min-w-max', 'whitespace-nowrap')
      // 13 px in schmalen Listen, 14 px ab 240 px Listenbreite; schmaler Innenabstand statt px-4 – 2 px, damit das Paar bei
      // 1280 px auch dann nebeneinander bleibt, wenn der Rollbalken der Karte 5 px nimmt (Mac mit Maus)
      expect(knopf).toHaveClass('text-[13px]!', '@[240px]:text-[14px]!', 'px-0.5!')
    }
    expect(rot.className).not.toMatch(/truncate|overflow-hidden/)
  })

  it('Karte ohne LinkedIn-Link kommt ohne Link aus; fremde Adressen werden nie verlinkt', () => {
    zeigen([
      karte('a', 'angeschrieben', 'Petra Probelauf', { linkedin_url: null }),
      karte('b', 'angeschrieben', 'Max Muster', { linkedin_url: 'javascript:alert(1)' }),
    ])
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('Knöpfe je Liste: Angeschrieben und Gespräch vereinbart je zwei, Im Geschäft und Verloren keine', () => {
    zeigen([karte('a', 'angeschrieben'), karte('g', 'gespraech'), karte('i', 'im_geschaeft'), karte('v', 'verloren')])
    const knoepfe = (id: string) =>
      within(karteVon(id))
        .getAllByRole('button')
        .map((b) => b.textContent)
    expect(knoepfe('a')).toEqual(['Petra Probelauf', 'Hat Interesse', 'Kein Interesse'])
    expect(knoepfe('g')).toEqual(['Petra Probelauf', 'Im Geschäft', 'Kein Interesse'])
    expect(knoepfe('i')).toEqual(['Petra Probelauf'])
    expect(knoepfe('v')).toEqual(['Petra Probelauf'])
  })
})

describe('Board: Verschieben mit Rückgängig', () => {
  it('„Hat Interesse“ legt die Karte nach „Gespräch vereinbart“; Rückgängig stellt Liste und board_seit wieder her', async () => {
    zeigen([karte('a', 'angeschrieben')])
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Hat Interesse' }))
    expect(m.verschieben).toHaveBeenCalledWith({ id: 'a', liste: 'gespraech' })
    await waitFor(() => expect(m.toastUndo).toHaveBeenCalledTimes(1))
    const [text, zurueck] = m.toastUndo.mock.calls[0] as [string, () => Promise<void>]
    // kurz: bleibt im Toast neben „Rückgängig“ einzeilig
    expect(text).toBe('Jetzt in „Gespräch vereinbart“.')
    await act(async () => {
      await zurueck()
    })
    expect(m.verschieben).toHaveBeenLastCalledWith({ id: 'a', liste: 'angeschrieben', seit: SEIT })
  })

  it('„Kein Interesse“ legt nach „Verloren“, „Im Geschäft“ nach „Im Geschäft“', async () => {
    zeigen([karte('a', 'angeschrieben'), karte('g', 'gespraech')])
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Kein Interesse' }))
    expect(m.verschieben).toHaveBeenLastCalledWith({ id: 'a', liste: 'verloren' })
    fireEvent.click(within(karteVon('g')).getByRole('button', { name: 'Im Geschäft' }))
    expect(m.verschieben).toHaveBeenLastCalledWith({ id: 'g', liste: 'im_geschaeft' })
    await waitFor(() => expect(m.toastUndo).toHaveBeenCalledTimes(2))
    expect(m.toastUndo.mock.calls.map((c) => c[0])).toEqual(['Jetzt in „Verloren“.', 'Jetzt in „Im Geschäft“.'])
  })

  it('nur der erste Klick zählt – ein Doppelklick trifft nicht die nachrückende Karte', () => {
    zeigen([karte('a', 'angeschrieben'), karte('b', 'angeschrieben', 'Max Muster')])
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Hat Interesse' }), { detail: 1 })
    fireEvent.click(within(karteVon('b')).getByRole('button', { name: 'Hat Interesse' }), { detail: 2 })
    expect(m.verschieben).toHaveBeenCalledTimes(1)
    expect(m.verschieben).toHaveBeenCalledWith({ id: 'a', liste: 'gespraech' })
  })

  it('scheitert der Zug, gibt es keinen Rückgängig-Toast (den Fehler meldet die Daten-Schicht)', async () => {
    m.verschieben.mockRejectedValue(new Error('nein'))
    zeigen([karte('a', 'angeschrieben')])
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Hat Interesse' }))
    await act(async () => {})
    expect(m.toastUndo).not.toHaveBeenCalled()
  })

  // Abnahme 26.11.2026: Antwort des ersten Zugs nach 1200 ms, die des zweiten nach 200 ms – der Toast des ersten ersetzte
  // den des zweiten, „Rückgängig“ nahm den ersten Zug zurück.
  describe('zwei Züge, die Antworten überholen sich', () => {
    const zweiZuege = (zweiterScheitert = false) => {
      let ersteAntwort!: () => void
      m.verschieben.mockReturnValueOnce(
        new Promise<null>((fertig) => {
          ersteAntwort = () => fertig(null)
        }),
      )
      if (zweiterScheitert) m.verschieben.mockRejectedValueOnce(new Error('nein'))
      zeigen([karte('a', 'angeschrieben', 'Jonas Schablone'), karte('b', 'angeschrieben', 'Lukas Attrappe')])
      fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Hat Interesse' }))
      fireEvent.click(within(karteVon('b')).getByRole('button', { name: 'Kein Interesse' }))
      return { ersteAntwort }
    }

    it('erste Antwort spät, zweite früh: es bleibt bei einem Toast, „Rückgängig“ nimmt den zweiten Zug zurück', async () => {
      const { ersteAntwort } = zweiZuege()
      await waitFor(() => expect(m.toastUndo).toHaveBeenCalledTimes(1))
      await act(async () => {
        ersteAntwort()
      })
      expect(m.toastUndo).toHaveBeenCalledTimes(1)
      const [text, zurueck] = m.toastUndo.mock.calls[0] as [string, () => Promise<void>]
      expect(text).toBe('Jetzt in „Verloren“.')
      await act(async () => {
        await zurueck()
      })
      expect(m.verschieben).toHaveBeenLastCalledWith({ id: 'b', liste: 'angeschrieben', seit: SEIT })
    })

    it('scheitert der zweite Zug, bekommt der erste sein „Rückgängig“, sobald seine Antwort da ist', async () => {
      const { ersteAntwort } = zweiZuege(true)
      await act(async () => {})
      expect(m.toastUndo).not.toHaveBeenCalled()
      await act(async () => {
        ersteAntwort()
      })
      expect(m.toastUndo).toHaveBeenCalledTimes(1)
      const [text, zurueck] = m.toastUndo.mock.calls[0] as [string, () => Promise<void>]
      expect(text).toBe('Jetzt in „Gespräch vereinbart“.')
      await act(async () => {
        await zurueck()
      })
      expect(m.verschieben).toHaveBeenLastCalledWith({ id: 'a', liste: 'angeschrieben', seit: SEIT })
    })
  })

  it('ein Knopf auf der Karte öffnet nicht das Lead-Blatt; der Klick auf den Namen setzt ?lead=', () => {
    zeigen([karte('a', 'angeschrieben')])
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Kein Interesse' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('/leads')
    expect(screen.getByTestId('ort')).not.toHaveTextContent('lead=')
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Petra Probelauf' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('/leads?lead=a')
  })
})

// Fund 36 (25.11.2026): Nach einem Zug per Knopf verschwand die Karte samt Fokus – er fiel auf <body>
describe('Board: Fokus nach einem Zug per Knopf', () => {
  const zeichne = (karten: BoardKarte[], onVerschieben = vi.fn()) => (
    <Liste
      liste="angeschrieben"
      titel="Angeschrieben"
      karten={karten}
      members={[]}
      onOeffnen={vi.fn()}
      onVerschieben={onVerschieben}
    />
  )
  const a = karte('a', 'angeschrieben', 'Petra Probelauf')
  const b = karte('b', 'angeschrieben', 'Max Muster')
  const c = karte('c', 'angeschrieben', 'Jonas Beispiel')
  /** Wie mit der Tastatur: der Knopf hat den Fokus und wird ausgelöst. */
  const druecke = (id: string, name: string) => {
    const knopf = within(karteVon(id)).getByRole('button', { name })
    knopf.focus()
    fireEvent.click(knopf)
  }
  const nameVon = (id: string) => karteVon(id).querySelector('h3 button')

  it('die nachrückende Karte bekommt den Fokus – auf ihrem Namen, nicht auf einem ihrer Knöpfe', () => {
    const verschieben = vi.fn()
    const { rerender } = render(zeichne([a, b, c], verschieben))
    druecke('a', 'Hat Interesse')
    expect(verschieben).toHaveBeenCalledWith(a, 'gespraech')
    // die Karte liegt noch da (der Zug erscheint einen Augenblick später): der Fokus bleibt, wo er ist
    expect(within(karteVon('a')).getByRole('button', { name: 'Hat Interesse' })).toHaveFocus()
    rerender(zeichne([b, c], verschieben))
    expect(nameVon('b')).toHaveFocus()
    expect(nameVon('b')).toHaveTextContent('Max Muster')
  })

  it('war es die letzte Karte der Liste, bekommt die Karte davor den Fokus', () => {
    const { rerender } = render(zeichne([a, b, c]))
    druecke('c', 'Kein Interesse')
    rerender(zeichne([a, b]))
    expect(nameVon('b')).toHaveFocus()
  })

  it('ist die Liste danach leer, bekommt ihr Titel den Fokus', () => {
    const { rerender } = render(zeichne([a]))
    druecke('a', 'Hat Interesse')
    rerender(zeichne([]))
    expect(screen.getByRole('heading', { level: 2, name: 'Angeschrieben' })).toHaveFocus()
  })

  it('jenseits der ersten 50: die Karte, die in die Ansicht nachrückt, bekommt den Fokus', () => {
    const viele = Array.from({ length: 52 }, (_, i) => karte(`k${i}`, 'angeschrieben', `Test Person ${i}`))
    const { rerender } = render(zeichne(viele))
    druecke('k49', 'Hat Interesse')
    rerender(zeichne(viele.filter((k) => k.id !== 'k49')))
    expect(nameVon('k50')).toHaveFocus()
  })

  it('lag der Fokus nicht auf der Karte (Mausklick in Safari, Ziehen), wird er nicht versetzt', () => {
    const { rerender } = render(zeichne([a, b]))
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Hat Interesse' }))
    rerender(zeichne([b]))
    expect(document.body).toHaveFocus()
  })

  it('hat inzwischen etwas anderes den Fokus, bleibt er dort', () => {
    const { rerender } = render(
      <>
        <input aria-label="Suchen" />
        {zeichne([a, b])}
      </>,
    )
    druecke('a', 'Hat Interesse')
    screen.getByLabelText('Suchen').focus()
    rerender(
      <>
        <input aria-label="Suchen" />
        {zeichne([b])}
      </>,
    )
    expect(screen.getByLabelText('Suchen')).toHaveFocus()
  })

  it('scheitert der Zug und die Karte bleibt, wird später kein Fokus gestohlen', () => {
    const { rerender } = render(zeichne([a, b]))
    druecke('a', 'Hat Interesse')
    // neu gezeichnet, die Karte ist noch da (Zug zurückgerollt)
    rerender(zeichne([a, b]))
    expect(within(karteVon('a')).getByRole('button', { name: 'Hat Interesse' })).toHaveFocus()
  })
})

describe('Board: Karte öffnen und die Zurück-Taste', () => {
  it('Öffnen legt einen markierten Verlaufseintrag an; „Zurück“ des Browsers schließt und bleibt auf dem Board', () => {
    zeigen([karte('a', 'angeschrieben')])
    expect(screen.getByTestId('verlauf')).toHaveTextContent(/^POP$/)
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Petra Probelauf' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('/leads?lead=a')
    // PUSH (nicht REPLACE) und die Marke, an der die Hülle erkennt: „Schließen“ darf einen Schritt zurück
    expect(screen.getByTestId('verlauf')).toHaveTextContent(/^PUSH Blatt$/)
    fireEvent.click(screen.getByRole('button', { name: 'Browser zurück' }))
    expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/)
    expect(screen.getByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument()
  })

  it('steht schon ein Lead in der Adresse (Direktaufruf), ersetzt eine Karte ihn – kein zweiter Eintrag, keine Marke', () => {
    zeigen([karte('a', 'angeschrieben')], '/leads?lead=x')
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Petra Probelauf' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('/leads?lead=a')
    expect(screen.getByTestId('verlauf')).toHaveTextContent(/^REPLACE$/)
  })
})

describe('Board: Ziehen', () => {
  // jsdom kennt kein Layout: die Listen bekommen feste Rechtecke nebeneinander, die Karte liegt in ihrer Liste
  const breite = 250
  const spalte: Record<string, number> = { angeschrieben: 0, gespraech: 1, im_geschaeft: 2, verloren: 3 }
  const rechteck = (x: number, y: number, w: number, h: number) =>
    ({ x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, toJSON: () => ({}) }) as DOMRect

  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const l = this.closest('[data-liste]')?.getAttribute('data-liste')
      if (!l) return rechteck(0, 0, 0, 0)
      const x = (spalte[l] ?? 0) * (breite + 10)
      return this.matches('[data-liste]') ? rechteck(x, 0, breite, 600) : rechteck(x + 10, 50, breite - 20, 150)
    })
  })
  afterEach(() => vi.restoreAllMocks())

  const zeiger = { pointerId: 1, isPrimary: true, button: 0, pointerType: 'mouse' }

  it('Karte mit der Maus in eine andere Liste ziehen verschiebt sie – mit demselben Rückgängig', async () => {
    zeigen([karte('a', 'angeschrieben')])
    const griff = within(karteVon('a')).getByRole('button', { name: 'Petra Probelauf' })
    fireEvent.pointerDown(griff, { ...zeiger, clientX: 50, clientY: 100 })
    await act(async () => {
      fireEvent.pointerMove(document, { ...zeiger, clientX: 300, clientY: 110 })
    })
    await act(async () => {
      fireEvent.pointerMove(document, { ...zeiger, clientX: 800, clientY: 120 })
    })
    await act(async () => {
      fireEvent.pointerUp(document, { ...zeiger, clientX: 800, clientY: 120 })
    })
    expect(m.verschieben).toHaveBeenCalledWith({ id: 'a', liste: 'verloren' })
    await waitFor(() => expect(m.toastUndo).toHaveBeenCalledTimes(1))
    // das Ziehen war kein Klick: das Lead-Blatt bleibt zu
    expect(screen.getByTestId('ort')).not.toHaveTextContent('lead=')
    // dnd-kit schluckt nach dem Loslassen 50 ms lang Klicks (damit das Ablegen kein Klick wird) – abwarten, sonst trifft es den nächsten Test
    await new Promise((fertig) => setTimeout(fertig, 80))
  })

  it('Ziehen an einem Knopf der Karte startet nicht', async () => {
    zeigen([karte('a', 'angeschrieben')])
    fireEvent.pointerDown(within(karteVon('a')).getByRole('button', { name: 'Hat Interesse' }), {
      ...zeiger,
      clientX: 50,
      clientY: 100,
    })
    await act(async () => {
      fireEvent.pointerMove(document, { ...zeiger, clientX: 800, clientY: 120 })
    })
    await act(async () => {
      fireEvent.pointerUp(document, { ...zeiger, clientX: 800, clientY: 120 })
    })
    expect(m.verschieben).not.toHaveBeenCalled()
  })
})

describe('Board: Suche, Filter, lange Listen', () => {
  const karten = [
    karte('a', 'angeschrieben', 'Petra Probelauf'),
    karte('b', 'angeschrieben', 'Max Muster', { owner_id: M, company_name: 'Muster Solar GmbH' }),
    karte('c', 'gespraech', 'Jana Kurz', { owner_id: M }),
  ]

  it('Suche filtert die Anzeige über Name und Firma; leere Listen heißen dann „Keine Treffer“', () => {
    zeigen(karten)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Suchen' }), { target: { value: 'solar' } })
    expect(kartenIn('Angeschrieben').map((k) => k.dataset['karte'])).toEqual(['b'])
    expect(kartenIn('Gespräch vereinbart')).toHaveLength(0)
    expect(within(liste('Gespräch vereinbart')).getByText('Keine Treffer')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Suchen' }), { target: { value: '' } })
    expect(kartenIn('Angeschrieben')).toHaveLength(2)
  })

  it('Personen-Filter Alle · Vincent · Mike', () => {
    zeigen(karten)
    const filter = within(screen.getByRole('group', { name: 'Zugehörigkeit' }))
    expect(filter.getAllByRole('button').map((b) => b.textContent)).toEqual(['Alle', 'Vincent', 'Mike'])
    expect(filter.getByRole('button', { name: 'Alle' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(filter.getByRole('button', { name: 'Mike' }))
    expect(kartenIn('Angeschrieben').map((k) => k.dataset['karte'])).toEqual(['b'])
    expect(kartenIn('Gespräch vereinbart').map((k) => k.dataset['karte'])).toEqual(['c'])
    fireEvent.click(filter.getByRole('button', { name: 'Vincent' }))
    expect(kartenIn('Angeschrieben').map((k) => k.dataset['karte'])).toEqual(['a'])
    fireEvent.click(filter.getByRole('button', { name: 'Alle' }))
    expect(kartenIn('Angeschrieben')).toHaveLength(2)
  })

  it('lange Liste: zunächst 50 Karten, „Weitere anzeigen“ legt nach', () => {
    zeigen(Array.from({ length: 60 }, (_, i) => karte(`k${i}`, 'angeschrieben', `Test Person ${i}`)))
    expect(kopf('Angeschrieben')).toHaveTextContent(/^Angeschrieben60 Karten$/)
    expect(kartenIn('Angeschrieben')).toHaveLength(50)
    fireEvent.click(within(liste('Angeschrieben')).getByRole('button', { name: 'Weitere anzeigen' }))
    expect(kartenIn('Angeschrieben')).toHaveLength(60)
    expect(screen.queryByRole('button', { name: 'Weitere anzeigen' })).toBeNull()
  })

  // Der Knopf entfernt sich mit dem letzten Nachlegen selbst – der Fokus fiel auf <body>
  it('lange Liste: nach „Weitere anzeigen“ bekommt die erste neu gezeigte Karte den Fokus – auf ihrem Namen', () => {
    zeigen(Array.from({ length: 110 }, (_, i) => karte(`k${i}`, 'angeschrieben', `Test Person ${i}`)))
    const weitere = () => within(liste('Angeschrieben')).getByRole('button', { name: 'Weitere anzeigen' })
    const nameVon = (id: string) => karteVon(id).querySelector('h3 button')
    // wie mit der Tastatur: der Knopf hat den Fokus und wird ausgelöst
    weitere().focus()
    fireEvent.click(weitere())
    expect(kartenIn('Angeschrieben')).toHaveLength(100)
    expect(nameVon('k50')).toHaveFocus()
    expect(nameVon('k50')).toHaveTextContent('Test Person 50')
    // beim letzten Nachlegen verschwindet der Knopf: der Fokus landet trotzdem auf einer Karte, nicht auf <body>
    weitere().focus()
    fireEvent.click(weitere())
    expect(screen.queryByRole('button', { name: 'Weitere anzeigen' })).toBeNull()
    expect(nameVon('k100')).toHaveFocus()
  })

  it('lange Liste: lag der Fokus nicht auf „Weitere anzeigen“ (Mausklick in Safari), wird er nicht versetzt', () => {
    zeigen(Array.from({ length: 60 }, (_, i) => karte(`k${i}`, 'angeschrieben', `Test Person ${i}`)))
    fireEvent.click(within(liste('Angeschrieben')).getByRole('button', { name: 'Weitere anzeigen' }))
    expect(kartenIn('Angeschrieben')).toHaveLength(60)
    expect(document.body).toHaveFocus()
  })

  // 25.11.2026: „… liegt schon in …“ für eine Karte jenseits der ersten 50 – nach 2,5 s klappte die Liste zurück
  it('lange Liste: eine hervorgehobene Karte weiter unten bleibt zu sehen, auch wenn das Hervorheben endet', () => {
    const karten = Array.from({ length: 64 }, (_, i) => karte(`k${i}`, 'angeschrieben', `Test Person ${i}`))
    const zeichne = (hervorgehoben: string | null) => (
      <Liste
        liste="angeschrieben"
        titel="Angeschrieben"
        karten={karten}
        members={[]}
        hervorgehoben={hervorgehoben}
        onOeffnen={vi.fn()}
        onVerschieben={vi.fn()}
      />
    )
    const { rerender } = render(zeichne(null))
    expect(kartenIn('Angeschrieben')).toHaveLength(50)
    rerender(zeichne('k58'))
    expect(kartenIn('Angeschrieben')).toHaveLength(59)
    expect(karteVon('k58')).toHaveAttribute('data-hervorgehoben')
    rerender(zeichne(null))
    expect(kartenIn('Angeschrieben')).toHaveLength(59)
    expect(karteVon('k58')).not.toHaveAttribute('data-hervorgehoben')
    // „Weitere anzeigen“ legt von dort aus nach
    fireEvent.click(within(liste('Angeschrieben')).getByRole('button', { name: 'Weitere anzeigen' }))
    expect(kartenIn('Angeschrieben')).toHaveLength(64)
  })
})

describe('Board: Lead hinzufügen', () => {
  const oeffnen = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Lead hinzufügen' }))
    return within(screen.getByRole('dialog', { name: 'Lead hinzufügen' }))
  }
  const ausfuellen = (d: ReturnType<typeof oeffnen>, vor: string, nach: string, link = '') => {
    fireEvent.change(d.getByLabelText('Vorname'), { target: { value: vor } })
    fireEvent.change(d.getByLabelText('Nachname'), { target: { value: nach } })
    fireEvent.change(d.getByLabelText('LinkedIn-Link'), { target: { value: link } })
  }

  it('neu: schickt Name, Link, Zugehörigkeit (voreingestellt: ich) und die geratene Anrede; die Karte wird hervorgehoben', async () => {
    m.anlegen.mockResolvedValue({ status: 'neu', lead_id: 'neu', liste: 'angeschrieben', owner_id: V })
    zeigen([karte('neu', 'angeschrieben', 'Petra Probelauf')])
    const d = oeffnen()
    expect(
      within(d.getByRole('group', { name: 'Zugehörigkeit' })).getByRole('button', { name: 'Vincent' }),
    ).toHaveAttribute('aria-pressed', 'true')
    ausfuellen(d, 'Petra', 'Probelauf', 'https://www.linkedin.com/in/petra-probelauf')
    fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(m.anlegen).toHaveBeenCalledWith({
      vorname: 'Petra',
      nachname: 'Probelauf',
      linkedinUrl: 'https://www.linkedin.com/in/petra-probelauf',
      ownerId: V,
      anrede: 'frau',
    })
    expect(karteVon('neu')).toHaveAttribute('data-hervorgehoben')
    expect(m.toast).not.toHaveBeenCalled()
  })

  // 26.11.2026 (Vincent: „beim Anlegen einer Karte anklicken können, welchen Leitfaden wir benutzt haben“)
  describe('Leitfaden', () => {
    const vorlage = (id: string, name: string, extra: object = {}) => ({
      id,
      name,
      channel: 'linkedin',
      archiviert_at: null,
      ...extra,
    })
    const ZWEI = [
      vorlage('lf-b', 'Probe-Eröffnung B'),
      vorlage('lf-a', 'Probe-Eröffnung A'),
      vorlage('lf-alt', 'Archivierte Eröffnung', { archiviert_at: '2026-11-25T08:00:00+00:00' }),
      vorlage('lf-mail', 'E-Mail-Vorlage', { channel: 'email' }),
    ]
    const wahl = (d: ReturnType<typeof oeffnen>) => d.getByLabelText('Leitfaden') as HTMLSelectElement
    const namen = (d: ReturnType<typeof oeffnen>) => Array.from(wahl(d).options).map((o) => o.textContent)

    it('ohne Leitfäden gibt es das Feld nicht', () => {
      zeigen([])
      expect(oeffnen().queryByLabelText('Leitfaden')).toBeNull()
    })

    it('bietet die Leitfäden der Leitfäden-Seite an (nach Namen), keiner ist vorgewählt; die Wahl geht mit', async () => {
      m.vorlagen = ZWEI
      m.anlegen.mockResolvedValue({ status: 'neu', lead_id: 'x', liste: 'angeschrieben', owner_id: V })
      zeigen([])
      const d = oeffnen()
      expect(namen(d)).toEqual(['Kein Leitfaden', 'Probe-Eröffnung A', 'Probe-Eröffnung B'])
      expect(wahl(d).value).toBe('')
      fireEvent.change(wahl(d), { target: { value: 'lf-b' } })
      ausfuellen(d, 'Petra', 'Probelauf')
      fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(m.anlegen).toHaveBeenCalledWith(expect.objectContaining({ vorname: 'Petra', leitfadenId: 'lf-b' }))
    })

    it('merkt sich die letzte Wahl: beim nächsten Anlegen ist derselbe Leitfaden vorgewählt', async () => {
      m.vorlagen = ZWEI
      m.anlegen.mockResolvedValue({ status: 'neu', lead_id: 'x', liste: 'angeschrieben', owner_id: V })
      zeigen([])
      let d = oeffnen()
      fireEvent.change(wahl(d), { target: { value: 'lf-a' } })
      ausfuellen(d, 'Petra', 'Probelauf')
      fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      d = oeffnen()
      expect(wahl(d).value).toBe('lf-a')
      ausfuellen(d, 'Otto', 'Ohnelink')
      fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
      await waitFor(() => expect(m.anlegen).toHaveBeenCalledTimes(2))
      expect(m.anlegen).toHaveBeenLastCalledWith(expect.objectContaining({ vorname: 'Otto', leitfadenId: 'lf-a' }))
    })

    it('„Kein Leitfaden“ bewusst gewählt: es geht keiner mit, und gemerkt ist danach auch keiner', async () => {
      m.vorlagen = ZWEI
      window.localStorage.setItem('crm:board:leitfaden', 'lf-a')
      m.anlegen.mockResolvedValue({ status: 'neu', lead_id: 'x', liste: 'angeschrieben', owner_id: V })
      zeigen([])
      const d = oeffnen()
      expect(wahl(d).value).toBe('lf-a')
      fireEvent.change(wahl(d), { target: { value: '' } })
      ausfuellen(d, 'Petra', 'Probelauf')
      fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(m.anlegen.mock.calls[0]?.[0].leitfadenId).toBeUndefined()
      expect(window.localStorage.getItem('crm:board:leitfaden')).toBeNull()
    })

    it('gibt es nur einen Leitfaden, ist er vorgewählt; ein gemerkter, den es nicht mehr gibt, zählt nicht', () => {
      m.vorlagen = [ZWEI[0], ZWEI[2]]
      window.localStorage.setItem('crm:board:leitfaden', 'lf-alt')
      zeigen([])
      expect(wahl(oeffnen()).value).toBe('lf-b')
    })
  })

  it('andere Zugehörigkeit wählbar; Enter im Feld schickt ab; unbekannter Vorname bleibt neutral', async () => {
    m.anlegen.mockResolvedValue({ status: 'neu', lead_id: 'x', liste: 'angeschrieben', owner_id: M })
    zeigen([])
    const d = oeffnen()
    ausfuellen(d, 'Kim', 'Muster')
    fireEvent.click(within(d.getByRole('group', { name: 'Zugehörigkeit' })).getByRole('button', { name: 'Mike' }))
    fireEvent.keyDown(d.getByLabelText('Nachname'), { key: 'Enter' })
    await waitFor(() => expect(m.anlegen).toHaveBeenCalledTimes(1))
    expect(m.anlegen.mock.calls[0]![0]).toMatchObject({ vorname: 'Kim', ownerId: M, anrede: 'neutral' })
  })

  it('übernommen (Person war schon gespeichert): wie neu – Dialog zu, Karte hervorgehoben, keine Meldung', async () => {
    m.anlegen.mockResolvedValue({ status: 'uebernommen', lead_id: 'alt', liste: 'angeschrieben', owner_id: V })
    zeigen([karte('alt', 'angeschrieben', 'Max Muster')])
    const d = oeffnen()
    ausfuellen(d, 'Max', 'Muster', 'linkedin.com/in/max-muster')
    fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(karteVon('alt')).toHaveAttribute('data-hervorgehoben')
    expect(m.toast).not.toHaveBeenCalled()
  })

  it('schon da: ruhige Meldung mit der Liste, die Karte wird hervorgehoben – auch wenn Suche und Filter sie verstecken würden', async () => {
    m.anlegen.mockResolvedValue({ status: 'schon_da', lead_id: 'c', liste: 'gespraech', owner_id: M })
    zeigen([karte('a', 'angeschrieben', 'Petra Probelauf'), karte('c', 'gespraech', 'Jana Kurz', { owner_id: M })])
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Zugehörigkeit' })).getByRole('button', { name: 'Vincent' }),
    )
    fireEvent.change(screen.getByRole('searchbox', { name: 'Suchen' }), { target: { value: 'petra' } })
    expect(karteVon('c')).toBeNull()
    const d = oeffnen()
    ausfuellen(d, 'Jana', 'Kurz', 'linkedin.com/in/jana-kurz')
    fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith('Jana Kurz liegt schon in „Gespräch vereinbart“.'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(karteVon('c')).toHaveAttribute('data-hervorgehoben')
    expect(
      within(screen.getByRole('group', { name: 'Zugehörigkeit' })).getByRole('button', { name: 'Alle' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('searchbox', { name: 'Suchen' })).toHaveValue('')
  })

  it('Fehlertext der Datenbank steht direkt im Dialog, der Dialog bleibt offen', async () => {
    m.anlegen.mockRejectedValue({ code: 'P0001', message: 'Diese Person steht auf der Sperrliste' })
    zeigen([])
    const d = oeffnen()
    ausfuellen(d, 'Petra', 'Probelauf', 'linkedin.com/in/petra-probelauf')
    fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
    expect(await d.findByRole('alert')).toHaveTextContent('Diese Person steht auf der Sperrliste')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(d.getByLabelText('Vorname')).toHaveValue('Petra')
  })

  it('kein LinkedIn-Profil-Link: der Text der Datenbank steht am Link-Feld', async () => {
    const text = 'Das ist kein LinkedIn-Profil-Link – er muss linkedin.com/in/… enthalten'
    m.anlegen.mockRejectedValue({ code: 'P0001', message: text })
    zeigen([])
    const d = oeffnen()
    ausfuellen(d, 'Petra', 'Probelauf', 'https://www.linkedin.com/company/muster-solar')
    fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
    expect(await d.findByRole('alert')).toHaveTextContent(text)
    expect(d.getByLabelText('LinkedIn-Link')).toHaveAttribute('aria-invalid', 'true')
  })

  it('ohne Namen fragt der Dialog gar nicht erst die Datenbank', () => {
    zeigen([])
    const d = oeffnen()
    fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
    expect(d.getByRole('alert')).toHaveTextContent('Bitte einen Namen eingeben')
    expect(m.anlegen).not.toHaveBeenCalled()
  })
})
