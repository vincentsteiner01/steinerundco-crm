// Reine Helfer der Heute-Seite: Vorlagenwahl je Karte (Opener nach Rolle H-13, Antwort nach Label H-09), Nachrichten-Ergebnis,
// Skript-Stichpunkte, Kopfzeilen, Person aus ?person=, „Nächster Schritt“, Später-Texte, Nachfass-Zähler und Gate-Wortlaut.
import { describe, expect, it } from 'vitest'
import { emailGate, nachfassZaehler as nachfassZahl } from '@/lib/gates'
import { VORLAGE } from '@/lib/vorlagenKeys'
import { emailGateText as text } from '@/texte/de'
import type { Email, Member, QueueItem } from '@/types/domain'
import { leadMitBezug, T_JA, T_KF2, T_LF1, T_NEIN_MIT, T_OPENER, T_OPENER_KB, VORLAGEN, zeile } from './_testHilfe'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'

const emailGateText = (g: ReturnType<typeof emailGate>, vorname: string | null) =>
  g.erlaubt || !g.grund ? null : text(g.grund, vorname)
import { listeAbgearbeitet, naechsterSchritt, personAusParam, spaeterHeute, spaeterText } from './heuteHelfer'
import { faelligVon, kartenKanal, kartenLabel, vorbereitetText } from './karten'
import { blockKopf, kartenArt, nachrichtErgebnis, skriptPunkte, vorlageFuerKarte } from './nachricht'

const LEER = { vorlageId: null }

describe('vorlageFuerKarte', () => {
  it('Runde 3: „Follow-up (aus Sheet)“ ohne Vorlage → nächster Kurzfristig-Schritt nach Nachfass-Zähler, sonst Langfristig 1', () => {
    const kf = (n: 1 | 2 | 3) => ({ ...T_KF2, id: `kf${n}`, key: VORLAGE[`li_fu_kurz_${n}`], name: `Kurzfristig ${n}` })
    const mitKf = [...VORLAGEN.filter((t) => t.id !== T_KF2.id), kf(1), kf(2), kf(3)]
    const sheet = (n: number | null) =>
      zeile('ueberfaellig', 9, {
        item_kind: 'wiedervorlage',
        template_id: null,
        title: 'Follow-up (aus Sheet)',
        follow_up_count: n,
      })
    const v = (i: QueueItem, lead: { role: 'unbekannt'; follow_up_count?: number | null } | null = null) =>
      vorlageFuerKarte(i, 'wiedervorlage', lead, mitKf, LEER, null, false)?.id
    expect(v(sheet(0))).toBe('kf1')
    expect(v(sheet(null))).toBe('kf1')
    expect(v(sheet(1))).toBe('kf2')
    expect(v(sheet(2))).toBe('kf3')
    expect(v(sheet(3))).toBe(T_LF1.id)
    // das Lead-Detail (frischer Zähler) gewinnt über die View-Zeile
    expect(v(sheet(0), { role: 'unbekannt', follow_up_count: 2 })).toBe('kf3')
    // jede andere Wiedervorlage ohne Vorlage → Langfristig 1
    const wv = zeile('heute', 9, { item_kind: 'wiedervorlage', template_id: null, title: 'Wiedervorlage' })
    expect(v(wv)).toBe(T_LF1.id)
    // gewechselte Vorlage (⌘⇧E) bleibt möglich
    expect(vorlageFuerKarte(sheet(0), 'wiedervorlage', null, mitKf, { vorlageId: 'kf3' }, null, false)?.id).toBe('kf3')
    // eine Vorlage aus der View gewinnt immer
    expect(
      v(zeile('heute', 9, { item_kind: 'wiedervorlage', template_id: T_LF1.id, title: 'Follow-up (aus Sheet)' })),
    ).toBe(T_LF1.id)
  })
  const opener = zeile('heute', 1, { template_id: T_OPENER.id })
  it('H-13: Opener nach Rolle – Kundenbetreuer/Innendienst bekommen „ZG – Kundenbetreuer“, sonst die Schritt-Vorlage V1', () => {
    expect(vorlageFuerKarte(opener, 'linkedin', { role: 'kundenbetreuer' }, VORLAGEN, LEER, null, true)?.id).toBe(
      T_OPENER_KB.id,
    )
    expect(vorlageFuerKarte(opener, 'linkedin', { role: 'innendienst' }, VORLAGEN, LEER, null, true)?.id).toBe(
      T_OPENER_KB.id,
    )
    expect(vorlageFuerKarte(opener, 'linkedin', { role: 'geschaeftsfuehrer' }, VORLAGEN, LEER, null, true)?.id).toBe(
      T_OPENER.id,
    )
    // kein Opener-Schritt: Rolle spielt keine Rolle
    expect(vorlageFuerKarte(opener, 'linkedin', { role: 'kundenbetreuer' }, VORLAGEN, LEER, null, false)?.id).toBe(
      T_OPENER.id,
    )
  })
  it('H-09: Antworten-Karte nach Label (+ Zitat); gewechselte Vorlage (⌘⇧E) gewinnt', () => {
    const a = zeile('antworten', 2)
    expect(
      vorlageFuerKarte(
        a,
        'antworten',
        null,
        VORLAGEN,
        LEER,
        { label: 'interessiert', note: null, occurredAt: null },
        false,
      )?.id,
    ).toBe(T_JA.id)
    expect(
      vorlageFuerKarte(
        a,
        'antworten',
        null,
        VORLAGEN,
        LEER,
        { label: 'kein_bedarf', note: 'zu teuer', occurredAt: null },
        false,
      )?.id,
    ).toBe(T_NEIN_MIT.id)
    expect(vorlageFuerKarte(a, 'antworten', null, VORLAGEN, { vorlageId: T_KF2.id }, null, false)?.id).toBe(T_KF2.id)
    expect(
      vorlageFuerKarte(
        a,
        'antworten',
        null,
        VORLAGEN,
        LEER,
        { label: 'nicht_icp', note: null, occurredAt: null },
        false,
      ),
    ).toBeNull()
  })
})

