// Reiter „Ziele“ mit den echten Daten-Hooks gegen eine kleine Datenbank im Speicher (_testHilfe): große Ziele mit Ring,
// Monatsziele mit Key Results und Fortschritt je Person, „Heute“/„Diese Woche“ nur im laufenden Monat, Zählen per Haken und
// „−“/„+“, To-dos, Blättern (Adresse, bisheriger Monat bleibt stehen), leerer Monat mit „übernehmen“, Startmonat, Laden und
// Fehler, keine Tastenmarken. „Heute“ ist Donnerstag, der 10.12.2026 (KW 50). Die Rechnerei selbst prüft rechnen.test.ts.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/components/toast', () => ({ toast: vi.fn(), toastFehler: vi.fn(), toastUndo: vi.fn() }))

import { toast } from '@/components/toast'
import { useAuth } from '@/features/auth/authStore'
import { fmtAnteil } from '@/lib/format'
import { Component as OkrSeite } from './OkrSeite'
import {
  aufrufe,
  BODO,
  ergebnis,
  JETZT,
  KARLA,
  kpiAntworten,
  neueBank,
  ort,
  richteEin,
  zeigen,
  ziel,
  type Bank,
} from './_testHilfe'

let bank: Bank
/** Die Einheit steht mit schmalem geschütztem Leerzeichen hinter der Zahl (wertText). */
const EURO = '\u202f€'

const titel = () => screen.getByRole('heading', { level: 1 }).textContent
/** Die Karten in der Reihenfolge der Seite – große Ziele zuerst. */
const karten = () =>
  screen.queryAllByRole('article').map((a) => within(a).getByRole('heading', { level: 2 }).textContent)
const karte = (name: string) => screen.getByRole('article', { name })
const geladen = (name = 'Sales') => screen.findByRole('article', { name })
/** Kopf einer Monatskarte: Prozent und die eine Ampel. */
const stand = (name: string) => {
  const kopf = karte(name).querySelector('header')
  return [
    kopf?.querySelector('[data-anteil]')?.textContent ?? null,
    kopf?.querySelector('span[data-status]')?.textContent ?? null,
  ]
}
/** Die Zeilen eines Key Results: wer · Ist / Soll · Ampel · „Woche … · Heute …“. */
const zeilen = (kr: string) =>
  Array.from(
    screen.getByRole('list', { name: `Fortschritt: ${kr}` }).querySelectorAll<HTMLElement>('[data-zeile]'),
  ).map((li) => [
    li.querySelector('[data-wer]')?.textContent,
    li.querySelector('[data-wert]')?.textContent,
    li.querySelector('span[data-status]')?.textContent,
    li.querySelector('[data-klein]')?.textContent ?? null,
  ])
const wert = (kr: string, wer: string) => zeilen(kr).find((z) => z[0] === wer)?.[1]
const haken = (kr: string, wer: string) =>
  within(screen.getByRole('group', { name: `${kr} · ${wer}` })).getAllByRole('button')
const gefuellt = (kr: string, wer: string) => haken(kr, wer).map((b) => b.getAttribute('aria-pressed') === 'true')
/** Eine Tafel („Heute“, „Diese Woche“) als Zeilen aus Zellentexten. */
const tafel = (name: string) =>
  within(screen.getByRole('table', { name }))
    .getAllByRole('row')
    .map((r) => Array.from(r.children).map((c) => c.textContent))
const todos = (kr: string) =>
  within(screen.getByRole('list', { name: `To-dos: ${kr}` }))
    .getAllByRole('listitem')
    .map((li) => [
      within(li).getByRole('checkbox').getAttribute('aria-label'),
      (within(li).getByRole('checkbox') as HTMLInputElement).checked,
      // die Marke mit dem Namen der zuständigen Person (leer = beide)
      li.querySelector('[data-wer]')?.textContent ?? null,
    ])
const todoFeld = (kr: string) => screen.getByRole('textbox', { name: `To-do hinzufügen: ${kr}` }) as HTMLInputElement
const todoSchreiben = () => bank.schreiben.filter((s) => s.tabelle === 'okr_todos')

beforeEach(() => {
  // „heute“ fest: Startmonat, Tempo, Woche und Heute hängen daran
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  bank = neueBank()
  richteEin(bank)
  vi.mocked(toast).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  useAuth.setState({ status: 'anonym', session: null, member: null })
})

