// 4 synthetische Vorlagen mit Platzhaltern (keine Leitfaden-Texte aus dem Seed – Briefing § 4)
import type { Template } from '@/types/domain'

export function vorlage(key: string, patch: Partial<Template> = {}): Template {
  const basis = {
    id: `20000000-0000-4000-8000-${key
      .replace(/[^a-z0-9]/g, '')
      .padEnd(12, '0')
      .slice(0, 12)}`,
    key,
    channel: 'linkedin',
    phase: 'eroeffnung',
    name: key,
    when_to_use: null,
    subject: null,
    body: `Hallo [Vorname], [Unternehmen] in [Stadt] – [Reaktion]`,
    notes: null,
    variables: ['Vorname', 'Unternehmen', 'Stadt', 'Reaktion'],
    form_of_address: 'du',
    required_consent: null,
    variant_of: null,
    active: true,
    sort_order: 1,
    legacy_phase: null,
    legacy_order: null,
    created_by: null,
    created_at: '2026-10-01T09:00:00+02:00',
    updated_at: '2026-10-01T09:00:00+02:00',
  }
  return { ...(basis as unknown as Template), ...patch }
}

export const VORLAGEN: Template[] = [
  vorlage('test_eroeffnung_v1', { name: 'Test Eröffnung V1' }),
  vorlage('test_bedarf_ja', {
    name: 'Test Bedarf Ja',
    phase: 'bedarfsermittlung',
    body: 'Danke, [Anrede] [Nachname] – [Punkt 1]',
  }),
  vorlage('test_pitch', {
    name: 'Test Pitch',
    phase: 'pitch',
    body: 'Passt [Tag/Uhrzeit 1] oder [Tag/Uhrzeit 2]? [Termin-Link]',
  }),
  vorlage('test_email_info', {
    name: 'Test Infomail',
    channel: 'email',
    phase: 'infomail',
    subject: 'Kurzinfo',
    body: 'Hallo [Vorname],\n[Signatur]',
  }),
]
