// Baum: Phasenköpfe mit Mono-Ziffer + Untertitel (LF-11), Einträge mit Nutzung, Chips „Standard für Schritt 2“ und „inaktiv“,
// Cursor, Klick/Doppelklick/Enter, zehn Telefon-Phasen (LF-09), E-Mail-Baum (LF-10), Suche ohne Treffer.
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VORLAGE } from '@/lib/vorlagenKeys'
import type { TemplatePerformance } from '@/types/domain'
import { ALLE, EMAIL, JA_V1_ID, PERF } from './_testHilfe'
import { Baum, type Verwendung } from './Baum'

const perf = new Map<string, TemplatePerformance>(PERF.map((p) => [p.template_id as string, p]))
const verwendungen = new Map<string, Verwendung[]>([[JA_V1_ID, [{ sequenzName: 'A', position: 2 }]]])

function rendern(props: Partial<Parameters<typeof Baum>[0]> = {}) {
  const onCursor = vi.fn()
  const onOeffnen = vi.fn()
  render(
    <Baum
      kanal="linkedin"
      vorlagen={ALLE}
      perf={perf}
      verwendungen={verwendungen}
      q=""
      cursorId={JA_V1_ID}
      onCursor={onCursor}
      onOeffnen={onOeffnen}
      {...props}
    />,
  )
  return { onCursor, onOeffnen }
}

describe('Baum', () => {
  it('LinkedIn: Phasenköpfe mit Ziffer, Label, Zweck (LF-11) und Zähler; leere Phase zeigt „–“', () => {
    rendern()
    const tree = screen.getByRole('tree', { name: 'Leitfäden' })
    const gruppen = within(tree).getAllByRole('group')
    expect(gruppen.map((g) => g.getAttribute('aria-label'))).toEqual([
      'Vernetzung',
      'Gesprächseröffnung',
      'Bedarfsermittlung',
      'Pitch',
      'Follow-ups',
      'Langfristig',
    ])
    expect(within(gruppen[1] as HTMLElement).getByText('Problem erkennen & Antwort auslösen')).toBeInTheDocument()
    expect(
      within(gruppen[2] as HTMLElement).getByText('Bedarf, Priorität & Einwände qualifizieren'),
    ).toBeInTheDocument()
    expect(
      within(gruppen[3] as HTMLElement).getByText('Unverbindliches 15-Min.-Gespräch vereinbaren'),
    ).toBeInTheDocument()
    expect(within(gruppen[4] as HTMLElement).getByText('Nicht-Antworter erneut aktivieren')).toBeInTheDocument()
    expect(within(gruppen[1] as HTMLElement).getByText('1')).toHaveClass('font-mono')
    expect(within(gruppen[0] as HTMLElement).getByText('–')).toBeInTheDocument()
    expect(within(gruppen[2] as HTMLElement).getByText('9')).toBeInTheDocument() // 8 aktive + 1 inaktive
  })

  it('Einträge: Nutzung Mono rechts, Chips „Standard für Schritt 2“ und „inaktiv“, Cursor markiert', () => {
    rendern()
    const jaV1 = screen.getByRole('treeitem', { name: /Ja \(V1\)/ })
    expect(jaV1).toHaveAttribute('aria-selected', 'true')
    expect(jaV1).toHaveAttribute('data-cursor', 'true')
    expect(within(jaV1).getByText('Standard für Schritt 2')).toBeInTheDocument()
    expect(within(jaV1).getByLabelText('Nutzung')).toHaveTextContent(/12 · 25\s%/)
    const v2 = screen.getByRole('treeitem', { name: /Gesprächseröffnung \(V2\)/ })
    expect(within(v2).getByText('inaktiv')).toBeInTheDocument()
    expect(within(v2).getByLabelText('Nutzung')).toHaveTextContent('–')
    expect(v2).toHaveAttribute('aria-selected', 'false')
  })

  it('Klick setzt den Cursor, Doppelklick und Enter öffnen', () => {
    const { onCursor, onOeffnen } = rendern()
    const pitchA = screen.getByRole('treeitem', { name: /Pitch A/ })
    fireEvent.click(pitchA)
    expect(onCursor).toHaveBeenCalledWith(pitchA.getAttribute('data-id'))
    fireEvent.doubleClick(pitchA)
    expect(onOeffnen).toHaveBeenCalledWith(pitchA.getAttribute('data-id'))
    fireEvent.keyDown(pitchA, { key: 'Enter' })
    expect(onOeffnen).toHaveBeenCalledTimes(2)
  })

  it('LF-09: Telefon zeigt die zehn Phasen in phasen.ts-Reihenfolge', () => {
    rendern({ kanal: 'telefon', cursorId: null })
    const gruppen = screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))
    expect(gruppen).toEqual([
      'Zentrale',
      'Einstieg',
      'Problem',
      'Qualifizierung',
      'Pitch',
      'Einwände',
      'Abschluss',
      'Mailbox',
      'Rückruf',
      'Datenschutz',
    ])
    expect(screen.getAllByRole('treeitem')).toHaveLength(10)
  })

  it('LF-10: E-Mail-Baum zeigt zehn Vorlagen inkl. Strategiegespräch-Zusammenfassung und No-Show unter Transaktional', () => {
    rendern({ kanal: 'email', cursorId: null })
    expect(screen.getAllByRole('treeitem')).toHaveLength(10)
    const transaktional = screen.getByRole('group', { name: 'Transaktional' })
    expect(
      within(transaktional).getByText(EMAIL.find((t) => t.key === VORLAGE.em_noshow_erstgespraech)?.name ?? '?'),
    ).toBeInTheDocument()
    const zusammenfassung = screen.getByRole('group', { name: 'Zusammenfassung' })
    expect(
      within(zusammenfassung).getByText(
        EMAIL.find((t) => t.key === VORLAGE.em_strategiegespraech_zusammenfassung)?.name ?? '?',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Organisatorisch, keine Werbeinhalte')).toBeInTheDocument()
  })

  it('Suche: nur Phasen mit Treffern; ohne Treffer Hinweis; Phase-Filter', () => {
    const { unmount } = render(
      <Baum
        kanal="linkedin"
        vorlagen={ALLE}
        perf={perf}
        verwendungen={verwendungen}
        q="pitch"
        cursorId={null}
        onCursor={() => {}}
        onOeffnen={() => {}}
      />,
    )
    expect(screen.getAllByRole('group')).toHaveLength(1)
    expect(screen.getAllByRole('treeitem')).toHaveLength(2)
    unmount()
    render(
      <Baum
        kanal="linkedin"
        vorlagen={ALLE}
        perf={perf}
        verwendungen={verwendungen}
        q="gibtsnicht"
        cursorId={null}
        onCursor={() => {}}
        onOeffnen={() => {}}
      />,
    )
    expect(screen.getByText('Nichts gefunden für ‚gibtsnicht‘.')).toBeInTheDocument()
    cleanupAndFilter()
  })
})

function cleanupAndFilter() {
  render(
    <Baum
      kanal="linkedin"
      vorlagen={ALLE}
      perf={perf}
      verwendungen={verwendungen}
      q=""
      phase="pitch"
      cursorId={null}
      onCursor={() => {}}
      onOeffnen={() => {}}
    />,
  )
  expect(screen.getByRole('group', { name: 'Pitch' })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Bedarfsermittlung' })).not.toBeInTheDocument()
}