describe('Ziele: was dasteht', () => {
  it('ohne Monat in der Adresse der laufende Monat: große Ziele zuerst, dann die Monatsziele', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    expect(titel()).toBe('Dezember 2026')
    expect(ort()).toBe('/ziele')
    expect(karten()).toEqual(['Wachsen', 'Erste Kunden', 'Sales', 'Selbstdarstellung'])
    expect(screen.getByRole('button', { name: 'Ziel hinzufügen' })).toBeInTheDocument()
    // die Zahlen aus dem CRM: eine Abfrage vom frühesten Beginn der gezeigten Ziele bis heute
    expect(bank.kpiAbfragen).toEqual([{ von: '2026-12-01', bis: '2026-12-10' }])
  })

  it('Monatsziel: Prozent und eine Ampel fürs Ziel – der schlechteste Stand seiner Key Results', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    // DMs (5 % + 33 %) / 2 = 19 %, Mails 25 % → 22 %; Bodo liegt bei den DMs hinten
    expect(stand('Sales')).toEqual([fmtAnteil(0.22), 'Hinten'])
    // Posts (50 % + 25 %) / 2, Kommentare 30 % → 34 %
    expect(stand('Selbstdarstellung')).toEqual([fmtAnteil(0.34), 'Im Plan'])
  })

  it('Key Result je Person: je Person eine Zeile mit Ist / Soll, Ampel, Woche und Heute', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    const sales = within(karte('Sales'))
    expect(sales.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'DMs senden',
      'Mails senden',
    ])
    expect(sales.getByText('100 im ganzen Zeitraum · je Person · zählt von selbst')).toBeInTheDocument()
    expect(zeilen('DMs senden')).toEqual([
      ['Bodo', '5 / 100', 'Hinten', 'Woche 0 / 23 · Heute 0 / 5'],
      ['Karla', '33 / 100', 'Im Plan', 'Woche 13 / 23 · Heute 3 / 5'],
    ])
    // Balken: Länge = Ist ÷ Soll, der Strich steht beim Soll bis gestern (7 von 22 Werktagen)
    const balken = screen.getByRole('progressbar', { name: 'DMs senden · Karla' })
    expect(balken).toHaveAttribute('aria-valuenow', '33')
    expect(balken).toHaveAttribute('aria-valuetext', '33 / 100')
    expect(balken).toHaveAttribute('data-status', 'im_plan')
    expect((balken.firstElementChild as HTMLElement).style.width).toBe('33%')
    expect((balken.querySelector('[data-tempo]') as HTMLElement).style.left).toBe('calc(31.8% - 1px)')
  })

  it('Key Result fürs Team: eine Zeile „Team“ (E-Mails zählen an allen Tagen)', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    expect(
      within(karte('Sales')).getByText('3.000 im ganzen Zeitraum · fürs Team · zählt von selbst'),
    ).toBeInTheDocument()
    expect(zeilen('Mails senden')).toEqual([['Team', '750 / 3.000', 'Knapp', 'Woche 750 / 678 · Heute 150 / 97']])
  })

  it('große Ziele: Ebene und Zeitraum, Ring mit Prozent, je Key Result Ist / Soll mit Einheit und Balken', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    const jahr = within(karte('Wachsen'))
    expect(jahr.getByText('Jahr').parentElement).toHaveTextContent('Jahr · Dez. 2026 – Nov. 2027')
    // toHaveTextContent machte aus dem schmalen Leerzeichen vor % ein normales – daher textContent
    expect(jahr.getByRole('img', { name: `Fortschritt ${fmtAnteil(1 / 24)}` }).textContent).toBe(fmtAnteil(0.04))
    expect(
      jahr
        .getAllByRole('listitem')
        .map((li) => [
          li.firstElementChild?.firstElementChild?.textContent,
          li.querySelector('[data-wert]')?.textContent,
        ]),
    ).toEqual([
      ['Zahlende Neukunden', '1 / 24'],
      ['Umsatz', `5.000${EURO} / 120.000${EURO}`],
    ])
    expect(jahr.getByRole('progressbar', { name: 'Umsatz' })).toHaveAttribute(
      'aria-valuetext',
      `5.000${EURO} / 120.000${EURO}`,
    )
    // große Ziele zeigen weder To-dos noch Zeilen je Person
    expect(jahr.queryByRole('textbox')).toBeNull()

    const quartal = within(karte('Erste Kunden'))
    expect(quartal.getByText('Quartal').parentElement).toHaveTextContent('Quartal · Dez. 2026 – Febr. 2027')
    expect(quartal.getByRole('img', { name: `Fortschritt ${fmtAnteil(1 / 3)}` })).toBeInTheDocument()
  })

  it('zeigt keine Tastenmarken und keine Hinweistexte', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    expect(document.querySelector('kbd')).toBeNull()
    expect(document.body.textContent).not.toMatch(/Tipp|Hinweis|Strg|⌘/)
  })
})

