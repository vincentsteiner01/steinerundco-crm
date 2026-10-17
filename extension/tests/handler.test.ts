// Service-Worker-Logik mit gemocktem Supabase-Client: welche Abfragen/RPCs mit welchen Parametern laufen, was zurückkommt.
import { describe, expect, it, vi } from 'vitest'
import { erstelleHandler, fehlerText, namensMuster } from '../src/background/handler'
import type { Antwort, Nachricht } from '../src/shared/protokoll'
import type { Angelegt, EingangEinstellungen, EingangListe, Erledigt, HeuteZahlen, Sitzung, SuchErgebnis, VerlaufSeite } from '../src/shared/typen'
import { erstelleMock, hat, op, type Abfrage, type DbAntwort } from './dbMock'
import { ENROLLMENT, ICH, LEAD, MIKE, MITGLIEDER, NORM, SCHRITTE, VORLAGEN } from './daten'

const JETZT = new Date('2026-10-15T09:30:00Z')

type Welt = {
  lead?: Record<string, unknown> | null
  enrollment?: Record<string, unknown> | null
  verbindungen?: Record<string, unknown>[]
  sperrliste?: Record<string, unknown>[]
  vorschlaege?: Record<string, unknown>[]
  letzteAntwort?: Record<string, unknown> | null
  aktivitaet?: Record<string, unknown> | null
  queue?: Record<string, unknown>[]
  eingang?: Record<string, unknown>[]
  schluessel?: Record<string, unknown>[]
  profil?: Record<string, unknown> | null
  verlauf?: Record<string, unknown>[]
  angelegt?: Record<string, unknown>[]
}

function antworter(w: Welt) {
  return (a: Abfrage): DbAntwort => {
    const ok = (data: unknown) => ({ data, error: null })
    switch (a.tabelle) {
      case 'members':
        return ok(MITGLIEDER)
      case 'sperrliste':
        return ok(w.sperrliste ?? [])
      case 'leads': {
        if (op(a, 'update')) return ok({ id: LEAD.id })
        const lead = w.lead === undefined ? LEAD : w.lead
        if (hat(a, 'eq', 'id', LEAD.id)) return ok(lead)
        if (hat(a, 'eq', 'linkedin_url_norm', NORM)) return ok(lead ? [lead] : [])
        if (op(a, 'ilike')) return ok(w.vorschlaege ?? [])
        if (op(a, 'in')) return ok([{ id: LEAD.id, full_name: 'Paula Probe' }])
        if (hat(a, 'eq', 'source_batch_id', 'batch-1')) return ok({ id: LEAD.id })
        return ok([])
      }
      case 'linkedin_connections':
        return ok(w.verbindungen ?? [])
      case 'enrollments':
        if (hat(a, 'eq', 'id', 'enr-c')) return ok({ next_due_at: '2026-10-19T07:00:00Z' })
        return ok(w.enrollment ? [w.enrollment] : [])
      case 'sequence_steps': {
        const id = op(a, 'eq')?.a
        if (id && id[0] === 'id') return ok(SCHRITTE.find((s) => s.id === id[1]) ?? null)
        return ok(SCHRITTE)
      }
      case 'templates': {
        const [feld, wert] = (op(a, 'eq')?.a ?? []) as [string, string]
        return ok(VORLAGEN.find((t) => (feld === 'id' ? t.id === wert : t.key === wert)) ?? null)
      }
      case 'activities':
        if (op(a, 'insert')) return ok({ id: 501 })
        if (hat(a, 'select', '*, templates(name)')) return ok(w.verlauf ?? [])
        if (hat(a, 'eq', 'type', 'angelegt')) return ok(w.angelegt ?? [])
        if (hat(a, 'eq', 'type', 'nachricht_erhalten')) return ok(w.letzteAntwort ?? null)
        return ok(w.aktivitaet ?? null)
      case 'v_today_queue':
        return ok(w.queue ?? [])
      case 'settings':
        return ok({ value: { default_days: 60, hat_partner_days: 180 } })
      case 'eingang':
        return ok(w.eingang ?? [])
      case 'eingang_tokens':
        return ok(w.schluessel ?? [])
      case 'member_profiles':
        if (op(a, 'update')) return ok(w.profil === null ? [] : [{ member_id: ICH }])
        return ok(w.profil ?? { linkedin_url: null })
      default:
        return { data: null, error: { message: `unerwartete Tabelle ${a.tabelle}` } }
    }
  }
}

function aufbau(w: Welt = {}, rpc?: (name: string, args: Record<string, unknown>) => DbAntwort, userId?: string | null) {
  const m = erstelleMock({ antworte: antworter(w), rpc, userId })
  const setzeBleiben = vi.fn(async () => {})
  const h = erstelleHandler({ db: m.db, setzeBleiben, jetzt: () => JETZT })
  const senden = async <T,>(n: Nachricht): Promise<T> => {
    const r = (await h.bearbeite(n)) as Antwort
    if (!r.ok) throw new Error(r.fehler)
    return r.daten as T
  }
  const fehler = async (n: Nachricht): Promise<string> => {
    const r = (await h.bearbeite(n)) as Antwort
    if (r.ok) throw new Error('erwartet: Fehler')
    return r.fehler
  }
  return { ...m, h, senden, fehler, setzeBleiben }
}

const FRISCH = { id: 77, created_at: '2026-10-15T09:29:58Z', member_id: ICH }

