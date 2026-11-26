// Die Dialoge des Reiters „Ziele“, geöffnet über die Seite (Knopf im Kopf, Menü „⋯“ an Karte und Key Result): Ziel anlegen und
// bearbeiten (der Zeitraum rechnet sich aus Ebene und Startmonat), Key Result anlegen und bearbeiten (Pflichtfelder, deutsche
// Zahlen, „Umsatz aus Neukunden“, „Gilt“ nur bei Monatszielen), Löschen nur mit Bestätigung. Geschrieben wird in die kleine
// Datenbank aus _testHilfe – geprüft wird, was dort ankommt. „Heute“ ist der 10.12.2026.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/components/toast', () => ({ toast: vi.fn(), toastFehler: vi.fn(), toastUndo: vi.fn() }))

import { toast, toastFehler } from '@/components/toast'
import { useAuth } from '@/features/auth/authStore'
import { Component as OkrSeite } from './OkrSeite'
import { JETZT, menue, neueBank, ort, richteEin, zeigen, type Bank } from './_testHilfe'

let bank: Bank

const geladen = (name = 'Sales') => screen.findByRole('article', { name })
const fenster = (name: string) => screen.findByRole('dialog', { name })
const feld = (d: HTMLElement, label: string) => within(d).getByLabelText(label) as HTMLInputElement
const tippe = (d: HTMLElement, label: string, text: string) =>
  fireEvent.change(feld(d, label), { target: { value: text } })
const waehle = (d: HTMLElement, gruppe: string, knopf: string) =>
  fireEvent.click(within(within(d).getByRole('group', { name: gruppe })).getByRole('button', { name: knopf }))
const gewaehlt = (d: HTMLElement, gruppe: string) =>
  within(within(d).getByRole('group', { name: gruppe }))
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent)
const speichern = (d: HTMLElement) => fireEvent.click(within(d).getByRole('button', { name: 'Speichern' }))
const zeitraum = (d: HTMLElement) => d.querySelector('[data-zeitraum]')?.textContent
const fehler = (d: HTMLElement) =>
  within(d)
    .queryAllByRole('alert')
    .map((a) => a.textContent)
const zu = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

beforeEach(() => {
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
  bank = neueBank()
  richteEin(bank)
  vi.mocked(toast).mockClear()
  vi.mocked(toastFehler).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  useAuth.setState({ status: 'anonym', session: null, member: null })
})

describe('Ziel hinzufügen', () => {
  it('vorbelegt mit dem gezeigten Monat; der Zeitraum rechnet sich aus Ebene und Startmonat', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    const d = await fenster('Ziel hinzufügen')
    expect(gewaehlt(d, 'Zeitraum')).toEqual(['Monat'])
    expect(feld(d, 'Beginnt im').value).toBe('2026-12-01')
    expect(zeitraum(d)).toBe('01.12.2026 – 31.12.2026')

    waehle(d, 'Zeitraum', 'Quartal')
    expect(zeitraum(d)).toBe('01.12.2026 – 28.02.2027')
    waehle(d, 'Zeitraum', 'Jahr')
    expect(zeitraum(d)).toBe('01.12.2026 – 30.11.2027')
    fireEvent.change(feld(d, 'Beginnt im'), { target: { value: '2027-01-01' } })
    expect(zeitraum(d)).toBe('01.01.2027 – 31.12.2027')
    waehle(d, 'Zeitraum', 'Monat')
    expect(zeitraum(d)).toBe('01.01.2027 – 31.01.2027')
  })

  it('„Beginnt im“ bietet 12 Monate zurück bis 18 voraus', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    const d = await fenster('Ziel hinzufügen')
    const monate = within(feld(d, 'Beginnt im')).getAllByRole('option')
    expect(monate).toHaveLength(31)
    expect(monate[0]).toHaveTextContent('Dezember 2025')
    expect(monate.at(-1)).toHaveTextContent('Juni 2028')
  })

  it('ohne Titel wird nichts gespeichert; mit Titel legt „Speichern“ das Ziel an', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    const d = await fenster('Ziel hinzufügen')
    speichern(d)
    expect(fehler(d)).toEqual(['Bitte einen Titel eingeben'])
    expect(bank.schreiben).toEqual([])

    tippe(d, 'Titel', ' Sichtbar werden ')
    expect(fehler(d)).toEqual([])
    waehle(d, 'Zeitraum', 'Quartal')
    speichern(d)
    await zu()
    expect(bank.schreiben).toEqual([
      {
        tabelle: 'okr_ziele',
        art: 'insert',
        id: expect.any(String),
        wert: { titel: 'Sichtbar werden', ebene: 'quartal', von: '2026-12-01', bis: '2027-02-28' },
      },
    ])
    // das neue Quartalsziel steht bei den großen Zielen; die Seite bleibt im Dezember
    expect(await geladen('Sichtbar werden')).toHaveTextContent('Quartal · Dez. 2026 – Febr. 2027')
    expect(ort()).toBe('/ziele')
  })

  it('Enter im Titel speichert; beginnt das Ziel in einem anderen Monat, blättert die Seite dorthin', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    const d = await fenster('Ziel hinzufügen')
    fireEvent.change(feld(d, 'Beginnt im'), { target: { value: '2027-02-01' } })
    tippe(d, 'Titel', 'Messe')
    fireEvent.keyDown(feld(d, 'Titel'), { key: 'Enter' })
    await zu()
    expect(bank.schreiben[0]?.wert).toEqual({ titel: 'Messe', ebene: 'monat', von: '2027-02-01', bis: '2027-02-28' })
    await waitFor(() => expect(ort()).toBe('/ziele?monat=2027-02'))
    expect(await geladen('Messe')).toBeInTheDocument()
  })

  it('scheitert das Speichern, bleibt das Fenster mit den Eingaben offen', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    const d = await fenster('Ziel hinzufügen')
    tippe(d, 'Titel', 'Messe')
    bank.kaputt.add('okr_ziele')
    speichern(d)
    await waitFor(() => expect(toastFehler).toHaveBeenCalled())
    expect(screen.getByRole('dialog', { name: 'Ziel hinzufügen' })).toBeInTheDocument()
    expect(feld(d, 'Titel').value).toBe('Messe')
    expect(bank.schreiben).toEqual([])
  })

  it('„Abbrechen“ schließt, ohne zu speichern', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    const d = await fenster('Ziel hinzufügen')
    tippe(d, 'Titel', 'Messe')
    fireEvent.click(within(d).getByRole('button', { name: 'Abbrechen' }))
    await zu()
    expect(bank.schreiben).toEqual([])
  })
})

