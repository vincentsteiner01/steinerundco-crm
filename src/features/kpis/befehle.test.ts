// Palette-Befehle M5: Zeitraum-Sprünge schreiben die URL-Parameter, „dieser Monat“ rechnet in Berliner Zeit, Export feuert das Event.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BefehlKontext } from '@/app/befehle'
import type { Member } from '@/types/domain'
import { BEFEHLE, KPIS_EXPORT_EVENT } from './befehle'

const kontext = (): BefehlKontext & { navigate: ReturnType<typeof vi.fn> } =>
  ({ navigate: vi.fn(), leadId: null, me: {} as Member }) as unknown as BefehlKontext & {
    navigate: ReturnType<typeof vi.fn>
  }
const befehl = (id: string) => BEFEHLE.find((b) => b.id === id)!

describe('BEFEHLE (KPIs)', () => {
  afterEach(() => vi.useRealTimers())

  it('„dieser Monat“ nimmt den Berliner Kalendertag: 31.10. 23:30 UTC ist schon November', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-31T23:30:00Z') })
    const ctx = kontext()
    befehl('kpis-monat').ausfuehren(ctx)
    expect(ctx.navigate).toHaveBeenCalledWith('/kpis?zeitraum=2026-11')
  })

  it('Woche, 7 T und Team schreiben die passenden Parameter', () => {
    const ctx = kontext()
    befehl('kpis-woche').ausfuehren(ctx)
    befehl('kpis-7t').ausfuehren(ctx)
    befehl('kpis-team').ausfuehren(ctx)
    expect(ctx.navigate.mock.calls.map((c) => c[0])).toEqual([
      '/kpis?zeitraum=kw',
      '/kpis?zeitraum=7t',
      '/kpis?person=team',
    ])
  })

  it('Export ist nur auf /kpis sichtbar und feuert das Export-Event', () => {
    const ctx = kontext()
    window.history.pushState({}, '', '/heute')
    expect(befehl('kpis-export').sichtbar?.(ctx)).toBe(false)
    window.history.pushState({}, '', '/kpis?zeitraum=2026-10')
    expect(befehl('kpis-export').sichtbar?.(ctx)).toBe(true)
    const h = vi.fn()
    window.addEventListener(KPIS_EXPORT_EVENT, h)
    befehl('kpis-export').ausfuehren(ctx)
    window.removeEventListener(KPIS_EXPORT_EVENT, h)
    expect(h).toHaveBeenCalledTimes(1)
    window.history.pushState({}, '', '/')
  })

  it('keine Bindung kollidiert mit VERBOTEN (Befehle ohne eigene Tasten)', () => {
    expect(BEFEHLE.every((b) => !b.tasten || b.tasten.length === 0)).toBe(true)
  })
})
