// DataTable: 200 Zeilen virtualisiert, Cursor J/K, Auswahl Space/⇧↓/⌘A/Esc, Gruppierung, Sortierung, E/Doppelklick (BAUPLAN § 3.1.10)
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/app/uiStore'
import { _akkordZuruecksetzen } from '@/lib/keyboard'
import { DataTable, type DataTableProps } from './DataTable'
import { SPALTEN_BREITE, spaltenHelper, type DataTableSpalte } from './spalten'

type Zeile = { id: string; name: string; firma: string; datum: string | null; faellig: 'today' | 'overdue' | null }

const h = spaltenHelper<Zeile>()
const SPALTEN: DataTableSpalte<Zeile>[] = h.columns([
  h.accessor('name', { header: 'Name', meta: { oeffnet: true, breite: SPALTEN_BREITE.name } }),
  h.accessor('firma', { header: 'Unternehmen', meta: { editierbar: true, breite: SPALTEN_BREITE.unternehmen } }),
  h.accessor('datum', {
    header: 'Nächste Aktion',
    meta: { editierbar: true, rechts: true, mono: true },
    cell: (c) => c.getValue() ?? '–',
  }),
])

function zeilen(n: number): Zeile[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `z${String(i + 1).padStart(3, '0')}`,
    name: `Test Person ${String(i + 1).padStart(2, '0')}`,
    firma: `Solar ${i + 1} GmbH`,
    datum: i % 3 === 0 ? '2026-10-15' : i % 3 === 1 ? '2026-10-12' : null,
    faellig: i % 3 === 0 ? 'today' : i % 3 === 1 ? 'overdue' : null,
  }))
}

/** Hält Cursor und Auswahl wie eine Seite (M2) und reicht alles durch. */
function Harness(props: Partial<DataTableProps<Zeile>> & { daten: Zeile[]; onCursorSpy?: (id: string) => void }) {
  const [cursor, setCursor] = useState<string | null>(props.cursorId ?? null)
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set())
  return (
    <DataTable<Zeile>
      spalten={SPALTEN}
      rowId={(r) => r.id}
      cursorId={cursor}
      onCursor={(id) => {
        setCursor(id)
        props.onCursorSpy?.(id)
      }}
      auswahl={auswahl}
      onAuswahl={setAuswahl}
      zeitBalken={(r) => r.faellig}
      {...props}
    />
  )
}