describe('Ziel bearbeiten und löschen', () => {
  it('das Menü „⋯“ öffnet das Ziel vorbelegt; „Speichern“ ändert es', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    menue('Erste Kunden', 'Ziel bearbeiten')
    const d = await fenster('Ziel bearbeiten')
    expect(feld(d, 'Titel').value).toBe('Erste Kunden')
    expect(gewaehlt(d, 'Zeitraum')).toEqual(['Quartal'])
    expect(feld(d, 'Beginnt im').value).toBe('2026-12-01')
    expect(zeitraum(d)).toBe('01.12.2026 – 28.02.2027')

    tippe(d, 'Titel', 'Drei Kunden')
    speichern(d)
    await zu()
    expect(bank.schreiben).toEqual([
      {
        tabelle: 'okr_ziele',
        art: 'update',
        id: 'z-quartal',
        wert: { titel: 'Drei Kunden', ebene: 'quartal', von: '2026-12-01', bis: '2027-02-28' },
      },
    ])
    expect(await geladen('Drei Kunden')).toBeInTheDocument()
  })

  it('löschen nur mit Bestätigung', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    menue('Sales', 'Ziel löschen')
    const d = await fenster('Ziel löschen?')
    expect(d).toHaveTextContent('„Sales“ wird mit seinen Key Results und To-dos gelöscht.')
    fireEvent.click(within(d).getByRole('button', { name: 'Abbrechen' }))
    await zu()
    expect(bank.schreiben).toEqual([])
    expect(screen.getByRole('article', { name: 'Sales' })).toBeInTheDocument()
    // der Fokus ist zurück auf dem Menü-Knopf, von dem aus das Fenster geöffnet wurde
    await waitFor(() => expect(screen.getByRole('button', { name: 'Menü für „Sales“' })).toHaveFocus())

    menue('Sales', 'Ziel löschen')
    fireEvent.click(within(await fenster('Ziel löschen?')).getByRole('button', { name: 'Löschen' }))
    await zu()
    expect(bank.schreiben).toEqual([{ tabelle: 'okr_ziele', art: 'delete', id: 'z-sales' }])
    expect(toast).toHaveBeenCalledWith('Ziel gelöscht.')
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Sales' })).toBeNull())
  })
})