describe('nachrichtErgebnis / blockKopf / skriptPunkte', () => {
  const lead = leadMitBezug(3, { salutation: 'frau', last_name: 'Berg' })
  it('füllt über lib/platzhalter und zählt offene Platzhalter', () => {
    const e = nachrichtErgebnis(T_JA.body, lead, { werte: {} }, null)
    expect(e.text).toContain('Frau Berg')
    expect(e.offen).toEqual(['Reaktion'])
    expect(blockKopf(T_JA, e)).toBe('Leitfaden · Ja (V1) · Platzhalter 2/3 gefüllt')
    const voll = nachrichtErgebnis(T_JA.body, lead, { werte: { Reaktion: 'Das' } }, null)
    expect(voll.offen).toEqual([])
    expect(voll.text).toBe('Danke, Frau Berg – Das höre ich oft.')
  })
  it('Textsnapshot („Text bearbeiten“) zählt verbliebene [Token] als offen', () => {
    const e = nachrichtErgebnis(T_JA.body, lead, { werte: {} }, 'Eigener Text mit [Grund]')
    expect(e).toMatchObject({ text: 'Eigener Text mit [Grund]', offen: ['Grund'], bearbeitet: true })
  })
  it('Skript: Stichpunkte ohne Spiegelstriche, max. 5', () => {
    expect(skriptPunkte('- eins\n• zwei\n\n– drei\n4\n5\n6')).toEqual(['eins', 'zwei', 'drei', '4', '5'])
    expect(blockKopf(null, nachrichtErgebnis('x', lead, { werte: {} }, null), true)).toBe('Skript · –')
  })
})