const taste = (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(document.body, { key, ...init })

describe('DataTable', () => {
  beforeEach(() => {
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [], peekLeadId: null, peekListe: [] })
    _akkordZuruecksetzen()
    // jsdom kennt window.scrollTo nicht (Virtualizer.scrollToIndex beim Cursorwechsel)
    Object.defineProperty(window, 'scrollTo', { configurable: true, writable: true, value: vi.fn() })
  })

  it('rendert 200 Zeilen virtualisiert (nur ein Fenster im DOM, aria-rowcount vollständig)', () => {
    render(<Harness daten={zeilen(200)} />)
    const tabelle = screen.getByRole('table')
    expect(tabelle).toHaveAttribute('aria-rowcount', '200')
    const imDom = tabelle.querySelectorAll('tr[data-id]')
    expect(imDom.length).toBeGreaterThan(0)
    expect(imDom.length).toBeLessThan(200)
    expect(screen.getByText('Test Person 01')).toBeInTheDocument()
    expect(screen.queryByText('Test Person 99')).not.toBeInTheDocument()
  })

  it('rendert unter 100 Zeilen alles und trägt Zeitbalken + Breiten', () => {
    render(<Harness daten={zeilen(12)} />)
    const tabelle = screen.getByRole('table')
    expect(tabelle.querySelectorAll('tr[data-id]')).toHaveLength(12)
    expect(tabelle.querySelector('tr[data-id="z001"]')).toHaveAttribute('data-zeit', 'today')
    expect(tabelle.querySelector('tr[data-id="z002"]')).toHaveAttribute('data-zeit', 'overdue')
    const cols = tabelle.querySelectorAll('col')
    expect(cols).toHaveLength(4) // Auswahl + 3
    expect(cols[0]).toHaveStyle({ width: '28px' })
    expect(cols[1]).toHaveStyle({ width: '16%' })
  })

  it('bewegt den Cursor mit J/K und ↓/↑ und markiert die Zeile (aria-selected)', () => {
    const spy = vi.fn()
    render(<Harness daten={zeilen(5)} onCursorSpy={spy} />)
    taste('j')
    expect(spy).toHaveBeenLastCalledWith('z001')
    taste('j')
    expect(spy).toHaveBeenLastCalledWith('z002')
    taste('ArrowDown')
    expect(spy).toHaveBeenLastCalledWith('z003')
    taste('k')
    expect(spy).toHaveBeenLastCalledWith('z002')
    taste('ArrowUp')
    expect(spy).toHaveBeenLastCalledWith('z001')
    taste('k') // bleibt oben stehen
    expect(spy).toHaveBeenLastCalledWith('z001')
    const zeile = screen.getByRole('table').querySelector('tr[data-id="z001"]')
    expect(zeile).toHaveAttribute('aria-selected', 'true')
  })

  it('Enter öffnet die Cursor-Zeile, Klick auf die Name-Zelle (oeffnet) ebenfalls', () => {
    const onEnter = vi.fn()
    render(<Harness daten={zeilen(3)} onEnter={onEnter} />)
    taste('j')
    taste('Enter')
    expect(onEnter).toHaveBeenCalledWith(expect.objectContaining({ id: 'z001' }))
    fireEvent.click(screen.getByText('Test Person 03'))
    expect(onEnter).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'z003' }))
  })

  it('wählt aus: Space, ⇧↓ Bereich, ⌘A alle sichtbaren, Esc hebt auf, Checkbox mit ⇧Klick', () => {
    render(<Harness daten={zeilen(6)} />)
    const tabelle = screen.getByRole('table')
    const gewaehlt = () =>
      Array.from(tabelle.querySelectorAll('tr[data-ausgewaehlt]')).map((t) => t.getAttribute('data-id'))
    taste('j')
    taste(' ')
    expect(gewaehlt()).toEqual(['z001'])
    taste('ArrowDown', { shiftKey: true })
    taste('ArrowDown', { shiftKey: true })
    expect(gewaehlt()).toEqual(['z001', 'z002', 'z003'])
    taste('Escape')
    expect(gewaehlt()).toEqual([])
    taste('a', { metaKey: true })
    expect(gewaehlt()).toHaveLength(6)
    expect(screen.getByLabelText('Alle sichtbaren auswählen')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Alle sichtbaren auswählen'))
    expect(gewaehlt()).toEqual([])
    const boxen = screen.getAllByLabelText('Auswählen')
    fireEvent.click(boxen[1] as HTMLElement)
    fireEvent.click(boxen[4] as HTMLElement, { shiftKey: true })
    expect(gewaehlt()).toEqual(['z002', 'z003', 'z004', 'z005'])
  })

  it('Esc hebt die Auswahl nicht auf, solange ein Peek offen ist (eine Ebene je Druck)', () => {
    render(<Harness daten={zeilen(3)} />)
    taste('j')
    taste(' ')
    useUiStore.setState({ peekLeadId: 'z001' })
    taste('Escape')
    expect(screen.getByRole('table').querySelectorAll('tr[data-ausgewaehlt]')).toHaveLength(1)
  })

  it('offener Peek: Tab/⇧Tab bleiben beim Dialog (kein preventDefault), E und Space wirken nicht auf die Zeile dahinter – Review', () => {
    const onZelle = vi.fn()
    render(<Harness daten={zeilen(3)} onZelleBearbeiten={onZelle} />)
    taste('j')
    useUiStore.setState({ peekLeadId: 'z001' })
    expect(taste('Tab')).toBe(true) // true = Standardverhalten (Fokusfalle des Peek) bleibt
    expect(taste('Tab', { shiftKey: true })).toBe(true)
    taste('e')
    taste(' ')
    expect(onZelle).not.toHaveBeenCalled()
    expect(screen.getByRole('table').querySelectorAll('tr[data-ausgewaehlt]')).toHaveLength(0)
    useUiStore.setState({ peekLeadId: null })
    expect(taste('Tab')).toBe(false)
    taste('e')
    expect(onZelle).toHaveBeenCalledTimes(1)
  })

  it('gruppiert mit Kopfzeilen und Zählern (Überfällig Amber) und klappt ein', () => {
    const daten = zeilen(9)
    render(
      <Harness
        daten={daten}
        gruppierung={{
          key: (r) => r.faellig ?? 'ohne',
          label: (k) => ({ today: 'Heute', overdue: 'Überfällig', ohne: 'Ohne' })[k] ?? k,
        }}
      />,
    )
    const tabelle = screen.getByRole('table')
    const gruppen = tabelle.querySelectorAll('tr[data-gruppe]')
    expect(gruppen).toHaveLength(3)
    expect(gruppen[0]).toHaveAttribute('data-gruppe', 'today')
    const ueberfaellig = tabelle.querySelector('tr[data-gruppe="overdue"]') as HTMLElement
    expect(within(ueberfaellig).getByText('Überfällig')).toBeInTheDocument()
    expect(within(ueberfaellig).getByText('3')).toHaveClass('text-overdue')
    const heute = tabelle.querySelector('tr[data-gruppe="today"]') as HTMLElement
    expect(within(heute).getByText('3')).not.toHaveClass('text-overdue')
    expect(tabelle.querySelectorAll('tr[data-id]')).toHaveLength(9)
    fireEvent.click(within(heute).getByRole('button', { expanded: true }))
    expect(tabelle.querySelectorAll('tr[data-id]')).toHaveLength(6)
    expect(within(heute).getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    // Cursor überspringt eingeklappte Zeilen
    taste('j')
    expect(tabelle.querySelector('tr[aria-selected="true"]')).toHaveAttribute('data-id', 'z002')
  })

  it('Sortierung: Klick auf den Kopf meldet den Zustand (gesteuert = manuell), ungesteuert sortiert clientseitig', () => {
    const onSortierung = vi.fn()
    const { unmount } = render(<Harness daten={zeilen(3)} sortierung={[]} onSortierung={onSortierung} />)
    fireEvent.click(screen.getByRole('button', { name: /^Name/ }))
    expect(onSortierung).toHaveBeenCalledWith([{ id: 'name', desc: false }])
    unmount()
    render(<Harness daten={zeilen(3)} />)
    fireEvent.click(screen.getByRole('button', { name: /^Name/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Name/ }))
    const namen = Array.from(screen.getByRole('table').querySelectorAll('tr[data-id]')).map((t) =>
      t.getAttribute('data-id'),
    )
    expect(namen).toEqual(['z003', 'z002', 'z001'])
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending')
  })

  it('E bearbeitet die aktive bzw. erste editierbare Zelle, Tab wechselt die Spalte, Doppelklick ebenfalls', () => {
    const onZelle = vi.fn()
    render(<Harness daten={zeilen(3)} onZelleBearbeiten={onZelle} />)
    taste('j')
    taste('e')
    expect(onZelle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'z001' }), 'firma')
    taste('Tab')
    taste('e')
    expect(onZelle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'z001' }), 'datum')
    fireEvent.doubleClick(screen.getByText('Solar 2 GmbH'))
    expect(onZelle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'z002' }), 'firma')
    fireEvent.doubleClick(screen.getByText('Test Person 02')) // nicht editierbar
    expect(onZelle).toHaveBeenCalledTimes(3)
  })

  it('zeigt den leeren Zustand und die Nachlade-Zeile', () => {
    const { rerender } = render(<Harness daten={[]} leer={<p>Kein Lead passt.</p>} />)
    expect(screen.getByText('Kein Lead passt.')).toBeInTheDocument()
    rerender(<Harness daten={zeilen(2)} hatMehr ladeMehr={() => {}} />)
    expect(screen.getByText('Lade weitere …')).toBeInTheDocument()
  })

  it('rendert < 768 px die Liste mit mobilZeile', () => {
    const alt = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q: string) => ({
        matches: q.includes('767'),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })
    try {
      render(<Harness daten={zeilen(3)} mobilZeile={(r) => <span>{r.name} mobil</span>} />)
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.getByText('Test Person 01 mobil')).toBeInTheDocument()
      expect(screen.getByRole('list').querySelectorAll('[data-id]')).toHaveLength(3)
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: alt })
    }
  })
})