describe('Key Result hinzufügen', () => {
  it('Pflichtfelder: Titel und ein Zielwert über 0', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    menue('Sales', 'Key Result hinzufügen')
    const d = await fenster('Key Result hinzufügen')
    expect(d).toHaveTextContent('Sales · Dezember 2026')
    speichern(d)
    expect(fehler(d)).toEqual(['Bitte einen Titel eingeben', 'Bitte eine Zahl über 0 eingeben'])

    tippe(d, 'Titel', 'Anrufe')
    for (const unsinn of ['0', 'viele', '-3']) {
      tippe(d, 'Zielwert', unsinn)
      speichern(d)
      expect(fehler(d), unsinn).toEqual(['Bitte eine Zahl über 0 eingeben'])
    }
    expect(bank.schreiben).toEqual([])
  })

  it('Monatsziel: „3.000“ wird 3000; Gilt, Für und die Zählart werden gespeichert', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    menue('Sales', 'Key Result hinzufügen')
    const d = await fenster('Key Result hinzufügen')
    // Vorgaben: ganzer Zeitraum, Team zusammen, von Hand
    expect(gewaehlt(d, 'Gilt')).toEqual(['im ganzen Zeitraum'])
    expect(gewaehlt(d, 'Für')).toEqual(['Team zusammen'])
    expect(feld(d, 'Wie wird gezählt?').value).toBe('manuell')
    const arten = within(feld(d, 'Wie wird gezählt?')).getAllByRole('option')
    expect(arten.at(-1)).toHaveTextContent('Wir zählen von Hand')
    expect(arten.map((o) => o.textContent)).toContain('Umsatz aus Neukunden')
    expect(within(d).queryByLabelText('Wert je Kunde in €')).toBeNull()

    tippe(d, 'Titel', ' Anrufe ')
    tippe(d, 'Zielwert', '3.000')
    waehle(d, 'Gilt', 'je Woche')
    waehle(d, 'Für', 'Jede Person')
    fireEvent.change(feld(d, 'Wie wird gezählt?'), { target: { value: 'gespraech' } })
    speichern(d)
    await zu()
    expect(bank.schreiben).toEqual([
      {
        tabelle: 'okr_ergebnisse',
        art: 'insert',
        id: expect.any(String),
        wert: {
          ziel_id: 'z-sales',
          titel: 'Anrufe',
          zielwert: 3000,
          takt: 'woche',
          je_person: true,
          quelle: 'gespraech',
          faktor: 1,
          einheit: null,
        },
      },
    ])
    expect(await screen.findByRole('region', { name: 'Anrufe' })).toHaveTextContent(
      '3.000 je Woche · je Person · zählt von selbst',
    )
  })

  it('„3000“ und Kommazahlen gehen genauso', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    menue('Selbstdarstellung', 'Key Result hinzufügen')
    const d = await fenster('Key Result hinzufügen')
    tippe(d, 'Titel', 'Stunden')
    tippe(d, 'Zielwert', '2,5')
    waehle(d, 'Gilt', 'je Tag')
    fireEvent.keyDown(feld(d, 'Zielwert'), { key: 'Enter' })
    await zu()
    expect(bank.schreiben[0]?.wert).toMatchObject({ zielwert: 2.5, takt: 'tag', quelle: 'manuell', je_person: false })

    menue('Selbstdarstellung', 'Key Result hinzufügen')
    const d2 = await fenster('Key Result hinzufügen')
    tippe(d2, 'Titel', 'Aufrufe')
    tippe(d2, 'Zielwert', '3000')
    speichern(d2)
    await zu()
    expect(bank.schreiben[1]?.wert).toMatchObject({ titel: 'Aufrufe', zielwert: 3000 })
  })

  it('Quartals- und Jahresziele: „Gilt“ fehlt – gespeichert wird immer der ganze Zeitraum', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    menue('Erste Kunden', 'Key Result hinzufügen')
    const d = await fenster('Key Result hinzufügen')
    expect(d).toHaveTextContent('Erste Kunden · Dez. 2026 – Febr. 2027')
    expect(within(d).queryByRole('group', { name: 'Gilt' })).toBeNull()
    expect(within(d).getByRole('group', { name: 'Für' })).toBeInTheDocument()
    tippe(d, 'Titel', 'Empfehlungen')
    tippe(d, 'Zielwert', '6')
    speichern(d)
    await zu()
    expect(bank.schreiben[0]?.wert).toMatchObject({ ziel_id: 'z-quartal', takt: 'zeitraum', zielwert: 6 })
  })

  it('„Umsatz aus Neukunden“ fragt nach dem Wert je Kunde und speichert ihn als Faktor mit „€“', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    menue('Erste Kunden', 'Key Result hinzufügen')
    const d = await fenster('Key Result hinzufügen')
    tippe(d, 'Titel', 'Umsatz im Quartal')
    tippe(d, 'Zielwert', '15.000')
    fireEvent.change(feld(d, 'Wie wird gezählt?'), { target: { value: 'umsatz' } })
    // das Feld erscheint nur dann – und ist Pflicht
    expect(feld(d, 'Wert je Kunde in €').value).toBe('')
    speichern(d)
    expect(fehler(d)).toEqual(['Bitte eine Zahl über 0 eingeben'])
    expect(bank.schreiben).toEqual([])

    tippe(d, 'Wert je Kunde in €', '5.000')
    speichern(d)
    await zu()
    expect(bank.schreiben[0]?.wert).toEqual({
      ziel_id: 'z-quartal',
      titel: 'Umsatz im Quartal',
      zielwert: 15000,
      takt: 'zeitraum',
      je_person: false,
      quelle: 'im_geschaeft',
      faktor: 5000,
      einheit: '€',
    })
    // ein Neukunde im Dezember × 5.000 €
    const karte = await geladen('Erste Kunden')
    await waitFor(() =>
      expect(within(karte).getByRole('progressbar', { name: 'Umsatz im Quartal' })).toHaveAttribute(
        'aria-valuetext',
        '5.000\u202f€ / 15.000\u202f€',
      ),
    )
  })

  it('der leise Knopf in einer Karte ohne Key Result öffnet denselben Dialog', async () => {
    zeigen(<OkrSeite />, '/ziele?monat=2026-11')
    const karte = await geladen('Vorbereitung')
    fireEvent.click(within(karte).getByRole('button', { name: 'Key Result hinzufügen' }))
    const d = await fenster('Key Result hinzufügen')
    expect(d).toHaveTextContent('Vorbereitung · November 2026')
    expect(within(d).getByRole('group', { name: 'Gilt' })).toBeInTheDocument()
  })
})