describe('Karten-Helfer', () => {
  it('kartenArt nach item_kind/channel', () => {
    const k = (p: Partial<QueueItem>) => kartenArt({ item_kind: 'sequenz_schritt', channel: 'linkedin', ...p })
    expect(k({})).toBe('linkedin')
    expect(k({ channel: 'telefon' })).toBe('telefon')
    expect(k({ channel: 'email' })).toBe('email')
    expect(k({ item_kind: 'rueckruf' })).toBe('telefon')
    expect(k({ item_kind: 'antworten' })).toBe('antworten')
    expect(k({ item_kind: 'meeting' })).toBe('meeting')
    expect(k({ item_kind: 'wiedervorlage' })).toBe('wiedervorlage')
  })
  it('Label, Fälligkeit, „vorbereitet“', () => {
    expect(kartenLabel({ title: 'Kurzfristig 2', subtitle: 'Tag 7 nach KF 1' })).toBe('Kurzfristig 2 · Tag 7 nach KF 1')
    expect(kartenLabel({ title: 'Opener', subtitle: ' ' })).toBe('Opener')
    expect(faelligVon({ section: 'ueberfaellig', due_date: '2026-10-12' }, '2026-10-14')).toBe('overdue')
    expect(faelligVon({ section: 'heute', due_date: '2026-10-14' }, '2026-10-14')).toBe('today')
    expect(faelligVon({ section: 'kommend', due_date: '2026-10-19' }, '2026-10-14')).toBeNull()
    expect(vorbereitetText({ item_kind: 'sequenz_schritt', title: 'Kurzfristig 2' })).toBe('Kurzfristig 2 vorbereitet')
    expect(vorbereitetText({ item_kind: 'rueckruf', title: null })).toBe('Rückruf vorbereitet')
    expect(vorbereitetText({ item_kind: 'antworten', title: null }, 'Ja (V1)')).toBe('Ja (V1) vorgeschlagen')
  })
})

describe('heuteHelfer', () => {
  const members = [
    { id: MEMBER_V, short_name: 'Vincent', display_name: 'Vincent Steiner', email: 'vincent@x.de' },
    { id: MEMBER_M, short_name: 'Mike', display_name: 'Mike M', email: 'mike@x.de' },
  ] as unknown as Member[]
  it('?person= → Mitglied (Name, ohne Groß/Klein; „andere“)', () => {
    expect(personAusParam(members, 'mike', MEMBER_V)?.id).toBe(MEMBER_M)
    expect(personAusParam(members, 'Vincent', MEMBER_M)?.id).toBe(MEMBER_V)
    expect(personAusParam(members, 'andere', MEMBER_V)?.id).toBe(MEMBER_M)
    expect(personAusParam(members, null, MEMBER_V)).toBeNull()
    expect(personAusParam(members, 'xyz', MEMBER_V)).toBeNull()
  })
  it('„Nächster Schritt: Fr 16.10. · 2 Follow-ups, 1 Rückruf.“', () => {
    const items = [
      zeile('kommend', 1, { due_date: '2026-10-16' }),
      zeile('kommend', 2, { due_date: '2026-10-16' }),
      zeile('kommend', 3, { due_date: '2026-10-16', item_kind: 'rueckruf' }),
      zeile('kommend', 4, { due_date: '2026-10-20' }),
    ]
    expect(naechsterSchritt(items, '2026-10-14')).toBe('Nächster Schritt: Fr 16.10. · 2 Follow-ups, 1 Rückruf.')
    expect(naechsterSchritt([], '2026-10-14')).toBeNull()
  })
  it('„Später heute“: Rückrufe/Termine mit Uhrzeit, die heute noch kommen', () => {
    const jetzt = new Date('2026-10-14T10:00:00+02:00').getTime()
    const r = [
      zeile('heute', 1, {
        item_kind: 'rueckruf',
        item_id: 'a',
        due_date: '2026-10-14',
        due_at: '2026-10-14T15:00:00+02:00',
      }),
      zeile('heute', 2, {
        item_kind: 'rueckruf',
        item_id: 'b',
        due_date: '2026-10-14',
        due_at: '2026-10-14T09:00:00+02:00',
      }),
      zeile('heute', 3, {
        item_kind: 'meeting',
        item_id: 'c',
        due_date: '2026-10-14',
        due_at: '2026-10-14T11:00:00+02:00',
      }),
    ]
    expect(spaeterHeute(r, '2026-10-14', jetzt).map((i) => i.item_id)).toEqual(['c', 'a'])
  })
  it('Später-Zeile und Abschluss-Satz', () => {
    expect(spaeterText('2026-10-15', '2026-10-14')).toBe('morgen, Do 15.10.')
    expect(spaeterText('2026-10-19', '2026-10-14')).toBe('Mo 19.10.')
    expect(spaeterText(null, '2026-10-14')).toBe('verschoben')
    expect(listeAbgearbeitet(29, 3)).toBe('Liste abgearbeitet – 29 Anfragen gesendet, 3 übersprungen.')
    expect(listeAbgearbeitet(1, 0)).toBe('Liste abgearbeitet – 1 Anfrage gesendet.')
  })
})

