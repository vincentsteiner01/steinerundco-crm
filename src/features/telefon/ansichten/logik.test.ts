import { describe, expect, it } from 'vitest'
import type { TelefonAufgabe, TelefonLead, TelefonTermin } from '@/data/telefonAnsichten'
import {
  conversions,
  dealPhase,
  arbeitsliste,
  kontaktText,
  naechsterSchritt,
  telefonStatus,
  kontakteSortiert,
  kpiSpanne,
  nachPhase,
  naechstesFollowUp,
  salesZeilen,
  terminVon,
} from './logik'

let n = 0
const termin = (t: Partial<TelefonTermin>): TelefonTermin => ({
  id: `m${++n}`,
  type: 'erstgespraech',
  status: 'geplant',
  scheduled_at: '2026-10-20T09:00:00Z',
  booked_at: '2026-10-10T09:00:00Z',
  member_id: null,
  ...t,
})
const aufgabe = (t: Partial<TelefonAufgabe>): TelefonAufgabe => ({
  id: `t${++n}`,
  kind: 'rueckruf',
  title: null,
  due_at: '2026-10-23T08:00:00Z',
  status: 'offen',
  member_id: null,
  ...t,
})
const lead = (l: Partial<TelefonLead>): TelefonLead =>
  ({
    id: `l${++n}`,
    stage: 'erstgespraech_vereinbart',
    meetings: [],
    tasks: [],
    full_name: 'A',
    company_name: null,
    ...l,
  }) as TelefonLead

describe('dealPhase', () => {
  it('Kunde und Beendet kommen aus der Stufe', () => {
    expect(dealPhase(lead({ stage: 'kunde', meetings: [termin({})] }))).toBe('kunde')
    expect(dealPhase(lead({ stage: 'beendet', meetings: [termin({ status: 'stattgefunden' })] }))).toBe('beendet')
  })

  it('geplanter Termin bestimmt die Phase – der späteste zählt', () => {
    expect(dealPhase(lead({ meetings: [termin({})] }))).toBe('eg_vereinbart')
    expect(
      dealPhase(
        lead({
          meetings: [
            termin({ status: 'stattgefunden', scheduled_at: '2026-10-01T09:00:00Z' }),
            termin({ type: 'strategiegespraech', scheduled_at: '2026-10-28T09:00:00Z' }),
          ],
        }),
      ),
    ).toBe('sg_vereinbart')
    expect(dealPhase(lead({ meetings: [termin({ type: 'folgegespraech' })] }))).toBe('sg_folge')
  })

  it('No-Show, abgesagt oder verschoben ohne neuen Termin → neu terminieren', () => {
    expect(dealPhase(lead({ meetings: [termin({ status: 'no_show' })] }))).toBe('eg_neu')
    expect(dealPhase(lead({ meetings: [termin({ status: 'verschoben' })] }))).toBe('eg_neu')
    expect(dealPhase(lead({ meetings: [termin({ type: 'strategiegespraech', status: 'abgesagt' })] }))).toBe('sg_neu')
  })

  it('stattgefunden ohne Folgetermin → Follow-Up; ohne Termine die Stufe', () => {
    expect(dealPhase(lead({ meetings: [termin({ status: 'stattgefunden' })] }))).toBe('follow_up')
    expect(dealPhase(lead({ stage: 'strategiegespraech_vereinbart' }))).toBe('sg_vereinbart')
    expect(dealPhase(lead({ stage: 'sales_follow_up' }))).toBe('follow_up')
  })

  it('nachPhase verteilt auf alle acht Spalten', () => {
    const r = nachPhase([lead({ stage: 'kunde' }), lead({ meetings: [termin({})] })])
    expect(Object.keys(r)).toHaveLength(8)
    expect(r.kunde).toHaveLength(1)
    expect(r.eg_vereinbart).toHaveLength(1)
  })
})

describe('Termine und Follow-ups', () => {
  it('terminVon ignoriert verschobene und nimmt den letzten', () => {
    const l = lead({
      meetings: [
        termin({ scheduled_at: '2026-10-01T09:00:00Z', status: 'verschoben' }),
        termin({ scheduled_at: '2026-10-05T09:00:00Z', status: 'stattgefunden' }),
        termin({ type: 'strategiegespraech' }),
      ],
    })
    expect(terminVon(l, 'erstgespraech')?.scheduled_at).toBe('2026-10-05T09:00:00Z')
    expect(terminVon(l, 'strategiegespraech')?.type).toBe('strategiegespraech')
  })

  it('naechstesFollowUp = frühestes offenes', () => {
    const l = lead({
      tasks: [
        aufgabe({ due_at: '2026-10-25T08:00:00Z' }),
        aufgabe({ due_at: '2026-10-21T08:00:00Z', status: 'erledigt' }),
        aufgabe({ due_at: '2026-10-24T08:00:00Z' }),
      ],
    })
    expect(naechstesFollowUp(l)?.due_at).toBe('2026-10-24T08:00:00Z')
  })

  it('Kontakte: mit Follow-up zuerst, dann nach Name', () => {
    const r = kontakteSortiert([
      lead({ full_name: 'Zora' }),
      lead({ full_name: 'Bernd', tasks: [aufgabe({ due_at: '2026-10-30T08:00:00Z' })] }),
      lead({ full_name: 'Anna' }),
      lead({ full_name: 'Carl', tasks: [aufgabe({ due_at: '2026-10-22T08:00:00Z' })] }),
    ])
    expect(r.map((x) => x.full_name)).toEqual(['Carl', 'Bernd', 'Anna', 'Zora'])
  })
})

