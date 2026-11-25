// Board-Seite (25.11.2026) mit gemockten Daten-Hooks: Listen und Karte nach der Skizze der Inhaber, Knöpfe je Liste, Verschieben
// mit „Rückgängig“ (Liste und board_seit), Suche/Filter, „Weitere anzeigen“, Lead hinzufügen (neu · übernommen · schon da · Fehler),
// Klick auf die Karte setzt ?lead=. Nur erfundene Namen. Die Daten-Schicht selbst prüft daten.test.tsx.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardKarte } from '@/data/board'
import type { BoardListe } from './listen'

const V = 'member-v'
const M = 'member-m'
const SEIT = '2026-11-25T09:00:00+00:00'

const m = vi.hoisted(() => ({
  karten: [] as unknown[],
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
  const { pathname, search } = useLocation()
  return <output data-testid="ort">{pathname + search}</output>
}

function zeigen(karten: BoardKarte[] = []) {
  m.karten = karten
  return render(
    <MemoryRouter initialEntries={['/leads']}>
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
    expect(text).toBe('Verschoben nach „Gespräch vereinbart“.')
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
    expect(m.toastUndo.mock.calls.map((c) => c[0])).toEqual([
      'Verschoben nach „Verloren“.',
      'Verschoben nach „Im Geschäft“.',
    ])
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

  it('ein Knopf auf der Karte öffnet nicht das Lead-Blatt; der Klick auf den Namen setzt ?lead=', () => {
    zeigen([karte('a', 'angeschrieben')])
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Kein Interesse' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('/leads')
    expect(screen.getByTestId('ort')).not.toHaveTextContent('lead=')
    fireEvent.click(within(karteVon('a')).getByRole('button', { name: 'Petra Probelauf' }))
    expect(screen.getByTestId('ort')).toHaveTextContent('/leads?lead=a')
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
