// kennzahlen.ts: Formeln § 7.2 (Sept 288/55/51/10/1/1 → 19\u202F%/20\u202F%/10\u202F%/100\u202F%), Division durch 0 → „–“, Monatszähler-Regel,
// Badge „aus Sheet“, gespraechsdauer nur is_connect, emailBeantwortetQuote, widersprueche nur Kanal E-Mail,
// geantwortetNachSchritt (letzter vorangehender Schritt desselben Enrollments), Wochen Okt 2026 (§ 1.5 Nr. 30), Team-Summen (K-10).
import { describe, expect, it } from 'vitest'
import { SETTINGS } from '@/test/fixtures/settings'
import {
  antwortzeitSchnitt,
  ausFunnelMonat,
  ausSummen,
  emailBeantwortetQuote,
  formatWert,
  funnelZeilen,
  geantwortetNachSchritt,
  gespraechsdauer,
  kachelDelta,
  kachelnEmail,
  kachelnLinkedin,
  kachelnTelefon,
  kachelVergleich,
  kachelZiel,
  notizVarianten,
  quotenAus,
  summeWochen,
  summiereEvents,
  tageswerte,
  widersprueche,
  wochen,
  type EventZeile,
} from './kennzahlen'
import { DAILY, FUNNEL_MONATLICH, METRIC_EVENTS } from './_testHilfe'
import { MEMBER_V } from '@/test/fixtures/leads'
import type { FunnelMonat } from '@/types/domain'

const SEPT = ausSummen({
  vernetzungen_versendet: 288,
  vernetzungen_angenommen: 55,
  gespraeche_eroeffnet: 51,
  dm_beantwortet: 10,
  erstgespraech_gepitcht: 1,
  erstgespraeche: 1,
})
const ZIELE = SETTINGS.kpi_targets

describe('Quoten (§ 7.2)', () => {
  it('Sept 2026: 288/55/51/10/1/1 → 19\u202F% · 20\u202F% · 10\u202F% · 100\u202F%, Rest null', () => {
    const q = SEPT.quoten
    expect(formatWert('prozent', q.annahme_quote)).toBe('19\u202F%')
    expect(formatWert('prozent', q.antwort_quote)).toBe('20\u202F%')
    expect(formatWert('prozent', q.pitch_quote)).toBe('10\u202F%')
    expect(formatWert('prozent', q.erstgespraech_quote)).toBe('100\u202F%')
    expect(q.strategiegespraech_quote).toBe(0) // 0 / 1 wie Sheet-Formel
    expect(q.kunden_quote).toBeNull()
    expect(q.connect_rate).toBeNull()
  })

  it('Division durch 0 → null → „–“; Telefon-Quoten und Termine/100 Dials', () => {
    expect(quotenAus({}).annahme_quote).toBeNull()
    expect(formatWert('prozent', null)).toBe('–')
    expect(formatWert('zahl', null)).toBe('–')
    const t = quotenAus({ anrufe: 12, anrufe_erreicht: 4, entscheider_gespraeche: 2, termine_telefon: 1 })
    expect(formatWert('prozent', t.connect_rate)).toBe('33\u202F%')
    expect(formatWert('prozent', t.entscheider_quote)).toBe('17\u202F%')
    expect(formatWert('dezimal', t.termine_pro_100_anrufe)).toBe('8,3')
    expect(t.termin_quote_gespraech).toBe(0.5)
  })

  it('ausFunnelMonat übernimmt die Quoten der View 1:1 (K-02)', () => {
    const f = FUNNEL_MONATLICH[1] as unknown as FunnelMonat
    const w = ausFunnelMonat(f)
    expect(w.summen.vernetzungen_versendet).toBe(288)
    expect(w.quoten.annahme_quote).toBe(0.191)
    expect(ausFunnelMonat(null).summen).toEqual({})
  })
})

describe('summiereEvents', () => {
  it('Monatsansicht: Sheet-Monatswerte zählen, Badge „aus Sheet“ nur für reine Monatszähler (K-09)', () => {
    const okt = METRIC_EVENTS.filter(
      (z) => z.member_id === MEMBER_V && String(z.day).startsWith('2026-10'),
    ) as EventZeile[]
    const { summen, nurSheet } = summiereEvents(okt, true)
    expect(summen.vernetzungen_versendet).toBe(305)
    expect(summen.gespraeche_eroeffnet).toBe(82)
    expect(summen.erstgespraeche).toBe(1)
    expect(nurSheet.has('vernetzungen_versendet')).toBe(true)
    expect(nurSheet.has('gespraeche_eroeffnet')).toBe(false)
    expect(nurSheet.has('erstgespraeche')).toBe(false)
  })

  it('KW/7 T: Monatszähler zählen nicht (§ 3.6 Regeln)', () => {
    const kw40 = METRIC_EVENTS.filter((z) => z.day >= '2026-09-28' && z.day <= '2026-10-04') as EventZeile[]
    const { summen, nurSheet } = summiereEvents(kw40, false)
    expect(summen.vernetzungen_versendet).toBeUndefined()
    expect(summen.gespraeche_eroeffnet).toBe(65)
    expect(nurSheet.size).toBe(0)
  })

  it('Team = Summe beider Personen, Quoten aus den Team-Summen (K-04/K-10)', () => {
    const okt = METRIC_EVENTS.filter((z) => String(z.day).startsWith('2026-10')) as EventZeile[]
    const w = ausSummen(summiereEvents(okt, true).summen)
    expect(w.summen.gespraeche_eroeffnet).toBe(86)
    expect(w.summen.anrufe).toBe(12)
    expect(formatWert('prozent', w.quoten.connect_rate)).toBe('33\u202F%')
  })
})