describe('Sales-KPIs', () => {
  it('kpiSpanne: 14 Tage · 12 Wochen ab Montag · 12 Monate ab dem Ersten', () => {
    expect(kpiSpanne('tage', '2026-10-23')).toEqual({ von: '2026-10-10', bis: '2026-10-23' })
    expect(kpiSpanne('wochen', '2026-10-23')).toEqual({ von: '2026-08-03', bis: '2026-10-23' })
    expect(kpiSpanne('monate', '2026-10-23')).toEqual({ von: '2025-11-01', bis: '2026-10-23' })
  })

  it('salesZeilen: leere Perioden bleiben, Monats-Sheetwerte zählen nicht, neueste zuerst', () => {
    const z = salesZeilen(
      [
        { day: '2026-10-20', metric: 'anrufe', value: 3, period: 'tag' },
        { day: '2026-10-22', metric: 'anrufe', value: 2, period: 'tag' },
        { day: '2026-10-22', metric: 'anrufe_erreicht', value: 1, period: 'tag' },
        { day: '2026-10-01', metric: 'anrufe', value: 99, period: 'monat' },
      ],
      'wochen',
      { von: '2026-10-12', bis: '2026-10-23' },
    )
    expect(z.map((x) => x.key)).toEqual(['2026-10-19', '2026-10-12'])
    expect(z[0]?.summen).toEqual({ anrufe: 5, anrufe_erreicht: 1 })
    expect(z[0]?.label).toBe('KW 43 · ab 19.10.')
    expect(z[1]?.summen).toEqual({})
  })

  it('conversions inkl. Show-Rate, null ohne Nenner', () => {
    const c = conversions({ anrufe: 40, anrufe_erreicht: 10, erstgespraeche: 3, erstgespraeche_vereinbart: 4 })
    expect(c.find((x) => x.label === 'Anwahlen → Telefonate')?.quote).toBe(0.25)
    expect(c.find((x) => x.label === 'EG Show-Rate')?.quote).toBe(0.75)
    expect(c.find((x) => x.label === 'SG → Kunden')?.quote).toBeNull()
  })
})

describe('Arbeitsliste (Mikes Follow-ups)', () => {
  it('nächster Schritt = frühestes aus Rückruf, Termin, Telefon-Sequenz; ohne alles „Anruf“ ohne Datum', () => {
    expect(naechsterSchritt(lead({ tasks: [aufgabe({ due_at: '2026-10-25T08:00:00Z' })] }))).toMatchObject({
      zeit: '2026-10-25T08:00:00Z',
      label: 'Anruf',
    })
    const mitSequenz = lead({
      tasks: [aufgabe({ kind: 'wiedervorlage', due_at: '2026-10-30T08:00:00Z' })],
      enrollments: [{ id: 'e1', channel: 'telefon', status: 'aktiv', next_due_at: '2026-10-24T07:30:00Z' }],
    })
    expect(naechsterSchritt(mitSequenz)).toMatchObject({ zeit: '2026-10-24T07:30:00Z', label: 'Anruf', aufgabe: null })
    expect(naechsterSchritt(lead({}))).toEqual({ zeit: null, label: 'Anruf', aufgabe: null })
  })

  it('Status wie bei Mike: Offen, Deal-Phase, Kunde', () => {
    expect(telefonStatus(lead({ stage: 'neu' }))).toBe('Offen')
    expect(telefonStatus(lead({ stage: 'erstgespraech_vereinbart', meetings: [termin({})] }))).toBe('EG vereinbart')
    expect(telefonStatus(lead({ stage: 'kunde' }))).toBe('Kunde')
  })

  it('nur offene Leads mit Nummer, mit Datum zuerst, dann nach Name', () => {
    const r = arbeitsliste([
      lead({ full_name: 'Zora', phone_e164: '+49211' }),
      lead({ full_name: 'Ohne Nummer', phone_e164: null }),
      lead({ full_name: 'Kunde', stage: 'kunde', phone_e164: '+49211' }),
      lead({ full_name: 'Bert', phone_e164: '+49211', tasks: [aufgabe({ due_at: '2026-10-22T08:00:00Z' })] }),
      lead({ full_name: 'Anna', phone_e164: '+49211' }),
    ])
    expect(r.map((x) => x.full_name)).toEqual(['Bert', 'Anna', 'Zora'])
  })

  it('kontaktText: Ergebnis-Kurzwort + Notiz', () => {
    expect(kontaktText({ outcome: 'no_answer', text: null })).toBe('Nicht rangegangen')
    expect(kontaktText({ outcome: null, text: 'ab 14 Uhr' })).toBe('ab 14 Uhr')
    expect(kontaktText({ outcome: 'busy', text: 'später' })).toBe('Besetzt – später')
  })
})