describe('DataTable – Runde 2: Spaltenköpfe', () => {
  it('sortierbare Köpfe kürzen mit „…“ und tragen den vollen Namen im title', () => {
    render(<Harness daten={zeilen(3)} />)
    const knopf = screen.getByTitle(/^Nächste Aktion – sortieren/)
    expect(knopf).toHaveClass('max-w-full', 'min-w-0')
    expect(within(knopf).getByText('Nächste Aktion')).toHaveClass('truncate')
  })

  it('meta.kopfTitel ersetzt den Kopftext im title (sortierbar) bzw. steht am <th> (nicht sortierbar)', () => {
    const spalten: DataTableSpalte<Zeile>[] = h.columns([
      h.accessor('name', { header: 'Name', meta: { kopfTitel: 'Name der Person' } }),
      h.accessor('firma', { header: 'Firma', enableSorting: false, meta: { kopfTitel: 'Firma laut Import' } }),
    ])
    render(<Harness daten={zeilen(1)} spalten={spalten} />)
    expect(screen.getByTitle('Name der Person – sortieren · ⇧Klick: sekundär')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Firma' })).toHaveAttribute('title', 'Firma laut Import')
  })

  it('Kopf klebt nur ≥ 1280 px; <col> blendet mit der Spalte aus; minBreite steuert die Querscroll-Breite', () => {
    const spalten: DataTableSpalte<Zeile>[] = h.columns([
      h.accessor('name', { header: 'Name' }),
      h.accessor('firma', { header: 'Unternehmen', meta: { ausblenden: 'xl', breite: '13%' } }),
    ])
    const { container, unmount } = render(<Harness daten={zeilen(2)} spalten={spalten} />)
    const th = screen.getByRole('columnheader', { name: /Name/ })
    expect(th.className).toContain('xl:sticky')
    expect(th.className.split(/\s+/)).not.toContain('sticky')
    const cols = container.querySelectorAll('col')
    expect(cols[cols.length - 1]).toHaveClass('max-xl:hidden')
    expect(container.querySelector('table')?.style.getPropertyValue('--min-breite')).toBe('1040px')
    unmount()
    const r = render(<Harness daten={zeilen(2)} spalten={spalten} minBreite={null} />)
    expect(r.container.querySelector('table')?.style.getPropertyValue('--min-breite')).toBe('0px')
  })
})
