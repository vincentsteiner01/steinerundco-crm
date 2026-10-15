// BAUPLAN § 7.5 (K-05): Klick auf eine Funnel-Ziffer → /leads mit Ereignis-Filter; Person → `person` (Ereignis-Mitglied),
// Team ohne; Kunden ohne Zeitraum, mit Zuständigkeit. Die Gegenseite (URL → LeadFilter) prüft features/leads/filter.test.ts.
import { describe, expect, it } from 'vitest'
import { ereignisAusUrl } from '@/features/leads/filter'
import { leadsUrl } from './leadsLink'

const ctx = { von: '2026-10-01', bis: '2026-10-31', member: '00000000-0000-4000-8000-000000000001' }
const P = 'person=00000000-0000-4000-8000-000000000001'

describe('leadsUrl', () => {
  it('jede Funnel-Zeile hat ihren Filter (§ 7.5)', () => {
    expect(leadsUrl('anfragen', ctx)).toBe(`/leads?quelle=anfragen&von=2026-10-01&bis=2026-10-31&${P}`)
    expect(leadsUrl('angenommen', ctx)).toBe(`/leads?quelle=angenommen&von=2026-10-01&bis=2026-10-31&${P}`)
    expect(leadsUrl('ereignis:gespraech_eroeffnet', ctx)).toBe(
      `/leads?ereignis=gespraech_eroeffnet&von=2026-10-01&bis=2026-10-31&${P}`,
    )
    expect(leadsUrl('ereignis:pitch_gesendet', ctx)).toContain('ereignis=pitch_gesendet')
    expect(leadsUrl('termine:erstgespraech', ctx)).toBe(
      `/leads?ansicht=termine&termin=erstgespraech&von=2026-10-01&bis=2026-10-31&${P}`,
    )
    expect(leadsUrl('termine', ctx)).toBe(`/leads?ansicht=termine&von=2026-10-01&bis=2026-10-31&${P}`)
    expect(leadsUrl('kunde', ctx)).toBe('/leads?phase=kunde&zustaendig=00000000-0000-4000-8000-000000000001')
  })

  it('Team ohne Person; ohne Filter kein Link (Ausstehend)', () => {
    expect(leadsUrl('ereignis:nachricht_erhalten', { ...ctx, member: 'team' })).toBe(
      '/leads?ereignis=nachricht_erhalten&von=2026-10-01&bis=2026-10-31',
    )
    expect(leadsUrl(null, ctx)).toBeNull()
  })

  it('die Leads-Seite versteht jeden Link als Ereignis-Filter (K-05)', () => {
    const url = (f: Parameters<typeof leadsUrl>[0]) => new URLSearchParams((leadsUrl(f, ctx) ?? '').split('?')[1])
    expect(ereignisAusUrl(url('ereignis:nachricht_erhalten'))).toEqual({
      art: 'aktivitaet',
      typ: 'nachricht_erhalten',
      von: '2026-10-01',
      bis: '2026-10-31',
      person: ctx.member,
    })
    expect(ereignisAusUrl(url('anfragen'))?.art).toBe('anfrage')
    expect(ereignisAusUrl(url('angenommen'))?.art).toBe('annahme')
    expect(ereignisAusUrl(url('termine:strategiegespraech'))).toMatchObject({
      art: 'termin',
      typ: 'strategiegespraech',
    })
    expect(ereignisAusUrl(url('termine:vereinbart'))?.art).toBe('termin_vereinbart')
    expect(ereignisAusUrl(url('kunde'))).toBeUndefined()
  })
})
