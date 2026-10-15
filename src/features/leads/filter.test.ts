// filter.test.ts (BAUPLAN § 3.3): URL ↔ Filter ↔ PostgREST, alle 15 System-Ansichten; Keys identisch mit src/app/ansichten.ts.
import { describe, expect, it } from 'vitest'
import { SYSTEM_ANSICHTEN as APP_ANSICHTEN } from '@/app/ansichten'
import { MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import { ansichtNachKey, sperrlistenTreffer, SYSTEM_ANSICHTEN, type AnsichtKontext } from './ansichten'
import { ansichtAusUrl, effektiverFilter, filterAusUrl, filterInUrl, hatOverrides, postgrestVorschau } from './filter'

const CTX: AnsichtKontext = {
  heute: '2026-10-14',
  me: MEMBER_V,
  firmaGesperrt: () => false,
  sperrliste: () => false,
  zurueckziehenTage: 21,
}

describe('filter ↔ URL', () => {
  it('liest alle Parameter und ignoriert ungültige Werte', () => {
    const p = new URLSearchParams(
      'q=bergfeld&zustaendig=me&phase=eroeffnet,beantwortet,quatsch&kanal=linkedin,fax&faellig=heute&tag=a,b&quelle=10000000-0000-4000-8000-000000000001&sort=next_action_at:desc,unbekannt:asc&gruppe=faelligkeit',
    )
    expect(filterAusUrl(p)).toEqual({
      q: 'bergfeld',
      zustaendig: 'me',
      phase: ['eroeffnet', 'beantwortet'],
      kanal: ['linkedin'],
      faellig: 'heute',
      tag: ['a', 'b'],
      quelle: '10000000-0000-4000-8000-000000000001',
      sort: [{ feld: 'next_action_at', richtung: 'desc' }],
      gruppe: 'faelligkeit',
    })
  })

  it('Roundtrip: filterInUrl(filterAusUrl(x)) ist stabil, lead/ansicht bleiben erhalten', () => {
    const p = new URLSearchParams('ansicht=meine&lead=abc&phase=gepitcht&zustaendig=frei&sort=company_name:asc')
    const f = filterAusUrl(p)
    const zurueck = filterInUrl(f, p)
    expect(zurueck.get('ansicht')).toBe('meine')
    expect(zurueck.get('lead')).toBe('abc')
    expect(filterAusUrl(zurueck)).toEqual(f)
    expect(zurueck.toString()).toContain('phase=gepitcht')
  })

  it('leerer Filter entfernt die Parameter; hatOverrides erkennt den Zustand', () => {
    const p = filterInUrl({}, new URLSearchParams('q=x&phase=kunde&ansicht=alle'))
    expect(p.toString()).toBe('ansicht=alle')
    expect(hatOverrides({})).toBe(false)
    expect(hatOverrides({ q: 'x' })).toBe(true)
  })

  it('Rolle, Anrede und Erlaubnis-Grundlage stehen ebenfalls in der URL (LE-04) und gehen an PostgREST', () => {
    const p = new URLSearchParams('rolle=geschaeftsfuehrer,quatsch&anrede=frau&erlaubnis=meeting_held,none')
    const f = filterAusUrl(p)
    expect(f).toEqual({ rolle: ['geschaeftsfuehrer'], anrede: ['frau'], erlaubnis: ['meeting_held', 'none'] })
    expect(filterAusUrl(filterInUrl(f))).toEqual(f)
    const aufrufe = postgrestVorschau(effektiverFilter(ansichtAusUrl(p), f))
    expect(aufrufe).toContainEqual(['in', 'role', ['geschaeftsfuehrer']])
    expect(aufrufe).toContainEqual(['in', 'salutation', ['frau']])
    expect(aufrufe).toContainEqual(['in', 'email_consent_basis', ['meeting_held', 'none']])
  })

  it('zustaendig als UUID-Liste', () => {
    const f = filterAusUrl(new URLSearchParams(`zustaendig=${MEMBER_V}`))
    expect(f.zustaendig).toEqual([MEMBER_V])
  })

  it('ansichtAusUrl: unbekannt → alle', () => {
    expect(ansichtAusUrl(new URLSearchParams('ansicht=gibtsnicht')).key).toBe('alle')
    expect(ansichtAusUrl(new URLSearchParams('ansicht=termine')).key).toBe('termine')
  })
})

describe('System-Ansichten', () => {
  it('sind genau die 15 Keys aus src/app/ansichten.ts (gleiche Reihenfolge, gleiche Namen)', () => {
    expect(SYSTEM_ANSICHTEN.map((a) => [a.key, a.name])).toEqual(APP_ANSICHTEN.map((a) => [a.key, a.name]))
    expect(SYSTEM_ANSICHTEN).toHaveLength(15)
  })

  it('jede Ansicht liefert einen PostgREST-Aufruf mit deleted_at-Bedingung und Sortierung', () => {
    for (const a of SYSTEM_ANSICHTEN) {
      const f = effektiverFilter(a, {})
      const aufrufe = postgrestVorschau(f, MEMBER_V)
      const deleted = aufrufe.find((x) => x[1] === 'deleted_at')
      expect(deleted, a.key).toBeDefined()
      expect(deleted?.[0]).toBe(a.key === 'papierkorb' ? 'not' : 'is')
      expect(
        aufrufe.some((x) => x[0] === 'order'),
        a.key,
      ).toBe(true)
    }
  })

  it('meine → owner_id = ich; frei → owner_id null oder released; beendet → stage in (beendet)', () => {
    expect(postgrestVorschau(effektiverFilter(ansichtNachKey('meine'), {}), MEMBER_V)).toContainEqual([
      'eq',
      'owner_id',
      MEMBER_V,
    ])
    expect(postgrestVorschau(effektiverFilter(ansichtNachKey('frei'), {}), MEMBER_V)).toContainEqual([
      'or',
      'owner_id.is.null,released.eq.true',
    ])
    expect(postgrestVorschau(effektiverFilter(ansichtNachKey('beendet'), {}), MEMBER_V)).toContainEqual([
      'in',
      'stage',
      ['beendet'],
    ])
    expect(postgrestVorschau(effektiverFilter(ansichtNachKey('in_gespraech'), {}), MEMBER_V)).toContainEqual([
      'in',
      'stage',
      ['dm_beantwortet', 'bedarfsermittlung', 'pitch'],
    ])
    expect(postgrestVorschau(effektiverFilter(ansichtNachKey('ohne_unternehmen'), {}), MEMBER_V)).toContainEqual([
      'is',
      'company_id',
      null,
    ])
  })

  it('Overrides gewinnen je Key; „alle“ hebt Zuständig auf; Gruppierung sortiert den Schlüssel vor', () => {
    const f = effektiverFilter(ansichtNachKey('meine'), { zustaendig: 'alle', gruppe: 'phase' })
    expect(f.zustaendig).toBeUndefined()
    expect(f.sort?.[0]).toEqual({ feld: 'stage', richtung: 'asc' })
    const g = effektiverFilter(ansichtNachKey('alle'), { sort: [{ feld: 'company_name', richtung: 'desc' }] })
    expect(g.sort).toEqual([{ feld: 'company_name', richtung: 'desc' }])
  })

  it('Fällig: ≤ heute · Überfällig: < heute · Zurückziehen: > 21 T · Antwort offen · Anrufliste (LE-03, LE-15)', () => {
    const heute = vollerLead(1, { next_action_at: '2026-10-14T09:00:00+02:00' })
    const gestern = vollerLead(2, { next_action_at: '2026-10-13T09:00:00+02:00' })
    const morgen = vollerLead(3, { next_action_at: '2026-10-15T09:00:00+02:00' })
    const ohne = vollerLead(4, { next_action_at: null })
    const faellig = ansichtNachKey('faellig').client as NonNullable<ReturnType<typeof ansichtNachKey>['client']>
    expect([heute, gestern, morgen, ohne].filter((l) => faellig(l, CTX)).map((l) => l.id)).toEqual([
      heute.id,
      gestern.id,
    ])
    const ueber = ansichtNachKey('ueberfaellig').client as NonNullable<ReturnType<typeof ansichtNachKey>['client']>
    expect([heute, gestern, morgen].filter((l) => ueber(l, CTX)).map((l) => l.id)).toEqual([gestern.id])

    const zurueck = ansichtNachKey('abgelaufen').client as NonNullable<ReturnType<typeof ansichtNachKey>['client']>
    expect(zurueck(vollerLead(5, { stage_changed_at: '2026-09-01T09:00:00+02:00' }), CTX)).toBe(true)
    expect(zurueck(vollerLead(6, { stage_changed_at: '2026-10-10T09:00:00+02:00' }), CTX)).toBe(false)

    const offen = ansichtNachKey('antwort_offen').client as NonNullable<ReturnType<typeof ansichtNachKey>['client']>
    expect(offen(vollerLead(7, { inbound_unanswered_since: '2026-10-13T10:00:00+02:00' }), CTX)).toBe(true)
    expect(offen(vollerLead(8), CTX)).toBe(false)

    const anruf = ansichtNachKey('anrufliste').client as NonNullable<ReturnType<typeof ansichtNachKey>['client']>
    const bereit = vollerLead(9, { phone_e164: '+4940123456', call_basis: 'linkedin_vernetzt' })
    expect(anruf(bereit, CTX)).toBe(true)
    expect(anruf(vollerLead(10, { phone_e164: '+4940123456', call_basis: null }), CTX)).toBe(false)
    expect(anruf(bereit, { ...CTX, sperrliste: () => true })).toBe(false)
    expect(anruf(bereit, { ...CTX, firmaGesperrt: () => true })).toBe(false)
    expect(anruf({ ...bereit, do_not_contact: true, do_not_contact_channels: ['telefon'] }, CTX)).toBe(false)
  })

  it('sperrlistenTreffer über Telefon, E-Mail, LinkedIn-Norm oder lead_id', () => {
    const l = vollerLead(1, { phone_e164: '+4940123456', email: 'Max@Example.de' })
    const basis = {
      id: 's1',
      channels: [],
      company: null,
      created_at: '',
      created_by: null,
      email: null,
      lead_id: null,
      linkedin_url_norm: null,
      name: null,
      note: null,
      phone_e164: null,
      reason: 'x',
    }
    expect(sperrlistenTreffer(l, [{ ...basis, phone_e164: '+4940123456' }])).toBe(true)
    expect(sperrlistenTreffer(l, [{ ...basis, email: 'max@example.de' }])).toBe(true)
    expect(sperrlistenTreffer(l, [{ ...basis, linkedin_url_norm: l.linkedin_url_norm }])).toBe(true)
    expect(sperrlistenTreffer(l, [{ ...basis, lead_id: l.id }])).toBe(true)
    expect(sperrlistenTreffer(l, [{ ...basis, phone_e164: '+4940999' }])).toBe(false)
    expect(sperrlistenTreffer(l, [])).toBe(false)
  })
})

// Integration M2/M5 (K-05, BAUPLAN § 7.5): Funnel-Klick aus den KPIs als Ereignis-Filter
describe('Ereignis-Filter (§ 7.5)', () => {
  const P = '00000000-0000-4000-8000-000000000001'
  it('URL → Filter → URL bleibt gleich; ohne gültigen Zeitraum kein Filter', () => {
    const p = new URLSearchParams(`ereignis=nachricht_erhalten&von=2026-10-01&bis=2026-10-14&person=${P}`)
    const f = filterAusUrl(p)
    expect(f.ereignis).toEqual({
      art: 'aktivitaet',
      typ: 'nachricht_erhalten',
      von: '2026-10-01',
      bis: '2026-10-14',
      person: P,
    })
    expect(filterAusUrl(filterInUrl(f))).toEqual(f)
    expect(hatOverrides(f)).toBe(true)
    expect(
      filterAusUrl(new URLSearchParams('ereignis=nachricht_erhalten&von=gestern&bis=2026-10-14')).ereignis,
    ).toBeUndefined()
    expect(filterAusUrl(new URLSearchParams('ereignis=quatsch&von=2026-10-01&bis=2026-10-14')).ereignis).toBeUndefined()
  })
  it('Entfernen des Chips nimmt von/bis/person mit', () => {
    const p = new URLSearchParams(`quelle=anfragen&von=2026-10-01&bis=2026-10-14&person=${P}&lead=x`)
    const ohne = filterInUrl({}, p)
    expect(ohne.toString()).toBe('lead=x')
  })
  it('PostgREST: !inner-Filter auf activities / linkedin_connections / meetings mit Berliner Grenzen', () => {
    const a = postgrestVorschau({
      ereignis: { art: 'aktivitaet', typ: 'pitch_gesendet', von: '2026-10-01', bis: '2026-10-14', person: P },
    })
    expect(a).toContainEqual(['eq', 'activities.type', 'pitch_gesendet'])
    expect(a).toContainEqual(['gte', 'activities.occurred_at', '2026-09-30T22:00:00.000Z'])
    expect(a).toContainEqual(['lt', 'activities.occurred_at', '2026-10-14T22:00:00.000Z'])
    expect(a).toContainEqual(['eq', 'activities.member_id', P])
    const v = postgrestVorschau({ ereignis: { art: 'anfrage', von: '2026-10-01', bis: '2026-10-14' } })
    expect(v).toContainEqual(['gte', 'linkedin_connections.requested_at', '2026-09-30T22:00:00.000Z'])
    const t = postgrestVorschau({
      ereignis: { art: 'termin', typ: 'erstgespraech', von: '2026-10-01', bis: '2026-10-14' },
    })
    expect(t).toContainEqual(['eq', 'meetings.status', 'stattgefunden'])
    expect(t).toContainEqual(['eq', 'meetings.type', 'erstgespraech'])
  })
  it('Ansicht „Termine“ mit Zeitraum filtert nach Terminen statt nach Phase', () => {
    const p = new URLSearchParams('ansicht=termine&termin=erstgespraech&von=2026-10-01&bis=2026-10-14')
    const f = effektiverFilter(ansichtAusUrl(p), filterAusUrl(p))
    expect(f.phase).toBeUndefined()
    expect(f.ereignis).toMatchObject({ art: 'termin', typ: 'erstgespraech' })
    expect(effektiverFilter(ansichtNachKey('termine'), {}).phase).toEqual(['erstgespraech', 'strategiegespraech'])
  })
})
