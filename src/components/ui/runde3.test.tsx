// Sichtprüfung Runde 3 (echte Daten): eingerasteter Seitenkopf hält den Titel einzeilig (/kpis 1440: „Oktober / 2026“),
// sortierbare Tabellenköpfe dürfen zweizeilig umbrechen (/kpis „OHNE BE…“, Sperrliste „Unternehmen“ 95/98 px).
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DataTable } from '@/components/tabelle/DataTable'
import { spaltenHelper } from '@/components/tabelle/spalten'
import { SeitenKopf } from './SeitenKopf'

describe('SeitenKopf eingerastet', () => {
  const vorher = globalThis.IntersectionObserver
  let melde: ((sichtbar: boolean) => void) | null = null
  beforeEach(() => {
    class IO {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        melde = (sichtbar) => cb([{ isIntersecting: sichtbar }])
      }
      observe() {}
      disconnect() {}
    }
    globalThis.IntersectionObserver = IO as unknown as typeof IntersectionObserver
  })
  afterEach(() => {
    globalThis.IntersectionObserver = vorher
    melde = null
  })

  it('Titel schrumpft und bricht nicht um, Werkzeuge rechts scrollen quer statt den Titel zu quetschen', () => {
    render(
      <SeitenKopf
        titel="Oktober 2026"
        titelLinks={<button type="button">←</button>}
        titelRechts={<button type="button">→</button>}
        rechts={<span>Werkzeuge</span>}
      />,
    )
    const kopf = screen.getByRole('banner')
    const h1 = screen.getByRole('heading', { level: 1, name: 'Oktober 2026' })
    expect(h1).not.toHaveClass('md:whitespace-nowrap')
    act(() => melde?.(false))
    expect(kopf).toHaveClass('is-stuck')
    expect(h1).toHaveClass('md:whitespace-nowrap', 'md:text-[24px]')
    expect(kopf.firstElementChild).toHaveClass('md:shrink-0')
    expect(screen.getByText('Werkzeuge').parentElement).toHaveClass('xl:flex-nowrap', 'xl:overflow-x-auto')
  })
})

describe('DataTable kopfUmbruch', () => {
  type Z = { id: string; n: number; m: number }
  const h = spaltenHelper<Z>()
  it('sortierbarer Kopf mit kopfUmbruch bricht um, ohne bleibt er einzeilig mit „…“', () => {
    render(
      <DataTable<Z>
        ariaLabel="T"
        daten={[{ id: 'a', n: 1, m: 2 }]}
        rowId={(r) => r.id}
        spalten={[
          h.accessor('n', { header: 'Ohne Bewegung', meta: { rechts: true, kopfUmbruch: true } }),
          h.accessor('m', { header: 'Letzte Bewegung' }),
        ]}
      />,
    )
    const um = screen.getByRole('button', { name: /^Ohne Bewegung/ })
    expect(um).toHaveClass('whitespace-normal', 'text-right')
    expect(um.querySelector('span')).not.toHaveClass('truncate')
    const fest = screen.getByRole('button', { name: /^Letzte Bewegung/ })
    expect(fest).toHaveClass('whitespace-nowrap')
    expect(fest.querySelector('span')).toHaveClass('truncate')
  })
})
