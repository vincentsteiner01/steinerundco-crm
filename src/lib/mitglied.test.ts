import { describe, expect, it } from 'vitest'
import { kuerzel } from '@/components/ui/Avatar'
import { anzeigeName, istKuerzel, personSlug } from './mitglied'

describe('anzeigeName (Runde 2: short_name „VS“ ergab „Guten Tag, VS.“)', () => {
  const vincent = { id: 'v', display_name: 'Vincent', short_name: 'VS', email: 'vincent@steinerundco.de' }
  const mike = { id: 'm', display_name: 'Mike', short_name: 'Mike', email: 'mike@steinerundco.de' }
  it('ein Kürzel ist nie der Anzeigename – dann zählt der Vorname aus display_name', () => {
    expect(anzeigeName(vincent)).toBe('Vincent')
    expect(anzeigeName(mike)).toBe('Mike')
    expect(anzeigeName({ display_name: 'Mike Meier', short_name: 'MM' })).toBe('Mike')
  })
  it('ohne Namen: Register über E-Mail, sonst Ersatz', () => {
    expect(anzeigeName({ email: 'vincent@steinerundco.de', short_name: 'VS' })).toBe('Vincent')
    expect(anzeigeName(null, 'die andere Person')).toBe('die andere Person')
  })
  it('istKuerzel / personSlug', () => {
    expect(istKuerzel('VS')).toBe(true)
    expect(istKuerzel('Mike')).toBe(false)
    expect(personSlug(vincent)).toBe('vincent')
    expect(personSlug(mike)).toBe('mike')
  })
  it('Runde 3: display_name gewinnt immer; short_name nur als Name, wenn länger als 3 Zeichen', () => {
    expect(anzeigeName({ display_name: 'Vincent Steiner', short_name: 'Vinc' })).toBe('Vincent')
    expect(anzeigeName({ display_name: 'Vincent', short_name: 'vs' })).toBe('Vincent')
    expect(anzeigeName({ short_name: 'vs' }, '–')).toBe('–')
    expect(anzeigeName({ short_name: 'Mike' })).toBe('Mike')
    expect(personSlug({ display_name: 'Vincent', short_name: 'VS' })).toBe('vincent')
  })
})

describe('kuerzel (Avatar, Badges)', () => {
  it('short_name bis 3 Zeichen, sonst Initialen aus personen.ts, sonst aus display_name', () => {
    expect(kuerzel({ display_name: 'Vincent', short_name: 'VS', email: 'vincent@steinerundco.de' })).toBe('VS')
    expect(kuerzel({ display_name: 'Vincent', short_name: 'vs' })).toBe('VS')
    expect(kuerzel({ display_name: 'Vincent', short_name: 'Vincent', email: 'vincent@steinerundco.de' })).toBe('VS')
    expect(kuerzel({ display_name: 'Mike', short_name: 'Mike', email: 'mike@steinerundco.de' })).toBe('MM')
    expect(kuerzel({ display_name: 'Lena Berg', short_name: null })).toBe('LB')
  })
})
