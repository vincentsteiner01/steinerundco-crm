// TY-01…TY-06 (ux § 8.14): kein ", ', !, ..., --, „erfolgreich“, „OK“, „Snooze“, „Owner“ in UI-Zeichenketten aus de.ts
import { describe, expect, it } from 'vitest'
import type { Activity } from '@/types/domain'
import * as de from './de'

const VERBOTEN: [RegExp, string][] = [
  [/"/, 'gerades Anführungszeichen "'],
  [/(^|[^\p{L}])'|'([^\p{L}]|$)/u, "gerades Anführungszeichen '"],
  [/!/, 'Ausrufezeichen'],
  [/\.\.\./, 'drei Punkte statt …'],
  [/--/, 'doppelter Bindestrich'],
  [/\berfolgreich\b/i, '„erfolgreich“'],
  [/\bOK\b/, '„OK“'],
  [/\bSnooze\b/i, '„Snooze“'],
  [/\bOwner\b/i, '„Owner“'],
  [/ - /, 'Bindestrich als Gedankenstrich'],
  [/\d-\d/, 'Bindestrich in Zahlenspannen (E26: „2–3“ mit Halbgeviertstrich)'],
  [/\d %/, 'normales Leerzeichen vor % (E26: U+202F)'],
]

function sammle(wert: unknown, pfad: string, acc: [string, string][]): void {
  if (typeof wert === 'string') acc.push([pfad, wert])
  else if (typeof wert === 'function') {
    const args = Array.from({ length: (wert as (...a: unknown[]) => unknown).length }, (_, i) =>
      i === 0 ? 'Muster' : i === 1 ? 'Mi 14.10.' : 3,
    )
    try {
      sammle((wert as (...a: unknown[]) => unknown)(...args), `${pfad}()`, acc)
    } catch {
      /* Funktionen mit anderen Signaturen prüft der Aktivitätsblock */
    }
  } else if (Array.isArray(wert)) wert.forEach((w, i) => sammle(w, `${pfad}[${i}]`, acc))
  else if (wert && typeof wert === 'object')
    for (const [k, v] of Object.entries(wert as Record<string, unknown>)) sammle(v, `${pfad}.${k}`, acc)
}

function aktivitaet(type: Activity['type'], patch: Partial<Activity> = {}): Activity {
  return {
    id: 1,
    lead_id: 'l',
    member_id: 'm',
    channel: 'linkedin',
    type,
    occurred_at: '2026-10-14T09:00:00+02:00',
    template_id: null,
    outcome: null,
    reply_label: null,
    note: null,
    metadata: {},
    enrollment_id: null,
    step_id: null,
    call_id: null,
    meeting_id: null,
    email_id: null,
    task_id: null,
    kpi_relevant: true,
    source: 'app',
    created_at: '2026-10-14T09:00:00+02:00',
    ...patch,
  } as Activity
}

describe('texte/de.ts', () => {
  const alle: [string, string][] = []
  const { TIMELINE_TEXT, ...rest } = de
  sammle(rest, 'de', alle)
  const typen: Activity['type'][] = [
    'angelegt',
    'import',
    'vernetzung_gesendet',
    'vernetzung_angenommen',
    'vernetzung_zurueckgezogen',
    'vernetzung_abgelaufen',
    'gespraech_eroeffnet',
    'nachricht_gesendet',
    'nachricht_erhalten',
    'pitch_gesendet',
    'anruf',
    'email_gesendet',
    'email_erhalten',
    'meeting_geplant',
    'meeting_stattgefunden',
    'meeting_no_show',
    'meeting_abgesagt',
    'meeting_verschoben',
    'notiz',
    'stage_wechsel',
    'uebergabe',
    'freigabe',
    'sequenz_gestartet',
    'sequenz_gestoppt',
    'sequenz_abgeschlossen',
    'sequenz_pausiert',
    'schritt_uebersprungen',
    'schritt_verschoben',
    'aufgabe_erledigt',
    'einwilligung',
    'widerspruch',
  ]
  for (const t of typen) alle.push([`TIMELINE_TEXT(${t})`, TIMELINE_TEXT(aktivitaet(t))])
  alle.push([
    'TIMELINE_TEXT(nachricht_erhalten mit Zitat)',
    TIMELINE_TEXT(aktivitaet('nachricht_erhalten', { reply_label: 'interessiert', note: 'kommt mir bekannt vor' })),
  ])
  alle.push([
    'TIMELINE_TEXT(stage_wechsel beendet)',
    TIMELINE_TEXT(
      aktivitaet('stage_wechsel', { outcome: 'kein_bedarf', metadata: { stage: 'beendet', prev_stage: 'pitch' } }),
    ),
  ])

  it('sammelt Zeichenketten', () => {
    expect(alle.length).toBeGreaterThan(100)
  })

  for (const [muster, name] of VERBOTEN) {
    it(`enthält kein ${name}`, () => {
      const treffer = alle.filter(([, s]) => muster.test(s)).map(([p, s]) => `${p}: ${s}`)
      expect(treffer).toEqual([])
    })
  }

  it('Timeline-Sonderfälle (§ 1.5 Nr. 25, 32, 34)', () => {
    expect(TIMELINE_TEXT(aktivitaet('vernetzung_zurueckgezogen', { note: 'abgelehnt' }))).toBe('Anfrage abgelehnt')
    expect(TIMELINE_TEXT(aktivitaet('vernetzung_zurueckgezogen', { note: 'zurueckgezogen' }))).toBe(
      'Anfrage zurückgezogen',
    )
    expect(TIMELINE_TEXT(aktivitaet('nachricht_gesendet'), { vorlage: 'Ja (V1)' })).toBe('Antwort gesendet · Ja (V1)')
    expect(TIMELINE_TEXT(aktivitaet('pitch_gesendet', { metadata: { variante: 'B' } }))).toBe('Pitch B gesendet')
    expect(TIMELINE_TEXT(aktivitaet('notiz', { metadata: { kind: 'auskunft_export' } }))).toBe(
      'Auskunft exportiert (JSON)',
    )
    expect(
      TIMELINE_TEXT(
        aktivitaet('einwilligung', { outcome: 'linkedin_vernetzt_antwort', metadata: { kind: 'anrufgrund' } }),
      ),
    ).toBe('Anrufgrund gesetzt: LinkedIn vernetzt + Antwort')
  })

  it('Stufenwechsel im Trigger-Format (from/to/ended_reason, Rang über ctx.rang)', () => {
    const ende = aktivitaet('stage_wechsel', {
      outcome: 'beendet',
      metadata: { from: 'pitch', to: 'beendet', ended_reason: 'kein_bedarf' },
    })
    expect(TIMELINE_TEXT(ende)).toBe('Beendet · Kein Bedarf')
    const rang = (s: string) => ({ pitch: 70, gespraech_eroeffnet: 30 })[s] ?? 0
    const rueck = aktivitaet('stage_wechsel', { metadata: { from: 'pitch', to: 'gespraech_eroeffnet' } })
    expect(TIMELINE_TEXT(rueck, { rang })).toBe('Phase zurückgesetzt: Erstgespräch gepitcht → Gespräch eröffnet')
    expect(TIMELINE_TEXT(rueck)).toBe('Phase geändert: Erstgespräch gepitcht → Gespräch eröffnet')
  })

  it('REAKTION_LABEL: kein_bedarf mit Note → „Nein (mit Grund)“, frage → „Rückfrage“', () => {
    expect(de.reaktionLabel('kein_bedarf', true)).toBe('Nein (mit Grund)')
    expect(de.reaktionLabel('kein_bedarf')).toBe('Nein')
    expect(de.REAKTION_LABEL.frage).toBe('Rückfrage')
    expect(de.STUFEN_LABEL.langfristig.label).toBe('Wiedervorlage')
  })
})
