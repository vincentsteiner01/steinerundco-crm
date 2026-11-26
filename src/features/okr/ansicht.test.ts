import { describe, expect, it } from 'vitest'
import { ausschnittZeilen, kpiSpanne, zaehlPerson, zielAnsicht, zusammen } from './ansicht'
import type { Fortschritt, OkrDaten, OkrEintrag, OkrErgebnis, OkrZiel } from './rechnen'

const V = 'mitglied-v'
const M = 'mitglied-m'
const HEUTE = '2026-12-10'
const FEIER = ['2026-12-25', '2026-12-26']

const ziel = (o: Partial<OkrZiel> = {}): OkrZiel => ({
  id: 'z-1',
  titel: 'Sales',
  ebene: 'monat',
  von: '2026-12-01',
  bis: '2026-12-31',
  position: 0,
  ...o,
})
const kr = (o: Partial<OkrErgebnis> = {}): OkrErgebnis => ({
  id: 'kr-1',
  ziel_id: 'z-1',
  titel: 'Posts',
  zielwert: 4,
  takt: 'zeitraum',
  je_person: true,
  quelle: 'manuell',
  faktor: 1,
  einheit: null,
  position: 0,
  ...o,
})
const eintrag = (member_id: string, tag: string, wert: number, ergebnis_id = 'kr-1'): OkrEintrag => ({
  ergebnis_id,
  member_id,
  tag,
  wert,
})
const f = (o: Partial<Fortschritt>): Fortschritt => ({
  memberId: null,
  ist: 0,
  soll: 10,
  anteil: 0,
  tempo: 0,
  status: 'offen',
  woche: null,
  heute: null,
  ...o,
})

describe('zielAnsicht', () => {
  const daten: OkrDaten = {
    ziele: [ziel()],
    ergebnisse: [
      kr(),
      kr({ id: 'kr-2', titel: 'Kommentare', zielwert: 40, je_person: false }),
      kr({ id: 'fremd', ziel_id: 'z-2' }),
    ],
    eintraege: [eintrag(V, '2026-12-04', 2), eintrag(M, '2026-12-09', 10, 'kr-2')],
    todos: [
      { id: 't-1', ergebnis_id: 'kr-1', text: 'Skript', member_id: V, erledigt_at: null, position: 0 },
      { id: 't-2', ergebnis_id: 'fremd', text: 'anderes Ziel', member_id: null, erledigt_at: null, position: 0 },
    ],
  }
  const a = zielAnsicht(ziel(), daten, [V, M], { kpi: [], eintraege: daten.eintraege }, HEUTE, FEIER)

  it('nimmt nur die Key Results des Ziels, je Person eine Zeile bzw. eine fürs Team – mit ihren To-dos', () => {
    expect(a.ergebnisse.map((e) => e.ergebnis.id)).toEqual(['kr-1', 'kr-2'])
    expect(a.ergebnisse[0]?.fortschritte.map((x) => [x.memberId, x.ist])).toEqual([
      [V, 2],
      [M, 0],
    ])
    expect(a.ergebnisse[1]?.fortschritte.map((x) => [x.memberId, x.ist])).toEqual([[null, 10]])
    expect(a.ergebnisse[0]?.todos.map((t) => t.id)).toEqual(['t-1'])
    expect(a.ergebnisse[1]?.todos).toEqual([])
  })

  it('Fortschritt = Durchschnitt der Key Results, Ampel = der schlechteste Stand', () => {
    // Posts: (2/4 + 0/4) / 2 = 0,25 · Kommentare: 10/40 = 0,25
    expect(a.anteil).toBeCloseTo(0.25)
    // Soll bis gestern für M bei den Posts: 4 / 22 × 7 = 1,27 → 0 von 1 ist unter 70 %
    expect(a.status).toBe('hinten')
  })

  it('ein Ziel ohne Key Result: 0 % – die Karte zeigt dann weder Zahl noch Ampel', () => {
    const leer = zielAnsicht(ziel({ id: 'z-9' }), daten, [V, M], { kpi: [], eintraege: [] }, HEUTE, FEIER)
    expect(leer.ergebnisse).toEqual([])
    expect(leer.anteil).toBe(0)
  })
})