describe('Key Result bearbeiten und löschen', () => {
  it('vorbelegt – „Umsatz aus Neukunden“ wird am Faktor erkannt', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    menue('Umsatz', 'Bearbeiten')
    const d = await fenster('Key Result bearbeiten')
    expect(feld(d, 'Titel').value).toBe('Umsatz')
    expect(feld(d, 'Zielwert').value).toBe('120.000')
    expect(feld(d, 'Wie wird gezählt?').value).toBe('umsatz')
    expect(feld(d, 'Wert je Kunde in €').value).toBe('5.000')
    expect(gewaehlt(d, 'Für')).toEqual(['Team zusammen'])

    // zurück auf reine Neukunden: das Feld verschwindet, Faktor 1 ohne Einheit
    fireEvent.change(feld(d, 'Wie wird gezählt?'), { target: { value: 'im_geschaeft' } })
    expect(within(d).queryByLabelText('Wert je Kunde in €')).toBeNull()
    tippe(d, 'Zielwert', '30')
    speichern(d)
    await zu()
    expect(bank.schreiben).toEqual([
      {
        tabelle: 'okr_ergebnisse',
        art: 'update',
        id: 'kr-umsatz',
        wert: {
          ziel_id: 'z-jahr',
          titel: 'Umsatz',
          zielwert: 30,
          takt: 'zeitraum',
          je_person: false,
          quelle: 'im_geschaeft',
          faktor: 1,
          einheit: null,
        },
      },
    ])
  })

  it('Monats-Key-Result: Gilt, Für und Zählart stehen so da, wie sie gespeichert sind', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    menue('DMs senden', 'Bearbeiten')
    const d = await fenster('Key Result bearbeiten')
    expect(feld(d, 'Zielwert').value).toBe('100')
    expect(gewaehlt(d, 'Gilt')).toEqual(['im ganzen Zeitraum'])
    expect(gewaehlt(d, 'Für')).toEqual(['Jede Person'])
    expect(feld(d, 'Wie wird gezählt?').value).toBe('angeschrieben')
    tippe(d, 'Zielwert', '120')
    speichern(d)
    await zu()
    expect(bank.schreiben[0]).toMatchObject({ art: 'update', id: 'kr-dms', wert: { zielwert: 120, je_person: true } })
    await waitFor(() =>
      expect(screen.getByRole('progressbar', { name: 'DMs senden · Karla' })).toHaveAttribute(
        'aria-valuetext',
        '33 / 120',
      ),
    )
  })

  it('löschen nur mit Bestätigung', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    menue('Mails senden', 'Löschen')
    const d = await fenster('Key Result löschen?')
    expect(d).toHaveTextContent('„Mails senden“ wird mit seinem Fortschritt und seinen To-dos gelöscht.')
    expect(bank.schreiben).toEqual([])
    fireEvent.click(within(d).getByRole('button', { name: 'Löschen' }))
    await zu()
    expect(bank.schreiben).toEqual([{ tabelle: 'okr_ergebnisse', art: 'delete', id: 'kr-mails' }])
    expect(toast).toHaveBeenCalledWith('Key Result gelöscht.')
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Mails senden' })).toBeNull())
  })
})

describe('Dialoge: ruhig', () => {
  it('keine Tastenmarken – auch nicht in Menü und Fenster', async () => {
    zeigen(<OkrSeite />)
    await geladen()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Menü für „Sales“' }), { key: 'Enter' })
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Key Result hinzufügen',
      'Ziel bearbeiten',
      'Ziel löschen',
    ])
    expect(document.querySelector('kbd')).toBeNull()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Key Result hinzufügen' }))
    await fenster('Key Result hinzufügen')
    expect(document.querySelector('kbd')).toBeNull()
  })
})
