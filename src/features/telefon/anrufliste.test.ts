// anrufliste: Reihenfolge, Gate, Slot-Rotation A→B→C→D→A, Rückruf-Wiederholungen bleiben in Sektion Rückrufe (BAUPLAN § 3.4, T-01/T-02/T-17/T-19)
import { describe, expect, it } from 'vitest'
import { MEMBER_M } from '@/test/fixtures/leads'
import type { SperrlisteEintrag } from '@/types/domain'
import {
  anrufliste,
  istAnrufKandidat,
  listeIds,
  slotFuerVersuch,
  wiederholungAusTitel,
  type ListenLead,
} from './anrufliste'
import {
  enrollment,
  JETZT,
  LEAD_A,
  LEAD_B,
  LEAD_C,
  LEAD_OHNE_GRUND,
  LEAD_OHNE_NUMMER,
  TASK_RUECKRUF,
} from './_testHilfe'
import { letzterJeLead, type LetzterAnruf } from '@/data/calls'

const basis = { tasks: [], enrollments: [], jetzt: JETZT }

describe('anrufliste', () => {
  it('Slot-Rotation A → B → C → D → A; Wiederholungszähler aus dem Task-Titel', () => {
    expect([1, 2, 3, 4, 5, 6].map(slotFuerVersuch)).toEqual(['A', 'B', 'C', 'D', 'A', 'B'])
    expect(wiederholungAusTitel('Rückruf')).toBe(0)
    expect(wiederholungAusTitel('Rückruf – nicht erreicht (Wiederholung 1)')).toBe(1)
    expect(wiederholungAusTitel('Rückruf – nicht erreicht (Wiederholung 2)')).toBe(2)
  })

  it('T-01/T-17: ohne Nummer, Sperrliste, Widerspruch, Firmensperre → „Noch nicht anrufbar“; ohne Anrufgrund trotzdem anrufbar (Cold Calling)', () => {
    const gesperrt: ListenLead = { ...LEAD_C, id: 'lead-sperr', companies: { do_not_contact: true } }
    const widerspruch: ListenLead = {
      ...LEAD_C,
      id: 'lead-wid',
      do_not_contact: true,
      do_not_contact_channels: ['telefon'],
    }
    const sperrliste: SperrlisteEintrag[] = [
      {
        id: 's1',
        lead_id: LEAD_B.id,
        phone_e164: null,
        linkedin_url_norm: null,
        email: null,
        name: null,
        company: null,
        channels: ['telefon'],
        reason: 'test',
        note: null,
        created_by: null,
        created_at: '2026-10-01',
      },
    ]
    const l = anrufliste({
      ...basis,
      leads: [LEAD_A, LEAD_B, LEAD_OHNE_GRUND, LEAD_OHNE_NUMMER, gesperrt, widerspruch],
      sperrliste,
    })
    expect(l.anrufliste.map((z) => z.lead.id).sort()).toEqual([LEAD_A.id, LEAD_OHNE_GRUND.id].sort())
    expect(Object.fromEntries(l.nichtAnrufbar.map((z) => [z.lead.id, z.grund]))).toEqual({
      [LEAD_B.id]: 'sperrliste',
      [LEAD_OHNE_NUMMER.id]: 'keine_nummer',
      'lead-sperr': 'firma_gesperrt',
      'lead-wid': 'widerspruch',
    })
    expect(l.zaehler).toEqual({ liste: 2, rueckrufe: 0, versuche: 0, frisch: 2, nichtAnrufbar: 4 })
  })

  it('T-02: Rückrufe (nach Uhrzeit) → Wiederholungen (Versuch 2–5, fällig) → frische Leads (Funnel-Tiefe ↓, Anlage ↑)', () => {
    const rueckrufSpaet = {
      ...TASK_RUECKRUF,
      id: 't2',
      lead_id: LEAD_OHNE_GRUND.id,
      due_at: '2026-10-14T13:00:00.000Z',
    }
    const leadD: ListenLead = { ...LEAD_OHNE_GRUND, call_basis: 'empfehlung' }
    const leadFrischAlt: ListenLead = { ...LEAD_B, id: 'lead-alt', created_at: '2026-08-01T09:00:00+02:00' }
    const l = anrufliste({
      ...basis,
      leads: [LEAD_B, LEAD_C, LEAD_A, leadD, leadFrischAlt],
      tasks: [rueckrufSpaet, TASK_RUECKRUF],
      enrollments: [enrollment(LEAD_B.id, 3, '2026-10-13T07:00:00.000Z')],
    })
    expect(l.rueckrufe.map((z) => z.lead.id)).toEqual([LEAD_A.id, leadD.id])
    expect(l.rueckrufe[0]?.verpasst).toBe(false) // 10:30 = jetzt
    expect(l.rueckrufe[0]?.task.id).toBe(TASK_RUECKRUF.id)
    // Wiederholung zuerst, dann frische: Sales Lead (erstgespraech_vereinbart) vor Vernetzt; gleicher Rang → ältere Anlage zuerst
    expect(l.anrufliste.map((z) => [z.lead.id, z.art, z.versuch, z.slot])).toEqual([
      [LEAD_B.id, 'wiederholung', 3, 'C'],
      [LEAD_C.id, 'frisch', 1, 'A'],
      ['lead-alt', 'frisch', 1, 'A'],
    ])
    expect(l.anrufliste[0]?.ueberfaelligTage).toBe(1)
    expect(listeIds(l)).toEqual([LEAD_A.id, leadD.id, LEAD_B.id, LEAD_C.id, 'lead-alt'])
    expect(l.zaehler).toEqual({ liste: 5, rueckrufe: 2, versuche: 1, frisch: 2, nichtAnrufbar: 0 })
  })

  it('T-19: Rückruf-Wiederholung bleibt in der Sektion Rückrufe; verpasste Uhrzeit wird markiert', () => {
    const task = {
      ...TASK_RUECKRUF,
      title: 'Rückruf – nicht erreicht (Wiederholung 1)',
      due_at: '2026-10-14T07:00:00.000Z',
    }
    const l = anrufliste({
      ...basis,
      leads: [LEAD_A],
      tasks: [task],
      enrollments: [enrollment(LEAD_A.id, 2, '2026-10-14T07:00:00.000Z')],
    })
    expect(l.rueckrufe).toHaveLength(1)
    expect(l.rueckrufe[0]?.wiederholung).toBe(1)
    expect(l.rueckrufe[0]?.verpasst).toBe(true)
    expect(l.rueckrufe[0]?.versuch).toBe(2)
    expect(l.anrufliste).toHaveLength(0) // nicht doppelt als Wiederholung
  })

  it('offener Rückruf in der Zukunft hält den Lead aus der Liste; kommende Versuche nur mit „Alle“', () => {
    const morgen = { ...TASK_RUECKRUF, due_at: '2026-10-15T08:00:00.000Z' }
    const heute = anrufliste({
      ...basis,
      leads: [LEAD_A, LEAD_B],
      tasks: [morgen],
      enrollments: [enrollment(LEAD_B.id, 2, '2026-10-16T07:00:00.000Z')],
    })
    expect(heute.rueckrufe).toHaveLength(0)
    expect(heute.anrufliste).toHaveLength(0)
    expect(heute.kommend).toHaveLength(0)
    const alle = anrufliste({
      ...basis,
      leads: [LEAD_B],
      enrollments: [enrollment(LEAD_B.id, 2, '2026-10-16T07:00:00.000Z')],
      alle: true,
    })
    expect(alle.kommend.map((z) => z.lead.id)).toEqual([LEAD_B.id])
  })

  it('pausierte Enrollments, Position > max und heute entfernte Leads erscheinen nicht; Rückrufe trotz Entfernen', () => {
    const l = anrufliste({
      ...basis,
      leads: [LEAD_A, LEAD_B, LEAD_C],
      tasks: [TASK_RUECKRUF],
      enrollments: [
        enrollment(LEAD_B.id, 2, '2026-10-13T07:00:00.000Z', 'pausiert'),
        enrollment(LEAD_C.id, 6, '2026-10-13T07:00:00.000Z'),
      ],
      entfernt: new Set([LEAD_A.id]),
    })
    expect(l.rueckrufe.map((z) => z.lead.id)).toEqual([LEAD_A.id])
    expect(l.anrufliste).toHaveLength(0)
  })

  it('Kandidaten: Neu … Sales Follow-up (Cold Calling); Kunde, Wiedervorlage, Beendet nicht', () => {
    expect(istAnrufKandidat('neu')).toBe(true)
    expect(istAnrufKandidat('vernetzung_gesendet')).toBe(true)
    expect(istAnrufKandidat('vernetzt')).toBe(true)
    expect(istAnrufKandidat('sales_follow_up')).toBe(true)
    expect(istAnrufKandidat('kunde')).toBe(false)
    expect(istAnrufKandidat('langfristig')).toBe(false)
    expect(istAnrufKandidat('beendet')).toBe(false)
    const l = anrufliste({
      ...basis,
      leads: [
        { ...LEAD_A, stage: 'beendet' },
        { ...LEAD_B, stage: 'neu', owner_id: MEMBER_M },
      ],
    })
    expect(l.anrufliste.map((z) => z.lead.id)).toEqual([LEAD_B.id]) // „Neu“ ohne Vorgeschichte: direkt anrufbar
    expect(l.nichtAnrufbar).toHaveLength(0)
  })

  it('letzter Anruf je Lead landet an Rückruf- und Anrufzeilen (Ergebnis-Chip, „vereinbart … mit …“)', () => {
    const c = (lead_id: string, started_at: string, outcome: LetzterAnruf['outcome']): LetzterAnruf => ({
      id: `${lead_id}-${started_at}`,
      lead_id,
      started_at,
      outcome,
      reached_person: null,
      reached_name: null,
      attempt_no: 1,
    })
    const letzte = letzterJeLead([
      c(LEAD_B.id, '2026-10-09T08:00:00.000Z', 'voicemail'),
      c(LEAD_B.id, '2026-10-12T08:00:00.000Z', 'no_answer'),
      c(LEAD_A.id, '2026-10-12T08:00:00.000Z', 'callback_scheduled'),
    ])
    expect(letzte.get(LEAD_B.id)?.outcome).toBe('no_answer')
    const l = anrufliste({
      ...basis,
      leads: [LEAD_A, LEAD_B, LEAD_C],
      tasks: [TASK_RUECKRUF],
      enrollments: [enrollment(LEAD_B.id, 2, '2026-10-13T07:00:00.000Z')],
      letzte,
    })
    expect(l.rueckrufe[0]?.letzterAnruf?.outcome).toBe('callback_scheduled')
    expect(l.anrufliste.map((z) => z.letzterAnruf?.outcome ?? null)).toEqual(['no_answer', null])
  })
})