describe('Ziele: Heute und Diese Woche', () => {
  it('im laufenden Monat: je Tafel Key Results mit Soll, Spalten je Person, Team über beide – erreicht mit Haken', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    const seite = within(screen.getByRole('complementary', { name: 'Heute und diese Woche' }))
    expect(seite.getByRole('region', { name: 'Heute' })).toHaveTextContent('Do 10.12.')
    expect(seite.getByRole('region', { name: 'Diese Woche' })).toHaveTextContent('KW 50')
    expect(tafel('Heute')).toEqual([
      ['Key Result', 'Bodo', 'Karla'],
      ['DMs senden', '0 / 5', '3 / 5'],
      ['Mails senden', 'Erreicht: 150 / 97'],
      // „LinkedIn-Posts“ (vier im Monat) fehlt hier: das ist kein Tagesziel, nur eines für die Woche
      ['Kommentare', '0 / 2'],
    ])
    expect(tafel('Diese Woche')).toEqual([
      ['Key Result', 'Bodo', 'Karla'],
      ['DMs senden', '0 / 23', '13 / 23'],
      ['Mails senden', 'Erreicht: 750 / 678'],
      ['LinkedIn-Posts', 'Erreicht: 2 / 1', '0 / 1'],
      ['Kommentare', 'Erreicht: 12 / 10'],
    ])
    // die Zelle des Teams läuft über beide Personen-Spalten
    const mails = within(screen.getByRole('table', { name: 'Heute' })).getByRole('row', { name: /Mails senden/ })
    expect(within(mails).getByRole('cell')).toHaveAttribute('colspan', '2')
    expect(mails.querySelector('[data-erreicht]')).not.toBeNull()
  })

  it('die Tafeln stehen im Dokument vor allen Zielen (am Telefon ganz oben)', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    const seite = screen.getByRole('complementary', { name: 'Heute und diese Woche' })
    for (const name of ['Große Ziele', 'Monatsziele']) {
      const bereich = screen.getByRole('region', { name })
      expect(seite.compareDocumentPosition(bereich) & Node.DOCUMENT_POSITION_FOLLOWING, name).toBeTruthy()
    }
  })

  it('in einem anderen Monat gibt es sie nicht – auch wenn dort Ziele stehen', async () => {
    zeigen(<OkrSeite />, '/ziele?monat=2026-11')
    await geladen('Vorbereitung')
    expect(titel()).toBe('November 2026')
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    // und keine Zeile „Woche … · Heute …“ an Zielen, deren Zeitraum heute nicht enthält
    expect(document.querySelector('[data-klein]')).toBeNull()
  })

  it('ein Samstag: „Heute“ zeigt nur, was auch am Wochenende zählt', async () => {
    vi.setSystemTime(new Date('2026-12-12T10:00:00+01:00'))
    zeigen(<OkrSeite />)
    await geladen()
    expect(tafel('Heute')).toEqual([['Mails senden', '0 / 97']])
    expect(tafel('Diese Woche')).toHaveLength(5)
  })
})

