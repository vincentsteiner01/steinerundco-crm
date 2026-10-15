// Erfundene Testdaten (keine echten Leads). IDs sind Platzhalter, keine UUIDs aus der Live-DB.
export const ICH = 'u-vincent'
export const MIKE = 'u-mike'

export const MITGLIEDER = [
  {
    id: ICH,
    display_name: 'Vincent Steiner',
    short_name: 'Vincent',
    email: 'vincent@steinerundco.de',
    signature: 'Vincent',
    calendly_url: 'https://calendly.com/beispiel/15min',
    caller_number_e164: null,
  },
  {
    id: MIKE,
    display_name: 'Mike Muster',
    short_name: 'Mike',
    email: 'mike@steinerundco.de',
    signature: null,
    calendly_url: null,
    caller_number_e164: null,
  },
]

export const NORM = 'linkedin.com/in/tilda-testfall-4a2b'

export const LEAD = {
  id: 'lead-1',
  salutation: 'frau',
  title: null,
  first_name: 'Tilda',
  last_name: 'Testfall',
  full_name: 'Tilda Testfall',
  role: 'geschaeftsfuehrer',
  role_title: 'Geschäftsführerin',
  company_name: 'Sonnenfeld Solartechnik GmbH',
  city: 'Lüneburg',
  stage: 'vernetzt',
  ended_reason: null,
  owner_id: ICH,
  do_not_contact: false,
  do_not_contact_channels: null,
  linkedin_url_norm: NORM,
  email: null,
  phone_e164: null,
  inbound_unanswered_since: null,
  call_basis: null,
  call_basis_note: null,
  deleted_at: null,
  companies: { do_not_contact: false },
}

export const ENROLLMENT = {
  id: 'enr-1',
  sequence_id: 'seq-a',
  member_id: ICH,
  status: 'aktiv',
  current_step_id: 'st-2',
  next_due_at: '2026-10-15T07:00:00Z',
  sequences: { key: 'linkedin_standard', name: 'LinkedIn Standard (ohne Notiz)' },
}

export const SCHRITTE = [
  { id: 'st-1', position: 1, name: 'Opener', template_id: 't-open', is_opener: true },
  { id: 'st-2', position: 2, name: 'Kurzfristig 1', template_id: 't-fu1', is_opener: false },
  { id: 'st-3', position: 3, name: 'Kurzfristig 2', template_id: 't-fu2', is_opener: false },
  { id: 'st-4', position: 4, name: 'Kurzfristig 3 (Breakup)', template_id: 't-fu3', is_opener: false },
  { id: 'st-5', position: 5, name: 'Langfristig 1', template_id: 't-l1', is_opener: false },
  { id: 'st-6', position: 6, name: 'Langfristig 2', template_id: 't-l2', is_opener: false },
]

export const VORLAGEN = [
  { id: 't-open', key: 'li_eroeffnung_v1', name: 'Eröffnung V1', body: 'Hallo [Vorname], danke fürs Vernetzen.', phase: 'eroeffnung' },
  { id: 't-kb', key: 'li_eroeffnung_kundenbetreuer', name: 'Eröffnung Kundenbetreuer', body: 'Hallo [Vorname], kurze Frage zum Innendienst.', phase: 'eroeffnung' },
  { id: 't-fu1', key: 'li_fu_kurz_1', name: 'Kurzfristig 1', body: 'Hallo [Vorname], kurz nachgefasst zu [Reaktion] – passt es?', phase: 'follow_up' },
  { id: 't-fu2', key: 'li_fu_kurz_2', name: 'Kurzfristig 2', body: 'Hallo [Vorname], noch einmal kurz.', phase: 'follow_up' },
  { id: 't-ja1', key: 'li_bedarf_ja_v1', name: 'Ja (V1)', body: 'Danke [Vorname], so läuft es ab: …', phase: 'bedarfsermittlung' },
  { id: 't-l1', key: 'li_fu_lang_1', name: 'Langfristig 1', body: 'Hallo [Vorname], lange nichts gehört.', phase: 'langfristig' },
]
