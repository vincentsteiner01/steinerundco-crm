// oxlint-disable react/only-export-components -- Test-Hilfe: die kleine Komponente „Ort“ steht neben Daten und Funktionen
// Test-Hilfen des Reiters „Ziele“: eine kleine Datenbank im Speicher hinter dem gemockten Supabase-Client (die vier OKR-Tabellen,
// v_kpi_tage nach Zeitraum, Mitglieder, die zwei Funktionen okr_zaehlen und okr_monat_uebernehmen) und die Render-Hülle mit
// QueryClient und Router. Schreibvorgänge wirken auf die Daten – das Neuladen nach dem Speichern zeigt also den neuen Stand –
// und stehen im Protokoll `bank.schreiben`. Nur erfundene Personen und Ziele. „Heute“ ist Donnerstag, der 10.12.2026 (KW 50).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { vi, type Mock } from 'vitest'
import { gezaehlt } from '@/data/okr'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import { leereSummen, type KpiZeile, type Summen } from '@/features/kpis/kennzahlen'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { kette, type Antwort } from '@/test/supabaseMock'
import type { OkrEintrag, OkrErgebnis, OkrTodo, OkrZiel } from './rechnen'

export const JETZT = new Date('2026-12-10T09:00:00+01:00')
export const HEUTE = '2026-12-10'
/** Karla Kennzahl ist angemeldet; Bodo Beispiel ist die zweite Person. Die Seite zeigt sie nach Namen: Bodo · Karla. */
export const KARLA = MEMBER_V
export const BODO = MEMBER_M
export const MITGLIEDER = [
  { id: BODO, display_name: 'Bodo Beispiel', short_name: 'BB', email: 'bodo@beispiel.test' },
  { id: KARLA, display_name: 'Karla Kennzahl', short_name: 'KK', email: 'karla@beispiel.test' },
]
export const KAPUTT: Antwort = { data: null, error: { message: 'Verbindung unterbrochen', code: 'XX000' } }

export const ziel = (id: string, titel: string, o: Partial<OkrZiel> = {}): OkrZiel => ({
  id,
  titel,
  ebene: 'monat',
  von: '2026-12-01',
  bis: '2026-12-31',
  position: 0,
  ...o,
})
export const ergebnis = (id: string, ziel_id: string, titel: string, o: Partial<OkrErgebnis> = {}): OkrErgebnis => ({
  id,
  ziel_id,
  titel,
  zielwert: 100,
  takt: 'zeitraum',
  je_person: false,
  quelle: 'manuell',
  faktor: 1,
  einheit: null,
  position: 0,
  ...o,
})
const kpi = (member_id: string | null, tag: string, werte: Partial<Summen>): KpiZeile => ({
  member_id,
  tag,
  period: 'tag',
  ...leereSummen(),
  ...werte,
})

export type Schreibvorgang = {
  tabelle: string
  art: 'insert' | 'update' | 'delete'
  id?: string
  wert?: Record<string, unknown>
}

export type Bank = {
  okr_ziele: OkrZiel[]
  okr_ergebnisse: OkrErgebnis[]
  okr_eintraege: OkrEintrag[]
  okr_todos: OkrTodo[]
  kpi: KpiZeile[]
  mitglieder: unknown[]
  /** Tabellen, die gerade mit einem Fehler antworten */
  kaputt: Set<string>
  schreiben: Schreibvorgang[]
  /** jede Abfrage an v_kpi_tage */
  kpiAbfragen: { von: string; bis: string }[]
  /** gesetzt: v_kpi_tage antwortet erst, wenn der Test `kpiAntworten()` aufruft */
  kpiWarten: (() => void)[] | null
}

/**
 * Der Stand am 10.12.2026:
 * Jahr „Wachsen“ (Dez. 2026 – Nov. 2027): Zahlende Neukunden 1 / 24 · Umsatz 5.000 € / 120.000 € → 4 %
 * Quartal „Erste Kunden“ (Dez. 2026 – Febr. 2027): Neukunden im Quartal 1 / 3 → 33 %
 * Dezember „Sales“: DMs senden 100 je Person (Bodo 5 · Karla 33, diese Woche 13, heute 3) · Mails senden 3.000 fürs Team (750)
 * Dezember „Selbstdarstellung“: LinkedIn-Posts 4 je Person von Hand (Bodo 2 · Karla 1) · Kommentare 40 fürs Team von Hand (12, von Bodo)
 * November „Vorbereitung“ ohne Key Result. Januar 2027 hat keine Monatsziele.
 */
