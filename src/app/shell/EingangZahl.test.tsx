// Runde 3: Sidebar-Zähler am Eintrag „Einstellungen“ – offene LinkedIn-Mails im Eingang; bei 0 nichts, nie ein Link (kein <a> im <a>).
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const anzahl = vi.hoisted(() => ({ n: 0 as number | undefined }))
vi.mock('@/features/eingang/public', () => ({
  useEingangLive: () => {},
  useEingangOffenAnzahl: () => ({ data: anzahl.n }),
}))

import { EingangZahl } from './EingangZahl'

describe('EingangZahl', () => {
  beforeEach(() => {
    anzahl.n = 0
  })
  it('zeigt die Zahl offener Mails in Lime, ohne eigenen Link', () => {
    anzahl.n = 3
    const { container } = render(<EingangZahl aktiv={false} />)
    expect(screen.getByText('3')).toHaveClass('text-signal')
    expect(screen.getByTitle('3 LinkedIn-Mails warten im Eingang')).toBeInTheDocument()
    expect(container.querySelector('a')).toBeNull()
  })
  it('rendert bei 0 oder ohne Daten nichts', () => {
    const { container, rerender } = render(<EingangZahl aktiv={false} />)
    expect(container).toBeEmptyDOMElement()
    anzahl.n = undefined
    rerender(<EingangZahl aktiv />)
    expect(container).toBeEmptyDOMElement()
  })
})