describe('Kacheln', () => {
  it('LinkedIn: Delta absolut + pp, Ziel erreicht als Lime-Punkt, Fußnoten', () => {
    const okt = ausSummen({
      vernetzungen_versendet: 305,
      vernetzungen_angenommen: 93,
      gespraeche_eroeffnet: 82,
      dm_beantwortet: 19,
    })
    const k = kachelnLinkedin(
      okt,
      SEPT,
      { antwortzeit: 1.5, antwortzeitVor: 2, manuell: true, nurSheet: new Set(['vernetzungen_versendet']) },
      ZIELE,
    )
    expect(k.map((x) => x.key)).toEqual([
      'vernetzungen_versendet',
      'vernetzungen_angenommen',
      'gespraeche_eroeffnet',
      'dm_beantwortet',
      'erstgespraeche',
      'antwortzeit',
    ])
    const versendet = k[0]!
    expect(versendet.fussnote).toBe('sheet')
    expect(kachelDelta(versendet)).toBe('+17')
    expect(kachelVergleich(versendet, 'Sept.')).toBe('vs. Sept. 288')
    const angenommen = k[1]!
    expect(formatWert('zahl', angenommen.wert)).toBe('93')
    expect(formatWert('prozent', angenommen.quote)).toBe('30\u202F%')
    expect(kachelDelta(angenommen)).toBe('+38 · +11\u00A0pp')
    expect(kachelVergleich(angenommen, 'Sept.')).toBe('vs. Sept. 19\u202F%')
    expect(kachelZiel(angenommen)).toBe('Ziel ≥ 25\u202F%')
    expect(angenommen.erreicht).toBe(true)
    const antwort = k[3]!
    expect(antwort.erreicht).toBe(true) // 23\u202F% ≥ 20\u202F%
    const zeit = k[5]!
    expect(formatWert('dezimal', zeit.wert)).toBe('1,5')
    expect(kachelDelta(zeit)).toBe('−0,5')
    expect(kachelZiel(zeit)).toBe('Ziel ≤ 1,0')
    expect(zeit.erreicht).toBe(false)
    // Fußnote „Zähler, teilweise manuell“ nur, wenn der Wert nicht ausschließlich aus dem Sheet stammt
    const k2 = kachelnLinkedin(
      okt,
      SEPT,
      { antwortzeit: null, antwortzeitVor: null, manuell: true, nurSheet: new Set() },
      ZIELE,
    )
    expect(k2[0]!.fussnote).toBe('zaehler')
    expect(k2[5]!.wert).toBeNull()
    expect(kachelDelta(k2[5]!)).toBeNull()
  })

  it('Telefon: Connects/Entscheider in %, Termine/100 Dials, Ø Gesprächsdauer mm:ss (K-07/K-14)', () => {
    const w = ausSummen({ anrufe: 12, anrufe_erreicht: 4, entscheider_gespraeche: 2, termine_telefon: 1 })
    const k = kachelnTelefon(w, ausSummen({}), { dauer: 240, dauerVor: null, nurSheet: new Set() }, ZIELE)
    expect(k.map((x) => x.label)).toEqual([
      'Dials',
      'Connects',
      'Entscheider',
      'Termine',
      'Termine/100 Dials',
      'Ø Gesprächsdauer',
    ])
    expect(formatWert('prozent', k[1]!.quote)).toBe('33\u202F%')
    expect(k[1]!.erreicht).toBe(true)
    expect(formatWert('dezimal', k[4]!.wert)).toBe('8,3')
    expect(k[4]!.erreicht).toBe(true)
    expect(formatWert('dauer', k[5]!.wert)).toBe('04:00')
    expect(kachelDelta(k[5]!)).toBeNull()
    const leer = kachelnTelefon(
      ausSummen({}),
      ausSummen({}),
      { dauer: null, dauerVor: null, nurSheet: new Set() },
      ZIELE,
    )
    expect(formatWert('dauer', leer[5]!.wert)).toBe('–')
  })

  it('E-Mail: beantwortet (%) als Prozent-Kachel mit pp-Delta, Widersprüche ohne Quote (K-15)', () => {
    const k = kachelnEmail(ausSummen({ emails_gesendet: 2 }), ausSummen({ emails_gesendet: 4 }), {
      beantwortet: 0.5,
      beantwortetVor: 0.25,
      widersprueche: 1,
      widerspruecheVor: 0,
      nurSheet: new Set(),
    })
    expect(formatWert('prozent', k[1]!.wert)).toBe('50\u202F%')
    expect(kachelDelta(k[1]!)).toBe('+25\u00A0pp')
    expect(kachelDelta(k[2]!)).toBe('+1')
    expect(kachelDelta(k[0]!)).toBe('−2')
  })
})