export function neueBank(): Bank {
  return {
    okr_ziele: [
      ziel('z-nov', 'Vorbereitung', { von: '2026-11-01', bis: '2026-11-30' }),
      ziel('z-jahr', 'Wachsen', { ebene: 'jahr', bis: '2027-11-30' }),
      ziel('z-quartal', 'Erste Kunden', { ebene: 'quartal', bis: '2027-02-28' }),
      ziel('z-sales', 'Sales', { position: 0 }),
      ziel('z-selbst', 'Selbstdarstellung', { position: 1 }),
    ],
    okr_ergebnisse: [
      ergebnis('kr-kunden', 'z-jahr', 'Zahlende Neukunden', { zielwert: 24, quelle: 'im_geschaeft' }),
      ergebnis('kr-umsatz', 'z-jahr', 'Umsatz', {
        zielwert: 120000,
        quelle: 'im_geschaeft',
        faktor: 5000,
        einheit: '€',
        position: 1,
      }),
      ergebnis('kr-quartal', 'z-quartal', 'Neukunden im Quartal', { zielwert: 3, quelle: 'im_geschaeft' }),
      ergebnis('kr-dms', 'z-sales', 'DMs senden', { je_person: true, quelle: 'angeschrieben' }),
      ergebnis('kr-mails', 'z-sales', 'Mails senden', { zielwert: 3000, quelle: 'emails_gesendet', position: 1 }),
      ergebnis('kr-posts', 'z-selbst', 'LinkedIn-Posts', { zielwert: 4, je_person: true }),
      ergebnis('kr-kommentare', 'z-selbst', 'Kommentare', { zielwert: 40, position: 1 }),
    ],
    okr_eintraege: [
      { ergebnis_id: 'kr-posts', member_id: KARLA, tag: '2026-12-04', wert: 1 },
      { ergebnis_id: 'kr-posts', member_id: BODO, tag: '2026-12-08', wert: 2 },
      { ergebnis_id: 'kr-kommentare', member_id: BODO, tag: '2026-12-09', wert: 12 },
    ],
    okr_todos: [
      {
        id: 't-skript',
        ergebnis_id: 'kr-posts',
        text: 'Skript schreiben',
        member_id: KARLA,
        erledigt_at: null,
        position: 0,
      },
      {
        id: 't-bilder',
        ergebnis_id: 'kr-posts',
        text: 'Bilder aussuchen',
        member_id: null,
        erledigt_at: '2026-12-08T10:00:00+00:00',
        position: 1,
      },
    ],
    kpi: [
      // ein Tag vor allen Zielen: zählt nirgends
      kpi(KARLA, '2026-11-27', { angeschrieben: 50, im_geschaeft: 3 }),
      kpi(KARLA, '2026-12-01', { angeschrieben: 20 }),
      kpi(BODO, '2026-12-02', { angeschrieben: 5 }),
      kpi(KARLA, '2026-12-03', { im_geschaeft: 1 }),
      kpi(null, '2026-12-07', { emails_gesendet: 600 }),
      kpi(KARLA, '2026-12-08', { angeschrieben: 10 }),
      kpi(KARLA, '2026-12-10', { angeschrieben: 3 }),
      kpi(null, '2026-12-10', { emails_gesendet: 150 }),
    ],
    mitglieder: MITGLIEDER,
    kaputt: new Set(),
    schreiben: [],
    kpiAbfragen: [],
    kpiWarten: null,
  }
}

type OkrTabelle = 'okr_ziele' | 'okr_ergebnisse' | 'okr_eintraege' | 'okr_todos'
const OKR_TABELLEN: readonly string[] = ['okr_ziele', 'okr_ergebnisse', 'okr_eintraege', 'okr_todos']
type Zeile = Record<string, unknown>
let neuNr = 0