describe('zusammen', () => {
  it('summiert Ist und Soll, mittelt Anteil und Tempo, nimmt die schlechteste Ampel', () => {
    expect(
      zusammen([
        f({ ist: 30, soll: 100, anteil: 0.3, tempo: 0.4, status: 'im_plan' }),
        f({ ist: 5, soll: 100, anteil: 0.05, tempo: 0.4, status: 'hinten' }),
      ]),
    ).toEqual({ ist: 35, soll: 200, anteil: 0.175, tempo: 0.4, status: 'hinten' })
  })

  it('eine Zeile bleibt, wie sie ist', () => {
    expect(zusammen([f({ ist: 1, soll: 24, anteil: 1 / 24, tempo: 0.02, status: 'im_plan' })])).toEqual({
      ist: 1,
      soll: 24,
      anteil: 1 / 24,
      tempo: 0.02,
      status: 'im_plan',
    })
  })
})

describe('ausschnittZeilen', () => {
  it('nur Key Results, die im Ausschnitt ein Soll haben', () => {
    const mit = {
      ergebnis: kr({ id: 'a' }),
      fortschritte: [f({ heute: { ist: 0, soll: 0.2 }, woche: { ist: 0, soll: 1 } })],
      todos: [],
    }
    const nurWoche = { ergebnis: kr({ id: 'b' }), fortschritte: [f({ woche: { ist: 1, soll: 3 } })], todos: [] }
    const ohne = {
      ergebnis: kr({ id: 'c' }),
      fortschritte: [f({ heute: { ist: 2, soll: 0 }, woche: { ist: 2, soll: 0 } })],
      todos: [],
    }
    const ziele = [{ ziel: ziel(), ergebnisse: [mit, nurWoche, ohne], anteil: 0, status: 'offen' as const }]
    expect(ausschnittZeilen(ziele, 'heute').map((e) => e.ergebnis.id)).toEqual(['a'])
    expect(ausschnittZeilen(ziele, 'woche').map((e) => e.ergebnis.id)).toEqual(['a', 'b'])
  })
})

describe('zaehlPerson', () => {
  const eintraege = [eintrag(M, '2026-12-08', 2), eintrag(V, '2026-12-04', 1), eintrag(M, '2026-12-09', 5, 'kr-2')]

  it('Zeile einer Person: immer bei ihr', () => {
    expect(zaehlPerson('kr-1', M, 1, V, eintraege)).toBe(M)
    expect(zaehlPerson('kr-1', M, -1, V, eintraege)).toBe(M)
  })

  it('Team-Zeile: Plus bucht bei der angemeldeten Person', () => {
    expect(zaehlPerson('kr-2', null, 1, V, eintraege)).toBe(V)
    expect(zaehlPerson('kr-2', null, 1, null, eintraege)).toBeNull()
  })

  it('Team-Zeile: Minus nimmt bei der angemeldeten Person weg, wenn sie etwas eingetragen hat', () => {
    expect(zaehlPerson('kr-1', null, -1, V, eintraege)).toBe(V)
  })

  it('Team-Zeile: Minus geht sonst an die Person mit dem jüngsten Eintrag', () => {
    expect(zaehlPerson('kr-2', null, -1, V, eintraege)).toBe(M)
    expect(zaehlPerson('kr-1', null, -1, 'jemand-drittes', eintraege)).toBe(M)
    // gar kein Eintrag: bei der angemeldeten Person (die Datenbank nimmt dann nichts weg)
    expect(zaehlPerson('kr-9', null, -1, V, eintraege)).toBe(V)
  })
})

describe('kpiSpanne', () => {
  const jahr = ziel({ id: 'z-jahr', ebene: 'jahr', bis: '2027-11-30' })
  const dez = ziel()
  const auto = kr({ quelle: 'angeschrieben' })

  it('vom frühesten Beginn bis zum spätesten Ende – höchstens bis heute', () => {
    expect(kpiSpanne([jahr, dez], [auto], HEUTE)).toEqual({ von: '2026-12-01', bis: HEUTE })
    // ein abgelaufener Monat: bis zu seinem Ende
    const nov = ziel({ von: '2026-11-01', bis: '2026-11-30' })
    expect(kpiSpanne([nov], [auto], HEUTE)).toEqual({ von: '2026-11-01', bis: '2026-11-30' })
  })

  it('nichts zu laden: keine Ziele, alles in der Zukunft oder alles von Hand gezählt', () => {
    expect(kpiSpanne([], [auto], HEUTE)).toBeNull()
    expect(kpiSpanne([ziel({ von: '2027-01-01', bis: '2027-01-31' })], [auto], HEUTE)).toBeNull()
    expect(kpiSpanne([dez], [kr()], HEUTE)).toBeNull()
    // das von selbst zählende Key Result gehört zu einem Ziel, das nicht gezeigt wird
    expect(kpiSpanne([dez], [kr({ ziel_id: 'z-anderes', quelle: 'angeschrieben' })], HEUTE)).toBeNull()
  })
})
