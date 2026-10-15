// Palette-Befehle der Hilfe: Einführung starten (Ereignis), Handbuch und „Was das CRM (noch) nicht kann“ öffnen.
import { describe, expect, it, vi } from 'vitest'
import type { BefehlKontext } from '@/app/befehle'
import { BEFEHLE } from './befehle'
import { TOUR_EVENT } from './ereignis'
import { TASTEN } from './tasten'

const ctx = (navigate = vi.fn()) => ({ navigate, leadId: null, me: {} }) as unknown as BefehlKontext

describe('Hilfe-Befehle', () => {
  it('eindeutige IDs mit Präfix hilfe:', () => {
    expect(new Set(BEFEHLE.map((b) => b.id)).size).toBe(BEFEHLE.length)
    for (const b of BEFEHLE) expect(b.id.startsWith('hilfe:')).toBe(true)
  })

  it('„Einführungstour starten“ feuert crm:tour mit onboarding', () => {
    const h = vi.fn()
    window.addEventListener(TOUR_EVENT, h)
    BEFEHLE.find((b) => b.id === 'hilfe:tour')!.ausfuehren(ctx())
    expect((h.mock.calls[0]![0] as CustomEvent).detail).toEqual({ tour: 'onboarding' })
    window.removeEventListener(TOUR_EVENT, h)
  })

  it('Handbuch und Grenzen navigieren', () => {
    const navigate = vi.fn()
    BEFEHLE.find((b) => b.id === 'hilfe:handbuch')!.ausfuehren(ctx(navigate))
    BEFEHLE.find((b) => b.id === 'hilfe:grenzen')!.ausfuehren(ctx(navigate))
    expect(navigate.mock.calls).toEqual([['/hilfe'], ['/hilfe/noch-nicht']])
  })

  it('Tasten: keine browser-reservierte Kombination', async () => {
    const { VERBOTEN, anzeigeNachBinding } = await import('@/lib/keyboard')
    for (const g of TASTEN)
      for (const e of g.eintraege) for (const t of e.tasten) expect(VERBOTEN).not.toContain(anzeigeNachBinding(t))
  })
})
