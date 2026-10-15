// kadenz: Kalendertage + Rollen (§ 1.5 Nr. 37, § 5.3 T1/T2/T7–T9), Slot-Rotation, Wrap-up-Vorbelegung
import { describe, expect, it } from 'vitest'
import { SETTINGS } from '@/test/fixtures/settings'
import { ERGEBNISSE, ergebnisNachTaste } from './ergebnisse'
import {
  besetztText,
  folgeTextAusLead,
  naechsterVersuchText,
  rueckrufWiederholungText,
  wrapUpVorbelegung,
  type FolgeLead,
} from './kadenz'

const MI = '2026-10-14T08:00:00.000Z' // Mi 14.10. 10:00 Berlin
const FR = '2026-10-16T08:00:00.000Z'
const DO = '2026-10-15T08:00:00.000Z'
const MO = '2026-10-19T08:00:00.000Z'
const k = { feiertage: SETTINGS.feiertage, dueTime: '09:00', slots: SETTINGS.telefon.slots, maxVersuche: 5 }

describe('kadenz', () => {
  it('T1/T2: Versuch 1 Mi 14.10. → Fr 16.10. Slot B; Versuch 2 Fr 16.10. → Mo 19.10. Slot C (nicht Mi 21.10.)', () => {
    expect(naechsterVersuchText(1, MI, k)).toBe('Nächster Versuch Fr 16.10. · Versuch 2 von 5 · Slot B 14:00–16:00')
    expect(naechsterVersuchText(2, FR, k)).toBe('Nächster Versuch Mo 19.10. · Versuch 3 von 5 · Slot C 16:00–17:30')
    expect(naechsterVersuchText(4, '2026-10-23T08:00:00.000Z', k)).toContain('Mi 28.10. · Versuch 5 von 5 · Slot A')
    expect(naechsterVersuchText(5, '2026-10-28T08:00:00.000Z', k)).toBe(
      'Nach Versuch 5 nicht erreichbar · Wiedervorlage Di 26.01.',
    )
  })

  it('T7–T9: Rückruf nicht erreicht → Do 15.10. 10:00 (Wiederholung 1) → Mo 19.10. 10:00 (Wiederholung 2) → Telefon-Standard ab Versuch 3', () => {
    expect(rueckrufWiederholungText({ title: 'Rückruf' }, MI, k)).toBe(
      'Nächster Rückruf Do 15.10. 10:00 (Wiederholung 1)',
    )
    expect(rueckrufWiederholungText({ title: 'Rückruf – nicht erreicht (Wiederholung 1)' }, DO, k)).toBe(
      'Nächster Rückruf Mo 19.10. 10:00 (Wiederholung 2)',
    )
    expect(rueckrufWiederholungText({ title: 'Rückruf – nicht erreicht (Wiederholung 2)' }, MO, k)).toBe(
      'Telefon-Standard ab Versuch 3 von 5 · Do 22.10. · Slot C 16:00–17:30',
    )
  })

  it('T-06: Besetzt → Erneut in 45 min', () => {
    expect(besetztText(45)).toBe('Erneut in 45 min')
  })

  it('Wrap-up-Vorbelegung: Gesprächspartner aus dem Lead, Rückruf nächster Werktag 10:30, Wiedervorlage +3 Monate gerollt', () => {
    const lead = { full_name: 'Lukas Feldhaus', role_title: 'GF' }
    const sieben = ergebnisNachTaste('7')
    const w = ergebnisNachTaste('W')
    const neun = ergebnisNachTaste('9')
    if (!sieben || !w || !neun) throw new Error('Ergebnis fehlt')
    expect(wrapUpVorbelegung(sieben, lead, SETTINGS, '2026-10-16').callbackAt).toBe('2026-10-19T10:30') // Fr → Mo
    expect(wrapUpVorbelegung(w, lead, SETTINGS, '2026-10-14').callbackAt).toBe('2027-01-14') // 14.01.2027 Do
    const n = wrapUpVorbelegung(neun, lead, SETTINGS, '2026-10-14')
    expect(n.reachedName).toBe('Lukas Feldhaus')
    expect(n.reachedRolle).toBe('GF')
    expect(n.reachedPerson).toBe('entscheider')
    expect(n.meetingAt).toBeNull()
    expect(wrapUpVorbelegung(ERGEBNISSE[0]!, lead, SETTINGS).reachedName).toBe('')
  })

  describe('folgeTextAusLead – Wrap-up-Text aus dem Zustand nach log_call', () => {
    const basis: FolgeLead = { stage: 'vernetzt', next_action_at: null, tasks: [], enrollments: [] }
    const rueckruf = (id: string, title: string, due_at: string) =>
      ({ id, kind: 'rueckruf', status: 'offen', title, due_at }) as FolgeLead['tasks'][number]

    it('T-19: neuer Rückruf-Task mit „(Wiederholung n)“ im Titel – der alte zählt nicht', () => {
      const lead: FolgeLead = {
        ...basis,
        tasks: [
          rueckruf('alt', 'Rückruf', '2026-10-14T08:30:00.000Z'),
          rueckruf('neu', 'Rückruf – nicht erreicht (Wiederholung 1)', '2026-10-15T08:00:00.000Z'),
        ],
      }
      expect(folgeTextAusLead(lead, { outcome: 'no_answer', alterTaskId: 'alt', ausRueckruf: true, kadenz: k })).toBe(
        'Nächster Rückruf Do 15.10. 10:00 (Wiederholung 1)',
      )
    })

    it('T-19: nach der zweiten Wiederholung löst Telefon-Standard ab Versuch 3 ab', () => {
      const lead: FolgeLead = {
        ...basis,
        enrollments: [
          { channel: 'telefon', status: 'aktiv', current_position: 3, next_due_at: '2026-10-22T07:00:00.000Z' },
        ],
      }
      expect(folgeTextAusLead(lead, { outcome: 'voicemail', alterTaskId: 't2', ausRueckruf: true, kadenz: k })).toBe(
        'Telefon-Standard ab Versuch 3 von 5 · Do 22.10. · Slot C 16:00–17:30',
      )
    })

    it('T-05: Taste 1 ohne Rückruf – Position und Fälligkeit aus dem Enrollment (Mi → Fr, Slot B)', () => {
      const lead: FolgeLead = {
        ...basis,
        enrollments: [
          { channel: 'linkedin', status: 'aktiv', current_position: 4, next_due_at: '2026-10-15T07:00:00.000Z' },
          { channel: 'telefon', status: 'aktiv', current_position: 2, next_due_at: '2026-10-16T07:00:00.000Z' },
        ],
      }
      expect(folgeTextAusLead(lead, { outcome: 'no_answer', alterTaskId: null, ausRueckruf: false, kadenz: k })).toBe(
        'Nächster Versuch Fr 16.10. · Versuch 2 von 5 · Slot B 14:00–16:00',
      )
    })

    it('T-11: nach Versuch 5 auf Wiedervorlage – „nicht erreichbar“; andere Ergebnisse und Unklares → null', () => {
      const wv: FolgeLead = { ...basis, stage: 'langfristig', next_action_at: '2026-01-26T08:00:00.000Z' }
      expect(folgeTextAusLead(wv, { outcome: 'no_answer', alterTaskId: null, ausRueckruf: false, kadenz: k })).toBe(
        'Nach Versuch 5 nicht erreichbar · Wiedervorlage Mo 26.01.',
      )
      expect(folgeTextAusLead(wv, { outcome: 'busy', alterTaskId: null, ausRueckruf: false })).toBeNull()
      expect(folgeTextAusLead(basis, { outcome: 'voicemail_left', alterTaskId: null, ausRueckruf: false })).toBeNull()
    })
  })
})
