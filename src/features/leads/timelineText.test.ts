// timelineText.test.ts (BAUPLAN § 3.3): alle Aktivitätstypen → Wortlaut, inkl. „Anfrage abgelehnt“, „Antwort gesendet“, „Auskunft exportiert“.
import { describe, expect, it } from 'vitest'
import { SETTINGS } from '@/test/fixtures/settings'
import { vorlage } from '@/test/fixtures/vorlagen'
import type { Activity, ActivityType, Member } from '@/types/domain'
import { hatAufklappText, TIMELINE_FILTER, timelineAkteur, timelineKategorie, timelineText } from './timelineText'

const MEMBERS = [
  { id: 'm1', display_name: 'Vincent Steiner', short_name: 'Vincent', initial: 'V' },
  { id: 'm2', display_name: 'Mike Meier', short_name: 'Mike', initial: 'M' },
] as unknown as Member[]

function akt(type: ActivityType, patch: Partial<Activity> = {}): Activity {
  return {
    id: 1,
    lead_id: 'l1',
    member_id: 'm1',
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
  }
}

const ALLE_TYPEN: ActivityType[] = [
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

describe('timelineText', () => {
  it('jeder Aktivitätstyp hat einen Wortlaut ohne Enum-Leck, gerade Anführungszeichen oder Ausrufezeichen', () => {
    for (const t of ALLE_TYPEN) {
      const text = timelineText(akt(t), { settings: SETTINGS, members: MEMBERS })
      expect(text, t).toBeTruthy()
      expect(text, t).not.toMatch(/["'!]/)
      expect(text, t).not.toBe(t)
    }
    // und jeder Typ ist einer Filter-Kategorie zugeordnet
    const zugeordnet = new Set(TIMELINE_FILTER.flatMap((f) => f.types))
    for (const t of ALLE_TYPEN) expect(zugeordnet.has(t), t).toBe(true)
  })

  it('Sonderfälle § 1.5 Nr. 25/32/34', () => {
    expect(timelineText(akt('vernetzung_zurueckgezogen', { note: 'abgelehnt' }))).toBe('Anfrage abgelehnt')
    expect(timelineText(akt('vernetzung_zurueckgezogen', { note: 'zurueckgezogen' }))).toBe('Anfrage zurückgezogen')
    const t = vorlage('test_bedarf_ja', { name: 'Ja (V1)' })
    expect(timelineText(akt('nachricht_gesendet', { template_id: t.id }), { templates: [t] })).toBe(
      'Antwort gesendet · Ja (V1)',
    )
    expect(
      timelineText(akt('nachricht_gesendet', { template_id: t.id, enrollment_id: 'e1' }), { templates: [t] }),
    ).toBe('Ja (V1) gesendet')
    expect(timelineText(akt('notiz', { metadata: { kind: 'auskunft_export' } }))).toBe('Auskunft exportiert (JSON)')
  })

  it('Statuswechsel mit Stufen-Labels aus settings, Übergabe mit Mitgliedsnamen, Datum kurz', () => {
    expect(
      timelineText(
        akt('stage_wechsel', {
          metadata: { prev_stage: 'gespraech_eroeffnet', stage: 'dm_beantwortet', via: 'pipeline' },
        }),
        { settings: SETTINGS },
      ),
    ).toBe('Phase geändert: Gespräch eröffnet → Antwort erhalten (per Pipeline)')
    expect(
      timelineText(
        akt('stage_wechsel', { metadata: { prev_stage: 'pitch', stage: 'dm_beantwortet', prev_rank: 60, rank: 40 } }),
        { settings: SETTINGS },
      ),
    ).toBe('Phase zurückgesetzt: Erstgespräch gepitcht → Antwort erhalten')
    expect(
      timelineText(akt('uebergabe', { metadata: { to_owner_id: 'm2' }, note: 'bitte anrufen' }), { members: MEMBERS }),
    ).toBe('Übergeben an Mike – ‚bitte anrufen‘')
    expect(timelineText(akt('meeting_geplant', { metadata: { scheduled_at: '2026-10-16T10:00:00+02:00' } }))).toBe(
      'Erstgespräch vereinbart für Fr 16.10.',
    )
    expect(
      timelineText(akt('einwilligung', { metadata: { kind: 'anrufgrund' }, outcome: 'linkedin_vernetzt_antwort' })),
    ).toBe('Anrufgrund gesetzt: LinkedIn vernetzt + Antwort')
  })

  it('Akteur-Kürzel und Kategorien, aufklappbarer Text', () => {
    expect(timelineAkteur(akt('notiz'), MEMBERS)).toBe('VS')
    expect(timelineAkteur(akt('notiz', { member_id: 'm2' }), MEMBERS)).toBe('MM')
    expect(timelineAkteur(akt('import', { member_id: null, source: 'import_sheet' }), MEMBERS)).toBe('System')
    expect(timelineKategorie('anruf')).toBe('anrufe')
    expect(timelineKategorie('stage_wechsel')).toBe('status')
    expect(timelineKategorie('sequenz_gestartet')).toBe('system')
    expect(hatAufklappText(akt('nachricht_gesendet', { note: 'Hallo …' }))).toBe(true)
    expect(hatAufklappText(akt('nachricht_erhalten', { note: 'Zitat' }))).toBe(false)
    expect(hatAufklappText(akt('notiz', { note: 'x' }))).toBe(false)
  })
})
