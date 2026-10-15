// Runde 2 (echte Daten, 216 Leads): Zeit-Chip, Seitenkopf und Hinweis-Karte mit langen Inhalten.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ZeitChip } from './Chip'
import { HinweisKarte } from './HinweisKarte'
import { KopfStats, SeitenKopf } from './SeitenKopf'

describe('ZeitChip', () => {
  it('zeigt Überfälliges immer in Tagen (−12 T), nie als Datum, mit Datum im title', () => {
    render(<ZeitChip datum="2026-10-03" heute="2026-10-15" />)
    const chip = screen.getByText('−12 T')
    expect(chip.closest('[title]')).toHaveAttribute('title', 'Sa 03.10.')
  })

  it('−2 T, gestern, heute und Künftiges bleiben wie bisher', () => {
    const { rerender } = render(<ZeitChip datum="2026-10-13" heute="2026-10-15" />)
    expect(screen.getByText('−2 T')).toBeInTheDocument()
    rerender(<ZeitChip datum="2026-10-14" heute="2026-10-15" />)
    expect(screen.getByText('gestern')).toBeInTheDocument()
    rerender(<ZeitChip datum="2026-10-15" heute="2026-10-15" />)
    expect(screen.getByText('heute')).toBeInTheDocument()
    rerender(<ZeitChip datum="2026-10-30" heute="2026-10-15" />)
    expect(screen.getByText('Fr 30.10.')).toBeInTheDocument()
  })
})

describe('SeitenKopf', () => {
  it('Dateline ist einzeilig mit „…“ und trägt den vollen Text im title', () => {
    render(
      <SeitenKopf
        titel="Leitfäden"
        dateline="Donnerstag, 15. Oktober 2026 · KW 42 · LinkedIn · 6 Phasen · 21 Leitfäden"
      />,
    )
    const dl = screen.getByText(/LinkedIn · 6 Phasen/)
    expect(dl).toHaveClass('truncate')
    expect(dl).toHaveAttribute('title', 'Donnerstag, 15. Oktober 2026 · KW 42 · LinkedIn · 6 Phasen · 21 Leitfäden')
  })

  it('klebt unter 768 px nicht (max-md:static) und schreibt dann die Topbar-Höhe in --head-h', () => {
    render(<SeitenKopf titel="Heute" />)
    expect(screen.getByRole('banner')).toHaveClass('max-md:static')
    // jsdom kennt kein position: sticky aus Klassen → gilt als „klebt nicht“
    expect(document.documentElement.style.getPropertyValue('--head-h')).toBe('56px')
  })
})

describe('HinweisKarte', () => {
  it('kappt lange Texte auf zwei Zeilen und zeigt den vollen Text im title', () => {
    const text =
      '3 freigegebene Leads · Hannelore-Beatrix Quistorp-Wendland, Windparkentwicklung Mitteldeutschland Projektgesellschaft mbH & Co. KG'
    render(<HinweisKarte text={text} onAusblenden={() => {}} />)
    const span = screen.getByText(text)
    expect(span).toHaveClass('line-clamp-2', 'min-w-0')
    expect(span).toHaveAttribute('title', text)
  })
})

describe('KopfStats', () => {
  it('färbt nur Zahlen > 0 in Lime/Amber, eine Null bleibt neutral', () => {
    render(
      <KopfStats
        eintraege={[
          { wert: 0, label: 'fällig', ton: 'signal' },
          { wert: 4, label: 'überfällig', ton: 'overdue' },
        ]}
      />,
    )
    expect(screen.getByText('0')).toHaveClass('text-ink-bright')
    expect(screen.getByText('4')).toHaveClass('text-overdue')
  })
})

describe('Tabs', () => {
  it('blendet rechts aus, solange Tabs außerhalb liegen, und nicht mehr am Ende', async () => {
    const { Tabs } = await import('./Tabs')
    const { fireEvent } = await import('@testing-library/react')
    render(
      <Tabs
        tabs={[
          { key: 'a', label: 'Einstieg' },
          { key: 'b', label: 'Problem' },
          { key: 'c', label: 'Pitch' },
        ]}
        wert="a"
        onChange={() => {}}
      />,
    )
    const liste = screen.getByRole('tablist')
    Object.defineProperty(liste, 'scrollWidth', { configurable: true, value: 600 })
    Object.defineProperty(liste, 'clientWidth', { configurable: true, value: 320 })
    fireEvent.scroll(liste)
    expect(liste).toHaveAttribute('data-mehr-rechts', 'true')
    liste.scrollLeft = 280
    fireEvent.scroll(liste)
    expect(liste).not.toHaveAttribute('data-mehr-rechts')
  })
})

describe('Formular-Grundbausteine', () => {
  it('Input und FormField sprengen keine schmale Spalte (minmax-Spur, content-start)', async () => {
    const { Input } = await import('./Input')
    const { FormField } = await import('./FormField')
    const { container } = render(
      <FormField label="Feiertag">
        <Input aria-label="Datum" />
      </FormField>,
    )
    const feld = container.firstElementChild as HTMLElement
    expect(feld).toHaveClass('min-w-0', 'content-start')
    expect(screen.getByLabelText('Datum').closest('.grid-cols-1')).toHaveClass('min-w-0')
  })

  it('Seitenkopf: rechte Gruppe darf schrumpfen und umbrechen', () => {
    render(<SeitenKopf titel="Leads" rechts={<KopfStats eintraege={[{ wert: 1, label: 'gesamt' }]} />} />)
    const stats = screen.getByText('gesamt').parentElement as HTMLElement
    expect(stats.parentElement).toHaveClass('min-w-0', 'max-w-full')
    expect(stats).toHaveClass('max-md:flex-wrap')
  })
})

describe('Integration Runde 2', () => {
  it('Button secondary hat einen sichtbaren Rahmen (kein border-transparent in der Basis)', async () => {
    const { Button } = await import('./Button')
    render(
      <>
        <Button>Tour erneut starten</Button>
        <Button variante="quiet">Leise</Button>
      </>,
    )
    const sekundaer = screen.getByRole('button', { name: 'Tour erneut starten' })
    expect(sekundaer).toHaveClass('border', 'border-line-strong')
    expect(sekundaer).not.toHaveClass('border-transparent')
    expect(screen.getByRole('button', { name: 'Leise' })).toHaveClass('border-transparent')
  })

  it('Seitenkopf: automatische Dateline lang ab 768 px, kurz („Do 15.10. · KW 42“) darunter, Kontext einmal', () => {
    render(<SeitenKopf titel="Hilfe" kontext="Handbuch" />)
    const dl = screen.getByText(/· Handbuch/)
    const [lang, kurz] = Array.from(dl.querySelectorAll('span'))
    expect(lang).toHaveClass('max-md:hidden')
    expect(lang?.textContent).toMatch(/^[A-Z][a-z]+, \d{1,2}\. [A-Z][a-zä]+ \d{4} · KW \d{1,2}$/)
    expect(kurz).toHaveClass('md:hidden')
    expect(kurz?.textContent).toMatch(/^[A-Z][a-z] \d{2}\.\d{2}\. · KW \d{1,2}$/)
    expect(dl.getAttribute('title')).toMatch(/· Handbuch$/)
  })
})