describe('Sitzung und Anmeldung', () => {
  it('angemeldet: liefert die Person mit Kürzel, Foto-ID und Platzhalter-Daten', async () => {
    const { senden } = aufbau()
    const s = await senden<Sitzung>({ typ: 'sitzung' })
    expect(s).toMatchObject({
      angemeldet: true,
      ich: { id: ICH, name: 'Vincent Steiner', kurz: 'Vincent', kuerzel: 'VS', personId: 'vincent' },
    })
    if (s.angemeldet) expect(s.ich.platzhalter.calendly_url).toBe('https://calendly.com/beispiel/15min')
  })

  it('ohne Sitzung: abgemeldet, keine Datenabfrage', async () => {
    const { senden, log } = aufbau({}, undefined, null)
    expect(await senden<Sitzung>({ typ: 'sitzung' })).toEqual({ angemeldet: false })
    expect(log).toHaveLength(0)
  })

  it('Passcode unter 10 Zeichen → Hinweis ohne Anfrage', async () => {
    const { fehler, auth } = aufbau()
    expect(await fehler({ typ: 'anmelden', person: 'vincent', passcode: 'kurz', bleiben: true })).toBe('Mindestens 10 Zeichen.')
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('falscher Passcode → deutscher Text; „Angemeldet bleiben“ wird vorher gesetzt', async () => {
    const t = aufbau()
    t.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } })
    expect(await t.fehler({ typ: 'anmelden', person: 'mike', passcode: 'zehn-zeichen-x', bleiben: false })).toBe(
      'Passcode stimmt nicht – versuch es nochmal.',
    )
    expect(t.setzeBleiben).toHaveBeenCalledWith(false)
    expect(t.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'mike@steinerundco.de', password: 'zehn-zeichen-x' })
  })

  it('Konto ohne Mitgliedschaft → abgemeldet und Hinweis', async () => {
    const t = aufbau({}, undefined, 'u-fremd')
    expect(await t.fehler({ typ: 'anmelden', person: 'vincent', passcode: 'zehn-zeichen-x', bleiben: true })).toBe(
      'Dieses Konto hat keinen Zugriff auf das CRM.',
    )
    expect(t.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})

describe('Heute-Zahlen', () => {
  it('zählt fällige LinkedIn-Schritte (heute + überfällig) und offene Antworten der angemeldeten Person', async () => {
    const queue = [
      { section: 'heute', item_kind: 'sequenz_schritt', channel: 'linkedin' },
      { section: 'ueberfaellig', item_kind: 'sequenz_schritt', channel: 'linkedin' },
      { section: 'heute', item_kind: 'sequenz_schritt', channel: 'telefon' },
      { section: 'kommend', item_kind: 'sequenz_schritt', channel: 'linkedin' },
      { section: 'antworten', item_kind: 'antworten', channel: 'linkedin' },
      { section: 'annahme_pruefen', item_kind: 'annahme_pruefen', channel: 'linkedin' },
    ]
    const { senden, log } = aufbau({ queue, eingang: [{ id: 'e1' }, { id: 'e2' }] })
    expect(await senden<HeuteZahlen>({ typ: 'heute' })).toEqual({
      linkedinFaellig: 2,
      linkedinUeberfaellig: 1,
      antwortenOffen: 1,
      annahmePruefen: 1,
      neueAnfragen: 0,
      eingangOffen: 2,
    })
    const e = log.find((a) => a.tabelle === 'eingang') as Abfrage
    expect(hat(e, 'in', 'status', ['neu', 'unbekannt', 'fehler'])).toBe(true)
    const q = log.find((a) => a.tabelle === 'v_today_queue') as Abfrage
    expect(hat(q, 'eq', 'member_id', ICH)).toBe(true)
  })
})

describe('Suchen und Lead-Ansicht', () => {
  const verbindungen = [
    { member_id: ICH, status: 'angenommen', requested_at: '2026-10-01T07:00:00Z', accepted_at: '2026-10-03T10:00:00Z' },
  ]

  it('Treffer über linkedin_url_norm: Stufe, Zuständig, Vernetzung, Sequenz 2 von 6 und die Schritt-Vorlage', async () => {
    const { senden, log } = aufbau({ enrollment: ENROLLMENT, verbindungen })
    const r = await senden<SuchErgebnis>({ typ: 'suchen', norm: 'https://www.linkedin.com/in/Tilda-Testfall-4a2b/', name: 'Tilda Testfall' })
    const leadAbfrage = log.find((a) => a.tabelle === 'leads') as Abfrage
    expect(hat(leadAbfrage, 'eq', 'linkedin_url_norm', NORM)).toBe(true)
    expect(log.some((a) => a.tabelle === 'leads' && op(a, 'ilike'))).toBe(false)
    expect(r.ansicht?.lead).toMatchObject({ name: 'Tilda Testfall', stufeLabel: 'Vernetzt', phaseTon: 'muted', owner: { kuerzel: 'VS' } })
    expect(r.ansicht?.meineVerbindung).toBe('angenommen')
    expect(r.ansicht?.sequenz).toMatchObject({
      sequenzName: 'LinkedIn Standard (ohne Notiz)',
      schrittId: 'st-2',
      schrittName: 'Kurzfristig 1',
      position: 2,
      anzahl: 6,
      istOpener: false,
    })
    expect(r.ansicht?.vorlage?.key).toBe('li_fu_kurz_1')
    expect(r.ansicht?.gate).toEqual({ erlaubt: true, grund: null, text: null })
    expect(r.ansicht?.platzhalterLead).toMatchObject({ first_name: 'Tilda', salutation: 'frau' })
  })

  it('Opener: Kundenbetreuer bekommen die eigene Eröffnung (OPENER_NACH_ROLLE)', async () => {
    const { senden } = aufbau({
      lead: { ...LEAD, role: 'kundenbetreuer' },
      enrollment: { ...ENROLLMENT, current_step_id: 'st-1' },
    })
    const r = await senden<SuchErgebnis>({ typ: 'suchen', norm: NORM, name: null })
    expect(r.ansicht?.sequenz?.istOpener).toBe(true)
    expect(r.ansicht?.vorlage?.key).toBe('li_eroeffnung_kundenbetreuer')
  })

  it('kein Treffer: Namensvorschläge per ILIKE und Sperrlisten-Hinweis', async () => {
    const vorschlaege = [
      { id: 'lead-9', full_name: 'Tilda Testfall', company_name: 'Andere GmbH', stage: 'neu', owner_id: MIKE, linkedin_url_norm: null, deleted_at: null },
    ]
    const { senden, log } = aufbau({ lead: null, vorschlaege, sperrliste: [{ linkedin_url_norm: NORM, channels: ['linkedin', 'telefon', 'email'] }] })
    const r = await senden<SuchErgebnis>({ typ: 'suchen', norm: NORM, name: 'Tilda Testfall' })
    expect(r.ansicht).toBeNull()
    expect(r.gesperrt).toBe(true)
    expect(r.vorschlaege).toEqual([
      { id: 'lead-9', name: 'Tilda Testfall', unternehmen: 'Andere GmbH', stufeLabel: 'Neu', owner: expect.objectContaining({ kuerzel: 'MM' }), linkedinNorm: null },
    ])
    const ilike = log.find((a) => a.tabelle === 'leads' && op(a, 'ilike')) as Abfrage
    expect(op(ilike, 'ilike')?.a).toEqual(['full_name', '%Tilda%Testfall%'])
    expect(hat(ilike, 'is', 'deleted_at', null)).toBe(true)
  })

  it('Lead im Papierkorb wird nicht als Treffer gezeigt', async () => {
    const { senden } = aufbau({ lead: { ...LEAD, deleted_at: '2026-10-10T10:00:00Z' } })
    const r = await senden<SuchErgebnis>({ typ: 'suchen', norm: NORM, name: null })
    expect(r.ansicht).toBeNull()
    expect(r.papierkorb?.id).toBe(LEAD.id)
  })

  it('Gate: Widerspruch, Sperrliste und Firmensperre sperren mit Grund', async () => {
    const a = await aufbau({ lead: { ...LEAD, do_not_contact: true } }).senden<SuchErgebnis>({ typ: 'suchen', norm: NORM, name: null })
    expect(a.ansicht?.gate).toEqual({ erlaubt: false, grund: 'widerspruch', text: 'Widerspruch – nicht kontaktieren' })
    const b = await aufbau({ sperrliste: [{ lead_id: LEAD.id, channels: ['linkedin'] }] }).senden<SuchErgebnis>({ typ: 'suchen', norm: NORM, name: null })
    expect(b.ansicht?.gate.grund).toBe('sperrliste')
    const c = await aufbau({ lead: { ...LEAD, companies: { do_not_contact: true } } }).senden<SuchErgebnis>({ typ: 'suchen', norm: NORM, name: null })
    expect(c.ansicht?.gate.grund).toBe('firma_gesperrt')
  })

  it('Antwort offen: Phase-2-Vorschlag nach Reaktion', async () => {
    const { senden } = aufbau({
      lead: { ...LEAD, inbound_unanswered_since: '2026-10-14T08:00:00Z' },
      letzteAntwort: { reply_label: 'interessiert', note: 'Klingt spannend.', occurred_at: '2026-10-14T08:00:00Z' },
    })
    const r = await senden<SuchErgebnis>({ typ: 'suchen', norm: NORM, name: null })
    expect(r.ansicht?.antwortOffen).toMatchObject({ label: 'interessiert', zitat: 'Klingt spannend.', vorlage: { key: 'li_bedarf_ja_v1' } })
  })
})

describe('Aktionen', () => {
  it('Gesendet → complete_step(gesendet), Undo-ID aus der frischen Aktivität, Text mit nächstem Schritt', async () => {
    const t = aufbau({ enrollment: ENROLLMENT, aktivitaet: FRISCH }, (name) =>
      name === 'complete_step'
        ? { data: { status: 'aktiv', current_step_id: 'st-3', next_due_at: '2026-10-19T07:00:00Z' }, error: null }
        : { data: null, error: { message: name } },
    )
    const e = await t.senden<Erledigt>({ typ: 'schrittGesendet', leadId: LEAD.id, enrollmentId: 'enr-1', schrittId: 'st-2', templateId: 't-fu1' })
    expect(t.rpc).toHaveBeenCalledWith('complete_step', { p_enrollment_id: 'enr-1', p_outcome: 'gesendet' })
    expect(e.text).toBe('Erledigt – Kurzfristig 2 am Mo 19.10.')
    expect(e.rueckgabe).toEqual({ activityIds: [77], batchId: null, leadId: LEAD.id })
    expect(e.ansicht?.lead.id).toBe(LEAD.id)
  })

  it('Gesendet mit gewechselter Vorlage übergibt p_template_id', async () => {
    const t = aufbau({ enrollment: ENROLLMENT, aktivitaet: FRISCH }, () => ({ data: { status: 'abgeschlossen', current_step_id: null, next_due_at: null }, error: null }))
    const e = await t.senden<Erledigt>({ typ: 'schrittGesendet', leadId: LEAD.id, enrollmentId: 'enr-1', schrittId: 'st-2', templateId: 't-kb' })
    expect(t.rpc).toHaveBeenCalledWith('complete_step', { p_enrollment_id: 'enr-1', p_outcome: 'gesendet', p_template_id: 't-kb' })
    expect(e.text).toBe('Erledigt – Sequenz abgeschlossen.')
  })

  it('Gesendet auf veraltetem Schritt (z. B. schon erledigt) → kein RPC', async () => {
    const t = aufbau({ enrollment: ENROLLMENT })
    expect(await t.fehler({ typ: 'schrittGesendet', leadId: LEAD.id, enrollmentId: 'enr-1', schrittId: 'st-1', templateId: null })).toMatch(
      /Schritt hat sich inzwischen geändert/,
    )
    expect(t.rpc).not.toHaveBeenCalled()
  })

  it('Gate blockt Gesendet und Anfrage gesendet – Antwort und Notiz bleiben möglich', async () => {
    const t = aufbau({ lead: { ...LEAD, do_not_contact: true }, enrollment: ENROLLMENT }, (name) =>
      name === 'log_reply' ? { data: 9, error: null } : { data: null, error: { message: name } },
    )
    expect(await t.fehler({ typ: 'schrittGesendet', leadId: LEAD.id, enrollmentId: 'enr-1', schrittId: 'st-2', templateId: null })).toBe(
      'Widerspruch – nicht kontaktieren – keine Kontaktaktion.',
    )
    expect(await t.fehler({ typ: 'anfrageGesendet', leadId: LEAD.id })).toMatch(/Widerspruch/)
    expect(t.rpc).not.toHaveBeenCalled()
    await t.senden({ typ: 'antwortErhalten', leadId: LEAD.id, label: 'kein_bedarf', zitat: null })
    await t.senden({ typ: 'notiz', leadId: LEAD.id, text: 'Hat abgesagt.' })
  })

  it('Antwort erhalten → log_reply mit Label und Zitat; Rückgabe = Aktivität', async () => {
    const t = aufbau({}, (name) => (name === 'log_reply' ? { data: 4711, error: null } : { data: null, error: { message: name } }))
    const e = await t.senden<Erledigt>({ typ: 'antwortErhalten', leadId: LEAD.id, label: 'interessiert', zitat: '  Klingt spannend.  ' })
    expect(t.rpc).toHaveBeenCalledWith('log_reply', { p_lead_id: LEAD.id, p_channel: 'linkedin', p_label: 'interessiert', p_note: 'Klingt spannend.' })
    expect(e.rueckgabe?.activityIds).toEqual([4711])
  })

  it('Antwort aus der LinkedIn-Mail (ohne Reaktion) → set_reply_label an DIESER Aktivität statt zweiter Antwort, kein Undo', async () => {
    const offen = { ...LEAD, inbound_unanswered_since: '2026-10-14T08:00:00Z' }
    const t = aufbau(
      { lead: offen, letzteAntwort: { id: 4242, reply_label: null, note: 'Gern mehr Infos.', occurred_at: '2026-10-14T08:00:00Z' } },
      (name) => (name === 'set_reply_label' ? { data: 4242, error: null } : { data: null, error: { message: name } }),
    )
    const vorher = await t.senden<SuchErgebnis>({ typ: 'suchen', norm: NORM, name: null })
    expect(vorher.ansicht?.antwortOffen).toMatchObject({ label: null, aktivitaetId: 4242, vorlage: null })
    const e = await t.senden<Erledigt>({ typ: 'antwortErhalten', leadId: LEAD.id, label: 'interessiert', zitat: 'Gern mehr Infos.' })
    expect(t.rpc).toHaveBeenCalledWith('set_reply_label', { p_activity_id: 4242, p_label: 'interessiert', p_note: 'Gern mehr Infos.' })
    expect(t.rpc).not.toHaveBeenCalledWith('log_reply', expect.anything())
    expect(e.rueckgabe).toBeNull()
    expect(e.text).toMatch(/^Reaktion erfasst/)
  })

  it('Antwort mit Reaktion schon erfasst → neue Antwort per log_reply (z. B. zweite Runde)', async () => {
    const offen = { ...LEAD, inbound_unanswered_since: '2026-10-14T08:00:00Z' }
    const t = aufbau(
      { lead: offen, letzteAntwort: { id: 4242, reply_label: 'frage', note: null, occurred_at: '2026-10-14T08:00:00Z' } },
      (name) => (name === 'log_reply' ? { data: 4711, error: null } : { data: null, error: { message: name } }),
    )
    await t.senden<Erledigt>({ typ: 'antwortErhalten', leadId: LEAD.id, label: 'interessiert', zitat: null })
    expect(t.rpc).toHaveBeenCalledWith('log_reply', { p_lead_id: LEAD.id, p_channel: 'linkedin', p_label: 'interessiert' })
    expect(t.rpc).not.toHaveBeenCalledWith('set_reply_label', expect.anything())
  })

  it('Angenommen → mark_accepted für mich; Anfrage gesendet → log_request für mich', async () => {
    const t = aufbau({ aktivitaet: FRISCH }, () => ({ data: { id: 'c-1' }, error: null }))
    await t.senden({ typ: 'angenommen', leadId: LEAD.id })
    expect(t.rpc).toHaveBeenCalledWith('mark_accepted', { p_lead_id: LEAD.id, p_member_id: ICH })
    await t.senden({ typ: 'anfrageGesendet', leadId: LEAD.id })
    expect(t.rpc).toHaveBeenCalledWith('log_request', { p_lead_id: LEAD.id, p_member_id: ICH })
  })

  it('fremde oder alte Aktivität wird nicht als Undo angeboten', async () => {
    const t = aufbau({ aktivitaet: { id: 5, created_at: '2026-10-15T08:00:00Z', member_id: ICH } }, () => ({ data: { id: 'c-1' }, error: null }))
    const e = await t.senden<Erledigt>({ typ: 'angenommen', leadId: LEAD.id })
    expect(e.rueckgabe).toBeNull()
    const f = aufbau({ aktivitaet: { ...FRISCH, member_id: MIKE } }, () => ({ data: { id: 'c-1' }, error: null }))
    expect((await f.senden<Erledigt>({ typ: 'angenommen', leadId: LEAD.id })).rueckgabe).toBeNull()
  })

  it('Notiz → activities.insert (notiz, eigene member_id)', async () => {
    const t = aufbau()
    const e = await t.senden<Erledigt>({ typ: 'notiz', leadId: LEAD.id, text: '  Ruft nächste Woche zurück.  ' })
    const ins = t.log.find((a) => a.tabelle === 'activities' && op(a, 'insert')) as Abfrage
    expect(op(ins, 'insert')?.a[0]).toEqual({ lead_id: LEAD.id, type: 'notiz', channel: 'sonstiges', note: 'Ruft nächste Woche zurück.', member_id: ICH })
    expect(e.rueckgabe?.activityIds).toEqual([501])
  })

  it('Antwort-Karte „Gesendet“ wie im CRM: log_outbound + Sequenz C bzw. Wiedervorlage bei „Später“', async () => {
    const rpcs = (name: string): DbAntwort => {
      if (name === 'log_outbound') return { data: 9001, error: null }
      if (name === 'enroll') return { data: 'enr-c', error: null }
      if (name === 'set_wiedervorlage') return { data: { due_at: '2026-12-14T08:00:00Z' }, error: null }
      return { data: null, error: { message: name } }
    }
    const offen = { ...LEAD, inbound_unanswered_since: '2026-10-14T08:00:00Z' }
    const ja = aufbau({ lead: offen, letzteAntwort: { reply_label: 'interessiert', note: null } }, rpcs)
    const e = await ja.senden<Erledigt>({ typ: 'antwortGesendet', leadId: LEAD.id, templateId: 't-ja1' })
    expect(ja.rpc).toHaveBeenCalledWith('log_outbound', { p_lead_id: LEAD.id, p_channel: 'linkedin', p_kind: 'nachricht', p_template_id: 't-ja1' })
    expect(ja.rpc).toHaveBeenCalledWith('enroll', { p_lead_id: LEAD.id, p_sequence_key: 'linkedin_nachfassen_im_gespraech' })
    expect(e.text).toBe('Erledigt – Antwort gesendet · Nachfassen am Mo 19.10.')
    expect(e.rueckgabe?.activityIds).toEqual([9001])

    const spaeter = aufbau({ lead: offen, letzteAntwort: { reply_label: 'spaeter', note: 'Erst im Dezember.' } }, rpcs)
    const s = await spaeter.senden<Erledigt>({ typ: 'antwortGesendet', leadId: LEAD.id, templateId: null })
    expect(spaeter.rpc).toHaveBeenCalledWith('set_wiedervorlage', { p_lead_id: LEAD.id, p_due: '2026-12-14', p_template_id: 't-l1', p_note: 'Erst im Dezember.' })
    expect(s.text).toBe('Erledigt – Antwort gesendet · Wiedervorlage am 14.12.2026.')
  })
})

describe('Als Lead anlegen (Schnellimport-Weg)', () => {
  const entwurf = {
    titel: null,
    vorname: 'Tilda',
    nachname: 'Testfall',
    unternehmen: 'Sonnenfeld Solartechnik GmbH',
    rolle: 'Geschäftsführerin',
    stadt: 'Lüneburg',
    anrede: 'frau' as const,
    profilUrl: 'https://www.linkedin.com/in/tilda-testfall-4a2b/',
  }

  it('import_leads mit Quelle schnellimport, Eigentümer = ich; danach log_request und Undo über Batch + Aktivität', async () => {
    const t = aufbau({ aktivitaet: { ...FRISCH, id: 88 } }, (name) => {
      if (name === 'import_leads') return { data: { batch_id: 'batch-1', rows: [{ status: 'neu', existing_id: null }] }, error: null }
      if (name === 'log_request') return { data: { id: 'c-1' }, error: null }
      return { data: null, error: { message: name } }
    })
    const r = await t.senden<Angelegt>({ typ: 'anlegen', entwurf, anfrageGesendet: true })
    expect(t.rpc).toHaveBeenCalledWith('import_leads', {
      p_rows: [
        {
          linkedin_url: 'https://www.linkedin.com/in/tilda-testfall-4a2b/',
          salutation: 'frau',
          first_name: 'Tilda',
          last_name: 'Testfall',
          company: 'Sonnenfeld Solartechnik GmbH',
          role_title: 'Geschäftsführerin',
          city: 'Lüneburg',
        },
      ],
      p_owner: ICH,
      p_source: 'schnellimport',
      p_label: 'Erweiterung · 15.10.2026',
    })
    expect(t.rpc).toHaveBeenCalledWith('log_request', { p_lead_id: LEAD.id, p_member_id: ICH })
    expect(r).toMatchObject({ status: 'neu', text: 'Als Lead angelegt · Anfrage erfasst.' })
    expect(r.rueckgabe).toEqual({ activityIds: [88], batchId: 'batch-1', leadId: LEAD.id })
  })

  it('Sperrliste → nicht angelegt, keine Anfrage', async () => {
    const t = aufbau({}, (name) =>
      name === 'import_leads' ? { data: { batch_id: 'batch-2', rows: [{ status: 'gesperrt' }] }, error: null } : { data: null, error: { message: name } },
    )
    const r = await t.senden<Angelegt>({ typ: 'anlegen', entwurf, anfrageGesendet: true })
    expect(r).toMatchObject({ status: 'gesperrt', ansicht: null, rueckgabe: null })
    expect(t.rpc).toHaveBeenCalledTimes(1)
  })

  it('Dublette → bestehender Lead, kein Batch-Undo', async () => {
    const t = aufbau({}, (name) =>
      name === 'import_leads'
        ? { data: { batch_id: 'batch-3', rows: [{ status: 'duplikat', existing_id: LEAD.id }] }, error: null }
        : { data: null, error: { message: name } },
    )
    const r = await t.senden<Angelegt>({ typ: 'anlegen', entwurf, anfrageGesendet: false })
    expect(r).toMatchObject({ status: 'duplikat', rueckgabe: null })
    expect(r.ansicht?.lead.id).toBe(LEAD.id)
  })

  it('ohne gültige Profil-URL oder Namen → Hinweis, kein RPC', async () => {
    const t = aufbau()
    expect(await t.fehler({ typ: 'anlegen', entwurf: { ...entwurf, profilUrl: 'https://www.linkedin.com/company/x/' }, anfrageGesendet: false })).toMatch(
      /Profil-Adresse nicht erkannt/,
    )
    expect(await t.fehler({ typ: 'anlegen', entwurf: { ...entwurf, vorname: ' ', nachname: null }, anfrageGesendet: false })).toBe(
      'Vor- oder Nachname fehlt.',
    )
    expect(t.rpc).not.toHaveBeenCalled()
  })

  it('Rückgängig: erst undo_activity, dann undo_import', async () => {
    const t = aufbau({}, () => ({ data: {}, error: null }))
    const e = await t.senden<Erledigt>({ typ: 'rueckgaengig', activityIds: [88], batchId: 'batch-1', leadId: LEAD.id })
    expect(t.rpc.mock.calls.map((c) => c[0])).toEqual(['undo_activity', 'undo_import'])
    expect(t.rpc).toHaveBeenCalledWith('undo_activity', { p_activity_id: 88 })
    expect(t.rpc).toHaveBeenCalledWith('undo_import', { p_batch_id: 'batch-1' })
    expect(e).toMatchObject({ text: 'Rückgängig gemacht.', ansicht: null })
  })

  it('Profil verknüpfen setzt die normierte URL am Lead', async () => {
    const t = aufbau()
    await t.senden({ typ: 'verknuepfen', leadId: LEAD.id, profilUrl: 'https://de.linkedin.com/in/Tilda-Testfall-4a2b?trk=x' })
    const upd = t.log.find((a) => a.tabelle === 'leads' && op(a, 'update')) as Abfrage
    expect(op(upd, 'update')?.a[0]).toEqual({ linkedin_url: 'https://www.linkedin.com/in/tilda-testfall-4a2b/', url_verified: true })
    expect(hat(upd, 'eq', 'id', LEAD.id)).toBe(true)
  })
})

describe('Fehlertexte und Hilfen', () => {
  it('übersetzt DB-, Netz- und Konfliktfehler', () => {
    expect(fehlerText({ code: 'P0001', message: 'Lead steht auf der Sperrliste' })).toBe('Lead steht auf der Sperrliste')
    expect(fehlerText(new TypeError('Failed to fetch'))).toBe('Keine Verbindung – bitte später noch einmal.')
    expect(fehlerText({ code: '23505', message: 'duplicate key' })).toMatch(/Gibt es schon/)
    expect(fehlerText({ status: 401 })).toBe('Kein Zugriff – bitte neu anmelden.')
    expect(fehlerText({ message: 'irgendwas' })).toBe('Das CRM antwortet gerade nicht – bitte noch einmal.')
  })

  it('ILIKE-Muster entschärft Platzhalterzeichen', () => {
    expect(namensMuster('Tilda Testfall')).toBe('%Tilda%Testfall%')
    expect(namensMuster('Dr. Hans-Peter von der Testheide')).toBe('%Hans-Peter%Testheide%')
    expect(namensMuster('Anna_Maria Pro%be')).toBe('%Anna\\_Maria%Pro\\%be%')
    expect(namensMuster('Al')).toBeNull()
    expect(namensMuster(null)).toBeNull()
  })

  it('nicht angemeldet → jede Datenanfrage endet mit „Bitte zuerst anmelden.“', async () => {
    const t = aufbau({}, undefined, null)
    expect(await t.fehler({ typ: 'suchen', norm: NORM, name: null })).toBe('Bitte zuerst anmelden.')
    expect(await t.fehler({ typ: 'notiz', leadId: LEAD.id, text: 'x' })).toBe('Bitte zuerst anmelden.')
  })
})

describe('Eingang (LinkedIn-Mails)', () => {
  const ZEILE = {
    id: 'e-1',
    member_id: ICH,
    art: 'nachricht',
    status: 'unbekannt',
    empfangen_at: '2026-10-15T08:00:00Z',
    absender_name: 'Paula Probe',
    linkedin_slug: null,
    text: 'Gern mehr dazu.',
    ergebnis: 'Kein passender Lead gefunden – bitte zuordnen',
    lead_id: null,
  }

  it('Liste: offene Einträge aller Mitglieder mit Lead-Namen, Postfach-Inhaber und eigenem Schlüssel-Status', async () => {
    const t = aufbau({
      eingang: [ZEILE, { ...ZEILE, id: 'e-2', art: 'einladung', status: 'neu', lead_id: LEAD.id, member_id: MIKE }],
      schluessel: [{ created_at: '2026-10-15T07:00:00Z', last_used_at: '2026-10-15T09:25:00Z' }],
    })
    const r = await t.senden<EingangListe>({ typ: 'eingang' })
    expect(r.eintraege).toHaveLength(2)
    expect(r.eintraege[0]).toMatchObject({ id: 'e-1', absender: 'Paula Probe', lead: null, member: { kurz: 'Vincent' } })
    expect(r.eintraege[1]).toMatchObject({ lead: { id: LEAD.id, name: 'Paula Probe' }, member: { kurz: 'Mike' } })
    expect(r.schluessel).toEqual({ erstelltAm: '2026-10-15T07:00:00Z', zuletztGenutzt: '2026-10-15T09:25:00Z' })
    const q = t.log.find((a) => a.tabelle === 'eingang') as Abfrage
    expect(hat(q, 'in', 'status', ['neu', 'unbekannt', 'fehler'])).toBe(true)
    const k = t.log.find((a) => a.tabelle === 'eingang_tokens') as Abfrage
    expect(hat(k, 'eq', 'member_id', ICH) && hat(k, 'is', 'revoked_at', null)).toBe(true)
  })

  it('Zuordnen → eingang_zuordnen, Ergebnis als Satz; Fehler beim Verbuchen als Hinweis; Ignorieren → eingang_ignorieren', async () => {
    const t = aufbau({}, (name, args) => {
      if (name === 'eingang_zuordnen' && args.p_lead_id === LEAD.id) return { data: { status: 'verarbeitet', ergebnis: 'Antwort verbucht – Sequenz gestoppt' }, error: null }
      if (name === 'eingang_zuordnen') return { data: { status: 'fehler', ergebnis: 'Lead steht auf der Sperrliste' }, error: null }
      if (name === 'eingang_ignorieren') return { data: { status: 'ignoriert' }, error: null }
      return { data: null, error: { message: name } }
    })
    expect(await t.senden<{ text: string }>({ typ: 'eingangZuordnen', id: 'e-1', leadId: LEAD.id })).toEqual({ text: 'Antwort verbucht – Sequenz gestoppt.' })
    expect(t.rpc).toHaveBeenCalledWith('eingang_zuordnen', { p_id: 'e-1', p_lead_id: LEAD.id })
    expect(await t.fehler({ typ: 'eingangZuordnen', id: 'e-1', leadId: 'anderer' })).toMatch(/nicht verbucht: Lead steht auf der Sperrliste/)
    await t.senden({ typ: 'eingangIgnorieren', id: 'e-1' })
    expect(t.rpc).toHaveBeenCalledWith('eingang_ignorieren', { p_id: 'e-1' })
  })

  it('Schlüssel erzeugen → eingang_token_erzeugen, nur gültiges Format; widerrufen → eingang_token_widerrufen', async () => {
    const gut = 'A'.repeat(20) + '_-' + 'b'.repeat(21)
    const t = aufbau({}, (name) => {
      if (name === 'eingang_token_erzeugen') return { data: gut, error: null }
      if (name === 'eingang_token_widerrufen') return { data: 1, error: null }
      return { data: null, error: { message: name } }
    })
    const r = await t.senden<{ schluessel: string | null; einstellungen: EingangEinstellungen }>({ typ: 'eingangSchluessel', aktion: 'erzeugen' })
    expect(r.schluessel).toBe(gut)
    expect(t.rpc).toHaveBeenCalledWith('eingang_token_erzeugen', { p_label: 'Gmail (Apps Script) · Erweiterung' })
    const w = await t.senden<{ schluessel: string | null }>({ typ: 'eingangSchluessel', aktion: 'widerrufen' })
    expect(w.schluessel).toBeNull()
    expect(t.rpc).toHaveBeenCalledWith('eingang_token_widerrufen')
    const kaputt = aufbau({}, () => ({ data: 'zu-kurz', error: null }))
    expect(await kaputt.fehler({ typ: 'eingangSchluessel', aktion: 'erzeugen' })).toMatch(/unvollständig/)
  })

  it('eigenes LinkedIn-Profil: normiert speichern; Unsinn → Hinweis ohne Schreiben', async () => {
    const t = aufbau({ profil: { linkedin_url: null } })
    await t.senden<EingangEinstellungen>({ typ: 'eingangProfil', profilUrl: 'https://de.linkedin.com/in/Test-Person-12/?trk=x' })
    const u = t.log.find((a) => a.tabelle === 'member_profiles' && op(a, 'update')) as Abfrage
    expect(op(u, 'update')?.a[0]).toEqual({ linkedin_url: 'https://www.linkedin.com/in/test-person-12/' })
    expect(hat(u, 'eq', 'member_id', ICH)).toBe(true)
    const f = aufbau()
    expect(await f.fehler({ typ: 'eingangProfil', profilUrl: 'keine adresse' })).toMatch(/nicht erkannt/)
    expect(f.log.some((a) => a.tabelle === 'member_profiles' && op(a, 'update'))).toBe(false)
  })
})

describe('Verlauf (17.10.2026)', () => {
  const zeile = (id: number, type: string, occurred_at: string, extra: Record<string, unknown> = {}) => ({
    id,
    lead_id: LEAD.id,
    member_id: ICH,
    channel: 'linkedin',
    type,
    occurred_at,
    template_id: null,
    outcome: null,
    reply_label: null,
    note: null,
    metadata: {},
    source: 'app',
    templates: null,
    ...extra,
  })

  it('liest die Aktivitäten neueste zuerst, Texte wie im CRM, Eingang mit Vornamen, Doppel-Import ausgeblendet', async () => {
    const { senden, log } = aufbau({
      verlauf: [
        zeile(5, 'nachricht_erhalten', '2026-10-16T10:00:00Z', { note: 'Klingt spannend, gern nächste Woche.', reply_label: 'interessiert' }),
        zeile(4, 'nachricht_gesendet', '2026-10-15T09:00:00Z', { note: 'Hallo Frau Testfall …', templates: { name: 'Kurzfristig 1' } }),
        zeile(3, 'anruf', '2026-10-14T08:00:00Z', { channel: 'telefon', outcome: 'no_answer', note: 'Mailbox' }),
        zeile(2, 'notiz', '2026-10-13T08:00:00Z', { channel: 'sonstiges', note: 'Kennt uns von der Messe.' }),
        zeile(1, 'import', '2026-10-12T08:00:00Z', { member_id: null, source: 'import_sheet', channel: 'sonstiges' }),
      ],
      angelegt: [{ type: 'angelegt', lead_id: LEAD.id, source: 'import_sheet' }],
    })
    const s = await senden<VerlaufSeite>({ typ: 'verlauf', leadId: LEAD.id, vor: null })
    const abfrage = log.find((a) => a.tabelle === 'activities' && hat(a, 'select', '*, templates(name)'))
    expect(abfrage && hat(abfrage, 'order', 'occurred_at', { ascending: false })).toBe(true)
    expect(abfrage && hat(abfrage, 'limit', 25)).toBe(true)
    expect(s.eintraege.map((e) => e.id)).toEqual([5, 4, 3, 2]) // „import“ neben „angelegt“ aus demselben Import entfällt
    const [antwort, gesendet, anruf, notiz] = s.eintraege
    expect(antwort).toMatchObject({ eingehend: true, wer: 'Tilda', kategorie: 'nachrichten', kanal: 'linkedin' })
    expect(antwort?.text).toContain('Klingt spannend')
    expect(gesendet).toMatchObject({ eingehend: false, wer: 'VS', details: 'Hallo Frau Testfall …' })
    expect(gesendet?.text).toContain('Kurzfristig 1')
    expect(anruf).toMatchObject({ kanal: 'telefon', kategorie: 'anrufe', details: 'Mailbox' })
    expect(notiz).toMatchObject({ kategorie: 'notizen', notiz: 'Kennt uns von der Messe.', details: null })
    expect(s.weiter).toBeNull()
  })

  it('volle Seite → Cursor auf die älteste Zeile; „vor“ wird als Keyset-Filter übergeben', async () => {
    const volle = Array.from({ length: 25 }, (_, i) =>
      zeile(100 - i, 'nachricht_gesendet', `2026-10-${String(16 - Math.floor(i / 2)).padStart(2, '0')}T08:00:00Z`),
    )
    const { senden, log } = aufbau({ verlauf: volle })
    const s = await senden<VerlaufSeite>({ typ: 'verlauf', leadId: LEAD.id, vor: null })
    expect(s.weiter).toEqual({ occurredAt: volle[24]?.occurred_at, id: 76 })
    await senden<VerlaufSeite>({ typ: 'verlauf', leadId: LEAD.id, vor: { occurredAt: '2026-10-04T08:00:00Z', id: 76 } })
    const zweite = log.filter((a) => a.tabelle === 'activities' && hat(a, 'select', '*, templates(name)'))[1]
    expect(zweite && op(zweite, 'or')?.a[0]).toBe(
      'occurred_at.lt.2026-10-04T08:00:00Z,and(occurred_at.eq.2026-10-04T08:00:00Z,id.lt.76)',
    )
  })
})