describe('E-Mail-Gate der Karte (ux § 3.6.3)', () => {
  const mail = (p: Partial<Email>) =>
    ({
      direction: 'out',
      status: 'sent_confirmed',
      sent_at: '2026-10-10T10:00:00Z',
      status_at: '2026-10-10T10:00:00Z',
      ...p,
    }) as Email
  it('Nachfass-Zähler: gesendete Mails seit Erlaubnis/letztem Eingang ohne Antwort', () => {
    const lead = { email_consent_at: '2026-10-01T09:00:00Z', last_inbound_at: null }
    expect(
      nachfassZahl([mail({}), mail({ status: 'replied' }), mail({ status: 'draft' }), mail({ direction: 'in' })], lead),
    ).toBe(1)
    expect(nachfassZahl([mail({ sent_at: '2026-09-01T10:00:00Z' })], lead)).toBe(0)
    expect(nachfassZahl([mail({})], { ...lead, last_inbound_at: '2026-10-11T09:00:00Z' })).toBe(0)
    expect(nachfassZahl(undefined, lead)).toBe(0)
  })
  it('Wortlaut: keine Grundlage (ux § 3.3.3), drei Nachfass-Mails (§ 3.6.3 Nr. 3)', () => {
    const lead = { email: 'a@b.de', email_consent_basis: 'none' as const }
    expect(emailGateText(emailGate(lead, 0), 'Max')).toBe(
      'Keine Erlaubnis-Grundlage. Trag ein, wann und wie Max um die Mail gebeten hat – oder frag erst auf LinkedIn/am Telefon.',
    )
    const mitGrund = { email: 'a@b.de', email_consent_basis: 'requested_linkedin' as const }
    expect(emailGateText(emailGate(mitGrund, 3), 'Max')).toBe(
      'Drei Nachfass-Mails unter dieser Erlaubnis gesendet – Thema schließen oder neuen Anlass schaffen (LinkedIn/Telefon).',
    )
    expect(emailGateText(emailGate(mitGrund, 0), 'Max')).toBeNull()
    // Integration: derselbe Wortlaut wie Composer/Kanal-Karte (texte/de.ts emailGateText)
    expect(emailGateText(emailGate({ email: null, email_consent_basis: 'requested_linkedin' }, 0), null)).toBe(
      'Adresse fehlt – trag die E-Mail-Adresse ein, die die Person genannt hat.',
    )
  })
})

describe('Runde 2: verpasstSeit', () => {
  it('zeigt Stunden:Minuten statt h:mm:ss', async () => {
    const { verpasstSeit } = await import('./heuteHelfer')
    expect(verpasstSeit(35 * 60_000)).toBe('00:35')
    expect(verpasstSeit((2 * 60 + 48) * 60_000 + 50_000)).toBe('02:48')
    expect(verpasstSeit(-5)).toBe('00:00')
  })
})

describe('kartenKanal (Runde 3: „Follow-up (aus Sheet) · Wiedervorlage“ zeigte „·“ = Sonstiges)', () => {
  it('Import-Schritt mit Kanal sonstiges: mit LinkedIn-Profil → LinkedIn, ohne → kein Glyph', () => {
    expect(kartenKanal({ channel: 'sonstiges', linkedin_url: 'https://www.linkedin.com/in/beispiel' })).toBe('linkedin')
    expect(kartenKanal({ channel: 'sonstiges', linkedin_url: null })).toBeNull()
  })
  it('echte Kanäle bleiben, ohne Kanal wie bisher LinkedIn', () => {
    expect(kartenKanal({ channel: 'telefon', linkedin_url: 'https://www.linkedin.com/in/beispiel' })).toBe('telefon')
    expect(kartenKanal({ channel: 'email', linkedin_url: null })).toBe('email')
    expect(kartenKanal({ channel: null, linkedin_url: null })).toBe('linkedin')
  })
})