describe('Ziele: von Hand zählen', () => {
  it('kleines Soll: so viele Haken-Felder wie das Soll – ein leeres bucht +1 für die Person der Zeile', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    expect(
      within(karte('Selbstdarstellung')).getByText('4 im ganzen Zeitraum · je Person · von Hand'),
    ).toBeInTheDocument()
    expect(gefuellt('LinkedIn-Posts', 'Bodo')).toEqual([true, true, false, false])
    expect(gefuellt('LinkedIn-Posts', 'Karla')).toEqual([true, false, false, false])
    // statt des Balkens
    expect(screen.queryByRole('progressbar', { name: 'LinkedIn-Posts · Karla' })).toBeNull()

    // Karla ist angemeldet und hakt in Bodos Zeile ab: gebucht wird für Bodo
    fireEvent.click(haken('LinkedIn-Posts', 'Bodo')[3] as HTMLElement)
    await waitFor(() => expect(wert('LinkedIn-Posts', 'Bodo')).toBe('3 / 4'))
    expect(aufrufe('okr_zaehlen')).toEqual([{ p_ergebnis: 'kr-posts', p_member: BODO, p_delta: 1 }])
    expect(gefuellt('LinkedIn-Posts', 'Bodo')).toEqual([true, true, true, false])
    expect(wert('LinkedIn-Posts', 'Karla')).toBe('1 / 4')
  })

  it('ein gefülltes Feld nimmt 1 zurück', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.click(haken('LinkedIn-Posts', 'Karla')[0] as HTMLElement)
    await waitFor(() => expect(wert('LinkedIn-Posts', 'Karla')).toBe('0 / 4'))
    expect(aufrufe('okr_zaehlen')).toEqual([{ p_ergebnis: 'kr-posts', p_member: KARLA, p_delta: -1 }])
    expect(gefuellt('LinkedIn-Posts', 'Karla')).toEqual([false, false, false, false])
    // der Stand hält auch nach dem Neuladen
    await waitFor(() => expect(bank.okr_eintraege.some((x) => x.member_id === KARLA)).toBe(false))
    expect(wert('LinkedIn-Posts', 'Karla')).toBe('0 / 4')
  })

  it('großes Soll: Balken mit „−“ und „+“ – die Zeile des Teams bucht für die angemeldete Person', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    expect(zeilen('Kommentare')).toEqual([['Team', '12 / 40', 'Im Plan', 'Woche 12 / 10 · Heute 0 / 2']])
    const block = within(screen.getByRole('region', { name: 'Kommentare' }))
    expect(block.getByRole('progressbar', { name: 'Kommentare · Team' })).toHaveAttribute('aria-valuenow', '30')

    fireEvent.click(block.getByRole('button', { name: 'Eins mehr' }))
    await waitFor(() => expect(wert('Kommentare', 'Team')).toBe('13 / 40'))
    expect(aufrufe('okr_zaehlen')).toEqual([{ p_ergebnis: 'kr-kommentare', p_member: KARLA, p_delta: 1 }])
  })

  it('„−“ in der Zeile des Teams nimmt bei der Person mit dem jüngsten Eintrag weg, wenn man selbst nichts eingetragen hat', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    const block = within(screen.getByRole('region', { name: 'Kommentare' }))
    // alle 12 hat Bodo eingetragen
    fireEvent.click(block.getByRole('button', { name: 'Eins weniger' }))
    await waitFor(() => expect(wert('Kommentare', 'Team')).toBe('11 / 40'))
    expect(aufrufe('okr_zaehlen')).toEqual([{ p_ergebnis: 'kr-kommentare', p_member: BODO, p_delta: -1 }])
  })

  it('von selbst zählende Key Results haben weder Haken noch Knöpfe', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    const sales = within(karte('Sales'))
    expect(sales.queryByRole('button', { name: 'Eins mehr' })).toBeNull()
    expect(sales.queryByRole('button', { name: /von \d+$/ })).toBeNull()
  })

  it('großes Ziel, von Hand gezählt: „+“ an der Karte bucht für die angemeldete Person', async () => {
    bank.okr_ergebnisse.push(ergebnis('kr-partner', 'z-jahr', 'Partner gewinnen', { zielwert: 6, position: 2 }))
    zeigen(<OkrSeite />)
    await geladen()
    const jahr = within(karte('Wachsen'))
    expect(jahr.getByRole('button', { name: 'Eins weniger' })).toBeDisabled()
    fireEvent.click(jahr.getByRole('button', { name: 'Eins mehr' }))
    await waitFor(() =>
      expect(jahr.getByRole('progressbar', { name: 'Partner gewinnen' })).toHaveAttribute('aria-valuetext', '1 / 6'),
    )
    expect(aufrufe('okr_zaehlen')).toEqual([{ p_ergebnis: 'kr-partner', p_member: KARLA, p_delta: 1 }])
  })
})