/** from('okr_…'): liest den aktuellen Stand; insert/update/delete wirken auf ihn und stehen im Protokoll. */
function okrKette(bank: Bank, tabelle: OkrTabelle) {
  const k = kette()
  const zeilen = () => bank[tabelle] as unknown as Zeile[]
  const setze = (neu: Zeile[]) => {
    ;(bank as unknown as Record<string, Zeile[]>)[tabelle] = neu
  }
  let offen: { art: 'insert' | 'update' | 'delete'; wert?: Zeile } | null = null
  const antwort = (data: unknown): Antwort => (bank.kaputt.has(tabelle) ? KAPUTT : { data, error: null })
  const schreibe = (id?: string) => {
    if (!offen || bank.kaputt.has(tabelle)) return
    const { art, wert } = offen
    offen = null
    if (art === 'insert') {
      neuNr += 1
      const neuId = `neu-${neuNr}`
      setze([...zeilen(), { id: neuId, position: 99, erledigt_at: null, ...wert }])
      bank.schreiben.push({ tabelle, art, id: neuId, wert })
    } else if (art === 'update') {
      setze(zeilen().map((z) => (z['id'] === id ? { ...z, ...wert } : z)))
      bank.schreiben.push({ tabelle, art, id, wert })
    } else {
      setze(zeilen().filter((z) => z['id'] !== id))
      bank.schreiben.push({ tabelle, art, id })
    }
  }
  k['insert'] = vi.fn((wert: Zeile) => {
    offen = { art: 'insert', wert }
    return k
  })
  k['update'] = vi.fn((wert: Zeile) => {
    offen = { art: 'update', wert }
    return k
  })
  k['delete'] = vi.fn(() => {
    offen = { art: 'delete' }
    return k
  })
  k['eq'] = vi.fn((spalte: string, wert: string) => {
    if (spalte === 'id' && offen && offen.art !== 'insert') schreibe(wert)
    return k
  })
  k['single'] = vi.fn(async () => {
    schreibe()
    return antwort({ id: 'x' })
  })
  k['then'] = (res: (a: Antwort) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(antwort(zeilen())).then(res, rej)
  return k
}

/** from('v_kpi_tage'): antwortet nach dem Zeitraum (tag von/bis) und merkt sich die Abfrage. */
function kpiKette(bank: Bank) {
  const k = kette()
  k['then'] = (res: (a: Antwort) => unknown, rej?: (e: unknown) => unknown) => {
    const von = (k['gte'] as Mock).mock.calls[0]?.[1] as string
    const bis = (k['lte'] as Mock).mock.calls[0]?.[1] as string
    bank.kpiAbfragen.push({ von, bis })
    const antwort: Antwort = bank.kaputt.has('v_kpi_tage')
      ? KAPUTT
      : { data: bank.kpi.filter((z) => z.tag >= von && z.tag <= bis), error: null }
    const fertig = bank.kpiWarten ? new Promise<void>((r) => bank.kpiWarten?.push(r)) : Promise.resolve()
    return fertig.then(() => antwort).then(res, rej)
  }
  return k
}

export function kpiAntworten(bank: Bank): void {
  const offen = bank.kpiWarten ?? []
  bank.kpiWarten = null
  for (const weiter of offen) weiter()
}

/** Verbindet den gemockten Supabase-Client mit der Bank und meldet Karla an. */
export function richteEin(bank: Bank): void {
  useAuth.setState({
    status: 'mitglied',
    member: { user_id: KARLA, email: 'karla@beispiel.test', display_name: 'Karla Kennzahl' },
  })
  vi.mocked(supabase.from)
    .mockReset()
    .mockImplementation(((tabelle: string) => {
      if (OKR_TABELLEN.includes(tabelle)) return okrKette(bank, tabelle as OkrTabelle)
      if (tabelle === 'v_kpi_tage') return kpiKette(bank)
      if (tabelle === 'members')
        return kette(bank.kaputt.has('members') ? KAPUTT : { data: bank.mitglieder, error: null })
      return kette()
    }) as never)
  vi.mocked(supabase.rpc)
    .mockReset()
    .mockImplementation((async (name: string, args: Record<string, unknown>) => {
      if (name === 'okr_zaehlen') {
        bank.okr_eintraege = gezaehlt(
          bank.okr_eintraege,
          args['p_ergebnis'] as string,
          args['p_member'] as string,
          args['p_delta'] as number,
          HEUTE,
        )
        return { data: 0, error: null }
      }
      if (name === 'okr_monat_uebernehmen') {
        const von = args['p_von'] as string
        const nach = args['p_nach'] as string
        const kopien = bank.okr_ziele
          .filter((z) => z.ebene === 'monat' && z.von === von)
          .map((z) => ({ ...z, id: `${z.id}-kopie`, von: nach, bis: `${nach.slice(0, 7)}-28` }))
        bank.okr_ziele = [...bank.okr_ziele, ...kopien]
        return { data: kopien.length, error: null }
      }
      return { data: null, error: null }
    }) as never)
}

/** Die Aufrufe einer Datenbank-Funktion als Liste ihrer Argumente. */
export const aufrufe = (name: string): Record<string, unknown>[] =>
  vi
    .mocked(supabase.rpc)
    .mock.calls.map((c) => c as unknown as [string, Record<string, unknown>])
    .filter(([n]) => n === name)
    .map(([, a]) => a)

function Ort() {
  const { pathname, search } = useLocation()
  // bewusst kein <output>: das trüge die Rolle „status“ wie der Lade-Platzhalter
  return <span data-testid="ort">{pathname + search}</span>
}

export const ort = (): string | null => screen.getByTestId('ort').textContent

/** Öffnet das Menü „⋯“ eines Ziels oder Key Results (über die Tastatur – jsdom kennt keine Zeigerereignisse) und wählt einen Eintrag. */
export function menue(titel: string, eintrag: string): void {
  fireEvent.keyDown(screen.getByRole('button', { name: `Menü für „${titel}“` }), { key: 'Enter' })
  fireEvent.click(screen.getByRole('menuitem', { name: eintrag }))
}

/** Rendert ein Element unter /ziele mit QueryClient und Router; die Adresse steht in `ort()`. */
export function zeigen(element: ReactElement, url = '/ziele') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/ziele" element={element} />
        </Routes>
        <Ort />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return qc
}
