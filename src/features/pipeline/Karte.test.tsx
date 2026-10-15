// Karte.test.tsx (DESIGN-SYSTEM § 5.12): echte Daten zeigten „Do 08.10. Do 08.10.“, einen umbrechenden Meta-Bereich und „VINCENT“
// als Avatar-Text. Die Karte zeigt jetzt genau EIN Datum, eine nicht umbrechende Meta-Zeile und kürzt Name/Firma/Schritt mit title.
import { DndContext } from '@dnd-kit/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mitFirmensperre } from '@/features/leads/spalten'
import { MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import type { Member } from '@/types/domain'
import { Karte } from './Karte'

const HEUTE = '2026-10-15'
const VINCENT = {
  id: MEMBER_V,
  display_name: 'Vincent',
  short_name: 'Vincent',
  initial: 'V',
  email: 'vincent@steinerundco.de',
} as unknown as Member

function karte(patch: Parameters<typeof vollerLead>[1], gesperrt = false) {
  const lead = mitFirmensperre(vollerLead(1, patch), gesperrt, false)
  render(
    <DndContext>
      <Karte lead={lead} member={VINCENT} cursor={false} heute={HEUTE} />
    </DndContext>,
  )
  return document.querySelector('article') as HTMLElement
}

describe('Karte', () => {
  it('zeigt bei 7 Tagen Überfälligkeit genau ein Datum mit sichtbarem −7 T, Amber, Langform im title', () => {
    const k = karte({
      full_name: 'Ilka Brodersen-Okafor',
      stage: 'gespraech_eroeffnet',
      next_action_at: '2026-10-08T09:00:00+02:00',
      next_action_kind: 'sequenz_schritt',
      next_action_label: 'Opener',
    })
    const meta = k.querySelector('[data-meta]') as HTMLElement
    expect(meta.textContent).not.toMatch(/08\.10\..*08\.10\./)
    // Runde 2: das „−7 T“ steht sichtbar am Datum (nicht nur im title)
    const datum = meta.querySelector('.text-overdue') as HTMLElement
    expect(datum.textContent).toMatch(/^Do 08\.10\.−7\sT$/)
    expect(datum.className).toContain('text-overdue')
    expect(datum.className).toContain('whitespace-nowrap')
    // Langform im title wie in der Leads-Tabelle: „Datum −N T“ (Runde 2: überfällig immer mit Tagen)
    expect(datum.getAttribute('title')).toBe('Do 08.10. −7 T · Opener')
  })

  it('Meta-Zeile bricht nie um: nowrap, Datum fest, langer Schritt-Chip kürzt mit title', () => {
    const k = karte({
      stage: 'dm_beantwortet',
      next_action_at: '2026-10-05T09:00:00+02:00',
      next_action_kind: 'wiedervorlage',
      next_action_label: 'Follow-up (aus Sheet)',
    })
    const meta = k.querySelector('[data-meta]') as HTMLElement
    expect(meta.className).toContain('flex-nowrap')
    expect(meta.className).toContain('min-w-0')
    const chip = meta.querySelector('[title="Follow-up (aus Sheet)"]') as HTMLElement
    expect(chip.className).toContain('min-w-0')
    expect(chip.className).toContain('[&>span]:truncate')
  })

  it('Avatar zeigt Foto bzw. Kürzel – nie den Vornamen als Text', () => {
    const k = karte({ next_action_at: '2026-10-15T09:00:00+02:00' })
    expect(k.textContent).not.toContain('VINCENT')
    expect(screen.getByText('heute').className).toContain('text-signal')
  })

  it('lange Namen/Firmen kürzen mit Ellipse und title; ohne Firma „–“; gesperrte Firma bleibt sichtbar', () => {
    const k = karte(
      {
        full_name: 'Hannelore-Beatrix Quistorp-Wendland von Eichenhain',
        company_name: 'Windparkentwicklung Netzanschlusskonzepte Mitteldeutschland GmbH',
      },
      true,
    )
    const name = screen.getByText('Hannelore-Beatrix Quistorp-Wendland von Eichenhain')
    expect(name.className).toContain('truncate')
    expect(name.getAttribute('title')).toBe('Hannelore-Beatrix Quistorp-Wendland von Eichenhain')
    const firma = screen.getByText('Windparkentwicklung Netzanschlusskonzepte Mitteldeutschland GmbH')
    expect(firma.className).toContain('truncate')
    expect(screen.getByText('Firma gesperrt').closest('span[class*="shrink-0"]')).not.toBeNull()
    expect(k).toBeTruthy()
  })

  it('Rückruf: Uhrzeit nur einmal (am Datum), Chip nur „Rückruf“', () => {
    const k = karte({
      stage: 'erstgespraech_vereinbart',
      next_action_at: '2026-10-16T09:00:00+02:00',
      next_action_kind: 'rueckruf',
    })
    const meta = k.querySelector('[data-meta]') as HTMLElement
    expect(screen.getByText('Fr 16.10. 09:00')).toBeTruthy()
    expect(screen.getByText('Rückruf')).toBeTruthy()
    expect(meta.textContent?.match(/09:00/g)).toHaveLength(1)
  })

  it('ohne Unternehmen steht „–“', () => {
    const k = karte({ company_name: null })
    expect(k.querySelector('.text-small')?.textContent).toBe('–')
  })
})