describe('Ziele: To-dos', () => {
  it('stehen unter ihrem Key Result: erledigt angehakt, zuständige Person als Marke (leer = beide)', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    expect(todos('LinkedIn-Posts')).toEqual([
      ['Skript schreiben', false, 'Karla'],
      ['Bilder aussuchen', true, null],
    ])
    expect(screen.getByText('Bilder aussuchen')).toHaveClass('line-through')
    expect(screen.getByText('Skript schreiben')).not.toHaveClass('line-through')
  })

  it('ein Key Result ohne To-dos zeigt nur die leise Zeile zum Hinzufügen', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    expect(screen.queryByRole('list', { name: 'To-dos: DMs senden' })).toBeNull()
    expect(todoFeld('DMs senden')).toHaveAttribute('placeholder', 'To-do hinzufügen')
    // Zuständigkeit und Knopf erscheinen erst, wenn etwas dasteht
    expect(screen.queryByRole('group', { name: 'Zuständig' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hinzufügen' })).toBeNull()
  })

  it('abhaken und wieder öffnen', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Skript schreiben' }))
    await waitFor(() => expect(todoSchreiben()).toHaveLength(1))
    expect(todoSchreiben()[0]).toEqual({
      tabelle: 'okr_todos',
      art: 'update',
      id: 't-skript',
      wert: { erledigt_at: JETZT.toISOString() },
    })
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Skript schreiben' })).toBeChecked())

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bilder aussuchen' }))
    await waitFor(() => expect(todoSchreiben()).toHaveLength(2))
    expect(todoSchreiben()[1]).toEqual({
      tabelle: 'okr_todos',
      art: 'update',
      id: 't-bilder',
      wert: { erledigt_at: null },
    })
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Bilder aussuchen' })).not.toBeChecked())
  })

  it('löschen – ohne Rückfrage', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.click(screen.getByRole('button', { name: 'To-do „Skript schreiben“ löschen' }))
    await waitFor(() => expect(todos('LinkedIn-Posts')).toEqual([['Bilder aussuchen', true, null]]))
    expect(todoSchreiben()).toEqual([{ tabelle: 'okr_todos', art: 'delete', id: 't-skript' }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('hinzufügen mit Enter: für eine Person', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    const feld = todoFeld('LinkedIn-Posts')
    fireEvent.change(feld, { target: { value: '  Kamera laden ' } })
    const wer = within(screen.getByRole('group', { name: 'Zuständig' }))
    expect(wer.getAllByRole('button').map((b) => b.textContent)).toEqual(['Beide', 'Bodo', 'Karla'])
    expect(wer.getByRole('button', { name: 'Beide' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(wer.getByRole('button', { name: 'Bodo' }))
    fireEvent.keyDown(feld, { key: 'Enter' })

    await waitFor(() => expect(todos('LinkedIn-Posts')).toHaveLength(3))
    expect(todoSchreiben()).toEqual([
      {
        tabelle: 'okr_todos',
        art: 'insert',
        id: expect.any(String),
        wert: { ergebnis_id: 'kr-posts', text: 'Kamera laden', member_id: BODO },
      },
    ])
    expect(todos('LinkedIn-Posts')[2]).toEqual(['Kamera laden', false, 'Bodo'])
    // das Feld ist wieder leer und bereit für das nächste
    expect(todoFeld('LinkedIn-Posts').value).toBe('')
  })

  it('hinzufügen mit dem Knopf: für beide; ein leerer Text legt nichts an', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    const feld = todoFeld('DMs senden')
    fireEvent.keyDown(feld, { key: 'Enter' })
    fireEvent.change(feld, { target: { value: '   ' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(todoSchreiben()).toEqual([])

    fireEvent.change(feld, { target: { value: 'Liste ziehen' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await waitFor(() => expect(todos('DMs senden')).toEqual([['Liste ziehen', false, null]]))
    expect(todoSchreiben()[0]?.wert).toEqual({ ergebnis_id: 'kr-dms', text: 'Liste ziehen', member_id: null })
  })

  it('scheitert das Speichern, steht der Text wieder im Feld', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    bank.kaputt.add('okr_todos')
    const feld = todoFeld('DMs senden')
    fireEvent.change(feld, { target: { value: 'Liste ziehen' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(feld.value).toBe('')
    await waitFor(() => expect(todoFeld('DMs senden').value).toBe('Liste ziehen'))
    expect(todoSchreiben()).toEqual([])
  })
})

describe('Ziele: Monat', () => {
  it('← und → blättern und schreiben den Monat in die Adresse; die Zukunft ist erlaubt', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.click(screen.getByRole('button', { name: 'Später' }))
    expect(ort()).toBe('/ziele?monat=2027-01')
    expect(titel()).toBe('Januar 2027')
    fireEvent.click(screen.getByRole('button', { name: 'Später' }))
    expect(ort()).toBe('/ziele?monat=2027-02')
    expect(screen.getByRole('button', { name: 'Später' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Früher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Früher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Früher' }))
    expect(ort()).toBe('/ziele?monat=2026-11')
    expect(titel()).toBe('November 2026')
    await geladen('Vorbereitung')
    expect(karten()).toEqual(['Vorbereitung'])
  })

  it('der Monat aus der Adresse gilt; Unsinn fällt auf den Startmonat zurück', async () => {
    zeigen(<OkrSeite />, '/ziele?monat=quatsch')
    await geladen()
    expect(titel()).toBe('Dezember 2026')
  })

  it('große Ziele stehen in jedem Monat, den sie berühren', async () => {
    zeigen(<OkrSeite />, '/ziele?monat=2027-03')
    await geladen('Wachsen')
    // das Quartal endet im Februar
    expect(karten()).toEqual(['Wachsen'])
    // dieselbe Spanne der Zahlen wie im Dezember (Beginn des Jahresziels bis heute)
    expect(bank.kpiAbfragen).toEqual([{ von: '2026-12-01', bis: '2026-12-10' }])
  })

  it('Startmonat: hat der laufende Monat keine Monatsziele, der nächste mit Zielen', async () => {
    bank.okr_ziele = [
      ziel('z-jahr', 'Wachsen', { ebene: 'jahr', bis: '2027-11-30' }),
      ziel('z-feb', 'Messe', { von: '2027-02-01', bis: '2027-02-28' }),
    ]
    zeigen(<OkrSeite />)
    await geladen('Messe')
    expect(titel()).toBe('Februar 2027')
    expect(ort()).toBe('/ziele')
  })

  it('beim Blättern bleibt der bisherige Monat stehen, bis die Zahlen des neuen da sind', async () => {
    bank.okr_ziele = [ziel('z-nov', 'Anlauf', { von: '2026-11-01', bis: '2026-11-30' }), ziel('z-sales', 'Sales')]
    bank.okr_ergebnisse = [
      ergebnis('kr-nov', 'z-nov', 'DMs im November', { quelle: 'angeschrieben' }),
      ergebnis('kr-dms', 'z-sales', 'DMs senden', { je_person: true, quelle: 'angeschrieben' }),
    ]
    zeigen(<OkrSeite />)
    await geladen()
    bank.kpiWarten = []
    fireEvent.click(screen.getByRole('button', { name: 'Früher' }))
    expect(titel()).toBe('November 2026')
    // kein Platzhalter: die Karten des Dezembers stehen noch da
    await waitFor(() => expect(bank.kpiAbfragen).toHaveLength(2))
    expect(karten()).toEqual(['Sales'])
    expect(screen.queryByRole('status')).toBeNull()
    expect(karte('Sales').closest('[aria-busy]')).not.toBeNull()

    kpiAntworten(bank)
    await geladen('Anlauf')
    expect(karten()).toEqual(['Anlauf'])
    expect(bank.kpiAbfragen[1]).toEqual({ von: '2026-11-01', bis: '2026-11-30' })
    // der November ist vorbei: 50 von 100, nicht geschafft
    expect(zeilen('DMs im November')).toEqual([['Team', '50 / 100', 'Verfehlt', null]])
    expect(document.querySelector('[aria-busy]')).toBeNull()
  })
})

describe('Ziele: leere Zustände', () => {
  it('Monat ohne Monatsziele: ein Satz, „Ziel hinzufügen“ und – wenn der Vormonat welche hat – „übernehmen“', async () => {
    zeigen(<OkrSeite />, '/ziele?monat=2027-01')
    await geladen('Wachsen')
    expect(screen.getByText('Noch keine Ziele für Januar 2027.')).toBeInTheDocument()
    // die großen Ziele stehen trotzdem da; der blaue Knopf nur einmal
    expect(karten()).toEqual(['Wachsen', 'Erste Kunden'])
    expect(screen.getAllByRole('button', { name: 'Ziel hinzufügen' })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Aus Dezember 2026 übernehmen' }))
    await geladen('Sales')
    expect(aufrufe('okr_monat_uebernehmen')).toEqual([{ p_von: '2026-12-01', p_nach: '2027-01-01' }])
    expect(toast).toHaveBeenCalledWith('Übernommen.')
    expect(karten()).toEqual(['Wachsen', 'Erste Kunden', 'Sales', 'Selbstdarstellung'])
    // der Monat hat jetzt Ziele: kein Übernehmen mehr
    expect(screen.queryByRole('button', { name: /übernehmen/ })).toBeNull()
    expect(screen.queryByText(/Noch keine Ziele/)).toBeNull()
  })

  it('ohne Monatsziele im Vormonat gibt es nichts zu übernehmen', async () => {
    zeigen(<OkrSeite />, '/ziele?monat=2027-02')
    await geladen('Wachsen')
    expect(screen.getByText('Noch keine Ziele für Februar 2027.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ziel hinzufügen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /übernehmen/ })).toBeNull()
  })

  it('hat der Monat schon Ziele, wird das Übernehmen nicht angeboten', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    // der November hat Monatsziele – trotzdem kein Angebot im Dezember
    expect(screen.queryByRole('button', { name: /übernehmen/ })).toBeNull()
  })

  it('gar keine Ziele: nur der Satz und der Knopf', async () => {
    bank.okr_ziele = []
    bank.okr_ergebnisse = []
    zeigen(<OkrSeite />)
    expect(await screen.findByText('Noch keine Ziele für Dezember 2026.')).toBeInTheDocument()
    expect(karten()).toEqual([])
    expect(screen.getAllByRole('button', { name: 'Ziel hinzufügen' })).toHaveLength(1)
    // ohne Ziele werden keine Zahlen aus dem CRM geladen
    expect(bank.kpiAbfragen).toEqual([])
  })

  it('Ziel ohne Key Result: ein leiser Knopf in der Karte, weder Prozent noch Ampel', async () => {
    zeigen(<OkrSeite />, '/ziele?monat=2026-11')
    await geladen('Vorbereitung')
    expect(stand('Vorbereitung')).toEqual([null, null])
    expect(within(karte('Vorbereitung')).getByRole('button', { name: 'Key Result hinzufügen' })).toBeInTheDocument()
  })
})

describe('Ziele: Laden und Fehler', () => {
  it('beim ersten Laden ein Platzhalter – auch solange nur die Zahlen aus dem CRM fehlen', async () => {
    bank.kpiWarten = []
    zeigen(<OkrSeite />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    await waitFor(() => expect(bank.kpiAbfragen).toHaveLength(1))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(karten()).toEqual([])
    expect(screen.queryByRole('button', { name: 'Ziel hinzufügen' })).toBeNull()
    kpiAntworten(bank)
    await geladen()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('Fehler nur, wenn nichts geladen ist: ein Satz und „Erneut versuchen“', async () => {
    bank.kaputt.add('okr_ziele')
    zeigen(<OkrSeite />)
    const alarm = await screen.findByRole('alert')
    expect(alarm).toHaveTextContent('Die Ziele konnten nicht geladen werden.')
    expect(karten()).toEqual([])
    bank.kaputt.clear()
    fireEvent.click(within(alarm).getByRole('button', { name: 'Erneut versuchen' }))
    await geladen()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('scheitern die Zahlen aus dem CRM, gilt dasselbe', async () => {
    bank.kaputt.add('v_kpi_tage')
    zeigen(<OkrSeite />)
    const alarm = await screen.findByRole('alert')
    expect(alarm).toHaveTextContent('Die Ziele konnten nicht geladen werden.')
    bank.kaputt.clear()
    fireEvent.click(within(alarm).getByRole('button', { name: 'Erneut versuchen' }))
    await geladen()
    expect(zeilen('DMs senden')[1]).toEqual(['Karla', '33 / 100', 'Im Plan', 'Woche 13 / 23 · Heute 3 / 5'])
  })

  it('ein gescheitertes Neuladen lässt den Stand stehen', async () => {
    const qc = zeigen(<OkrSeite />)
    await geladen()
    bank.kaputt.add('okr_ziele')
    await qc.invalidateQueries({ queryKey: ['okr'] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(karten()).toEqual(['Wachsen', 'Erste Kunden', 'Sales', 'Selbstdarstellung'])
  })
})