describe('Funnel-Zeilen', () => {
  it('10 Zeilen in Sheet-Reihenfolge, Sub-Zeilen Ausstehend und Erstgespräche vereinbart, Links § 7.5', () => {
    const okt = ausSummen({
      vernetzungen_versendet: 305,
      vernetzungen_angenommen: 93,
      ausstehend: 212,
      erstgespraeche: 1,
      erstgespraeche_vereinbart: 2,
    })
    const z = funnelZeilen(okt, SEPT, ZIELE, new Set(['vernetzungen_versendet']), false)
    expect(z.map((x) => x.nr)).toEqual(['01', '02', '—', '03', '04', '05', '06', '—', '07', '08'])
    expect(z[2]).toMatchObject({ metric: 'ausstehend', sub: true, wert: 212, quote: undefined, leads: null })
    expect(z[7]).toMatchObject({
      metric: 'erstgespraeche_vereinbart',
      sub: true,
      wert: 2,
      hinweis: 'nach Buchungsdatum, keine Konversion',
    })
    expect(z[0]).toMatchObject({ gross: true, fussnote: 'sheet', delta: 17, leads: 'anfragen' })
    expect(z[1]).toMatchObject({ gross: true, delta: 38, erreicht: true })
    expect(z[1]!.deltaPp).toBeCloseTo(11.4, 0)
    expect(z[6]).toMatchObject({ metric: 'erstgespraeche', wert: 1, leads: 'termine:erstgespraech' })
    expect(z[9]).toMatchObject({ metric: 'kunden_gewonnen', leads: 'kunde', quote: null })
  })
})

describe('Hook-Kacheln', () => {
  const defs = [
    { outcome: 'dm_interest', is_connect: true },
    { outcome: 'meeting_booked', is_connect: true },
    { outcome: 'no_answer', is_connect: false },
  ] as const
  it('gespraechsdauer: nur is_connect, nicht korrigiert, ausgehend; 0 Connects → null', () => {
    const calls = [
      { outcome: 'dm_interest', duration_sec: 180, corrected: false, direction: 'out' },
      { outcome: 'meeting_booked', duration_sec: 300, corrected: false, direction: 'out' },
      { outcome: 'no_answer', duration_sec: 900, corrected: false, direction: 'out' },
      { outcome: 'dm_interest', duration_sec: 9000, corrected: true, direction: 'out' },
      { outcome: 'dm_interest', duration_sec: 9000, corrected: false, direction: 'in' },
    ] as const
    expect(gespraechsdauer(calls, defs)).toBe(240)
    expect(gespraechsdauer([calls[2]], defs)).toBeNull()
    expect(gespraechsdauer([], defs)).toBeNull()
  })

  it('emailBeantwortetQuote: replied ÷ gesendet; Entwürfe/Bounces zählen nicht; 0 → null', () => {
    const emails = [
      { status: 'replied', direction: 'out' },
      { status: 'sent', direction: 'out' },
      { status: 'delivered', direction: 'out' },
      { status: 'sent_confirmed', direction: 'out' },
      { status: 'draft', direction: 'out' },
      { status: 'bounced', direction: 'out' },
      { status: 'replied', direction: 'in' },
    ] as const
    expect(emailBeantwortetQuote(emails)).toBe(0.25)
    expect(emailBeantwortetQuote([{ status: 'draft', direction: 'out' }])).toBeNull()
  })

  it('widersprueche: Trigger-Zeilen (channel sonstiges) zählen über metadata.channels – Konfliktentscheid K-15 (Review)', () => {
    expect(
      widersprueche([
        { type: 'widerspruch', channel: 'sonstiges', kanaele: null }, // alle Kanäle
        { type: 'widerspruch', channel: 'sonstiges', kanaele: ['email'] },
        { type: 'widerspruch', channel: 'sonstiges', kanaele: ['linkedin', 'telefon', 'email'] },
        { type: 'widerspruch', channel: 'sonstiges', kanaele: ['telefon'] },
        { type: 'widerspruch', channel: 'telefon', kanaele: null },
      ]),
    ).toBe(3)
  })

  it('widersprueche: nur Typ widerspruch mit Kanal E-Mail', () => {
    expect(
      widersprueche([
        { type: 'widerspruch', channel: 'email' },
        { type: 'widerspruch', channel: 'telefon' },
        { type: 'notiz', channel: 'email' },
      ]),
    ).toBe(1)
  })

  it('geantwortetNachSchritt: Antwort → letzter vorangehender Schritt desselben Enrollments, unsortierte Eingabe', () => {
    const a = (
      id: number,
      lead: string,
      type: string,
      t: string,
      step: string | null = null,
      enrollment: string | null = null,
    ) => ({
      id,
      lead_id: lead,
      type,
      occurred_at: `2026-10-${t}T10:00:00Z`,
      step_id: step,
      enrollment_id: enrollment,
    })
    const acts = [
      a(5, 'L1', 'nachricht_erhalten', '09'),
      a(1, 'L1', 'gespraech_eroeffnet', '01', 'st1', 'en1'),
      a(2, 'L1', 'nachricht_gesendet', '04', 'st2', 'en1'),
      a(3, 'L2', 'gespraech_eroeffnet', '02', 'st1', 'en2'),
      a(4, 'L2', 'nachricht_erhalten', '03'),
      a(6, 'L3', 'nachricht_gesendet', '05'), // ohne Sequenz → zählt keinem Schritt
      a(7, 'L3', 'nachricht_erhalten', '06'),
      a(8, 'L2', 'email_erhalten', '12'), // zweite Antwort ohne neuen Schritt → nicht doppelt
    ] as const
    const z = geantwortetNachSchritt(acts as never)
    expect(z.get('st2')).toBe(1)
    expect(z.get('st1')).toBe(1)
    expect([...z.values()].reduce((x, y) => x + y, 0)).toBe(2)
  })

  it('antwortzeitSchnitt: nur beantwortete, gerundet auf 0,1', () => {
    expect(antwortzeitSchnitt([{ werktage: 1 }, { werktage: 2 }, { werktage: null }])).toBe(1.5)
    expect(antwortzeitSchnitt([{ werktage: null }])).toBeNull()
  })

  it('notizVarianten: Annahme- und Antwortquote je Variante', () => {
    const v = notizVarianten(
      [
        { lead_id: 'L1', status: 'angenommen', accepted_at: 'x', note_variant: 'ohne' },
        { lead_id: 'L2', status: 'ausstehend', accepted_at: null, note_variant: 'ohne' },
        { lead_id: 'L3', status: 'angenommen', accepted_at: 'x', note_variant: 'note_v1' },
      ],
      [{ lead_id: 'L1', type: 'nachricht_erhalten' }],
    )
    expect(v).toHaveLength(2)
    expect(v[0]).toMatchObject({
      variante: 'ohne',
      gesamt: 2,
      angenommen: 1,
      annahmeQuote: 0.5,
      antworten: 1,
      antwortQuote: 1,
    })
    expect(v[1]).toMatchObject({ variante: 'note_v1', gesamt: 1, angenommen: 1, antworten: 0, antwortQuote: 0 })
  })
})

describe('Tageswerte und Wochen (K-01, § 1.5 Nr. 30)', () => {
  it('Okt 2026: 31 Tage, Team-Summe je Tag, KW 40 65 · KW 41 0 · KW 42 17 · KW 43 0 · KW 44 0 · Gesamt 82', () => {
    const tage = tageswerte(DAILY.filter((d) => d.member_id === MEMBER_V) as never, '2026-10-01', '2026-10-31')
    expect(tage).toHaveLength(31)
    expect(tage[0]!.werte.gespraeche_eroeffnet).toBe(28)
    expect(tage[11]!.werte.gespraeche_eroeffnet).toBe(17)
    const w = wochen(tage, '2026-10-14')
    expect(w.map((x) => [x.kw, x.werte.gespraeche_eroeffnet])).toEqual([
      [40, 65],
      [41, 0],
      [42, 17],
      [43, 0],
      [44, 0],
    ])
    expect(w[0]).toMatchObject({ von: '2026-09-28', bis: '2026-10-04', tage: 4 })
    expect(w[4]).toMatchObject({ von: '2026-10-26', bis: '2026-11-01', tage: 6 })
    expect(w[2]!.aktuell).toBe(true)
    expect(summeWochen(w).gespraeche_eroeffnet).toBe(82)
  })

  it('Team summiert beide Personen je Tag', () => {
    const tage = tageswerte(DAILY as never, '2026-10-06', '2026-10-06')
    expect(tage[0]!.werte).toMatchObject({ gespraeche_eroeffnet: 4, anrufe: 12, anrufe_erreicht: 4 })
  })
})
