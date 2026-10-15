// Reine Helfer: Schlüssel, Suche, Baum-Gruppen (LF-09/LF-10), Statistik aus Aktivitäten (LF-06), Editor-/Vorschau-Helfer, Entwurf.
import { describe, expect, it } from 'vitest'
import type { ActivityZeitraum } from '@/data/activities'
import { VORLAGE } from '@/lib/vorlagenKeys'
import { vorlage } from '@/test/fixtures/vorlagen'
import { ALLE, BEDARF, EMAIL, JA_V1_ID, SEQUENZEN_MIT_STANDARD, TELEFON } from './_testHilfe'
import {
  istManuell,
  kopierGrund,
  platzhalterEinfuegen,
  platzhalterTreffer,
  quelleLabel,
  segmente,
} from './editorHelfer'
import { entwurfLeer, entwurfVon, istGleich, kopieVon, zeileAusEntwurf } from './entwurf'
import {
  baumGruppen,
  baumReihenfolge,
  fmtTage,
  kanalAusParam,
  kopieKey,
  neuerKey,
  nutzung,
  passtSuche,
  schrittVerwendungen,
  standardChip,
  slug,
  sortiert,
  statistikAusAktivitaeten,
} from './helfer'

describe('Schlüssel', () => {
  it('slug: Umlaute, Sonderzeichen, Länge', () => {
    expect(slug('Gesprächseröffnung (V2) – Kundenbetreuer!')).toBe('gespraechseroeffnung_v2_kundenbetreuer')
    expect(slug('  Ärger & Straße ')).toBe('aerger_strasse')
    expect(slug('x'.repeat(60)).length).toBe(40)
  })
  it('neuerKey: <präfix>_<slug>, eindeutig mit Zähler', () => {
    expect(neuerKey('linkedin', 'Pitch C', [])).toBe('li_pitch_c')
    expect(neuerKey('telefon', 'Einstieg', [])).toBe('tel_einstieg')
    expect(neuerKey('email', 'Infomail kurz', [])).toBe('em_infomail_kurz')
    expect(neuerKey('linkedin', 'Pitch C', ['li_pitch_c'])).toBe('li_pitch_c_2')
    expect(neuerKey('linkedin', 'Pitch C', ['li_pitch_c', 'li_pitch_c_2'])).toBe('li_pitch_c_3')
    expect(neuerKey('linkedin', '', [])).toBe('li_leitfaden')
  })
  it('kopieKey: _kopie, eindeutig', () => {
    expect(kopieKey(VORLAGE.li_pitch_a, [])).toBe(`${VORLAGE.li_pitch_a}_kopie`)
    expect(kopieKey(VORLAGE.li_pitch_a, [`${VORLAGE.li_pitch_a}_kopie`])).toBe(`${VORLAGE.li_pitch_a}_kopie_2`)
  })
  it('kanalAusParam', () => {
    expect(kanalAusParam('telefon')).toBe('telefon')
    expect(kanalAusParam('x')).toBe('linkedin')
    expect(kanalAusParam(null)).toBe('linkedin')
  })
})

describe('Suche und Sortierung', () => {
  it('passtSuche: jedes Wort in Name, Wann verwenden oder Key', () => {
    const t = vorlage('k', { name: 'Ja (V1) Entlastung', when_to_use: 'Nach positiver Antwort' })
    expect(passtSuche(t, '')).toBe(true)
    expect(passtSuche(t, 'ja entlastung')).toBe(true)
    expect(passtSuche(t, 'positiver')).toBe(true)
    expect(passtSuche(t, 'nein')).toBe(false)
  })
  it('sortiert: Phasen-Reihenfolge des Kanals, dann sort_order, dann Name', () => {
    const keys = sortiert(TELEFON, 'telefon').map((t) => t.phase)
    expect(keys).toEqual([
      'gatekeeper',
      'einstieg',
      'problem',
      'qualifizierung',
      'pitch',
      'einwand',
      'abschluss',
      'mailbox',
      'rueckruf',
      'datenschutz',
    ])
  })
})

describe('baumGruppen', () => {
  it('Telefon: zehn Phasen in phasen.ts-Reihenfolge, je eine Vorlage (LF-09)', () => {
    const g = baumGruppen(ALLE, 'telefon', '')
    expect(g.map((x) => x.def.label)).toEqual([
      'Zentrale',
      'Einstieg',
      'Problem',
      'Qualifizierung',
      'Pitch',
      'Einwände',
      'Abschluss',
      'Mailbox',
      'Rückruf',
      'Datenschutz',
    ])
    expect(g.every((x) => x.eintraege.length === 1)).toBe(true)
  })
  it('E-Mail: zehn Vorlagen inkl. Strategiegespräch-Zusammenfassung und No-Show (LF-10)', () => {
    const g = baumGruppen(ALLE, 'email', '')
    const keys = baumReihenfolge(g).map((id) => EMAIL.find((t) => t.id === id)?.key)
    expect(keys).toHaveLength(10)
    expect(keys).toContain(VORLAGE.em_strategiegespraech_zusammenfassung)
    expect(keys).toContain(VORLAGE.em_noshow_erstgespraech)
    expect(g.find((x) => x.def.key === 'transaktional')?.eintraege.map((t) => t.key)).toContain(
      VORLAGE.em_noshow_erstgespraech,
    )
  })
  it('LinkedIn: leere Phasen bleiben sichtbar, inaktive Vorlagen stehen im Baum, Phase-Filter und Suche greifen', () => {
    const g = baumGruppen(ALLE, 'linkedin', '')
    expect(g.map((x) => x.def.key)).toEqual([
      'vernetzung',
      'eroeffnung',
      'bedarfsermittlung',
      'pitch',
      'follow_up',
      'langfristig',
    ])
    expect(g[0]?.eintraege).toEqual([])
    expect(g[1]?.eintraege.some((t) => !t.active)).toBe(true)
    expect(baumGruppen(ALLE, 'linkedin', '', 'pitch').map((x) => x.def.key)).toEqual(['pitch'])
    const suche = baumGruppen(ALLE, 'linkedin', 'pitch b')
    expect(suche).toHaveLength(1)
    expect(suche[0]?.eintraege.map((t) => t.name)).toEqual(['Pitch B'])
    expect(baumGruppen(ALLE, 'linkedin', 'gibtsnicht')).toEqual([])
  })
})

describe('Nutzung und Verwendungen', () => {
  it('nutzung: null ohne Zeile oder ohne Sendungen', () => {
    expect(nutzung(undefined)).toBeNull()
    expect(nutzung({ gesendet: 0, antwort_quote: null } as never)).toBeNull()
    expect(nutzung({ gesendet: 12, antwort_quote: 0.25 } as never)).toEqual({ gesendet: 12, quote: 0.25 })
  })
  it('schrittVerwendungen: Sequenz A Schritt 2 nutzt Ja (V1)', () => {
    const v = schrittVerwendungen(JA_V1_ID, SEQUENZEN_MIT_STANDARD)
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ sequenzName: 'A', position: 2 })
    expect(schrittVerwendungen(BEDARF[1]?.id ?? '', SEQUENZEN_MIT_STANDARD)).toEqual([])
  })
  it('standardChip: ein Chip, Positionen dedupliziert und sortiert, Titel nennt jede Sequenz (echte Daten: „Kurzfristig 1“)', () => {
    expect(standardChip([])).toBeNull()
    expect(standardChip([{ sequenzName: 'A', position: 2 }])).toEqual({
      text: 'Standard für Schritt 2',
      titel: 'A · Schritt 2',
    })
    const chip = standardChip([
      { sequenzName: 'LinkedIn Standard (ohne Notiz)', position: 2 },
      { sequenzName: 'LinkedIn Nachfassen im Gespräch', position: 1 },
      { sequenzName: 'LinkedIn „A alt“', position: 2 },
    ])
    expect(chip?.text).toBe('Standard für Schritt 1, 2')
    expect(chip?.titel.split('\n')).toEqual([
      'LinkedIn Nachfassen im Gespräch · Schritt 1',
      'LinkedIn „A alt“ · Schritt 2',
      'LinkedIn Standard (ohne Notiz) · Schritt 2',
    ])
  })
})

function akt(p: Partial<ActivityZeitraum> & { lead_id: string; occurred_at: string }): ActivityZeitraum {
  return {
    id: 1,
    member_id: null,
    channel: 'linkedin',
    type: 'nachricht_gesendet',
    template_id: 't',
    outcome: null,
    reply_label: null,
    enrollment_id: null,
    step_id: null,
    ...p,
  }
}

describe('statistikAusAktivitaeten (LF-06)', () => {
  const heute = '2026-10-15'
  it('zählt Antworten binnen 7 Tagen je Sendung, Quote, Ø Tage, Wochenbalken', () => {
    const sendungen = [
      akt({ lead_id: 'a', occurred_at: '2026-10-13T09:00:00+02:00' }),
      akt({ lead_id: 'b', occurred_at: '2026-10-06T09:00:00+02:00' }),
      akt({ lead_id: 'c', occurred_at: '2026-08-01T09:00:00+02:00' }), // außerhalb der 8 Wochen für den Balken
    ]
    const antworten = [
      akt({ lead_id: 'a', occurred_at: '2026-10-15T09:00:00+02:00', type: 'nachricht_erhalten' }), // +2 T
      akt({ lead_id: 'b', occurred_at: '2026-10-14T09:00:00+02:00', type: 'nachricht_erhalten' }), // +8 T → zu spät
      akt({ lead_id: 'c', occurred_at: '2026-07-30T09:00:00+02:00', type: 'nachricht_erhalten' }), // vor der Sendung
    ]
    const s = statistikAusAktivitaeten(sendungen, antworten, heute)
    expect(s.gesendet).toBe(3)
    expect(s.antworten7T).toBe(1)
    expect(s.quote).toBeCloseTo(1 / 3)
    expect(s.oeTageBisAntwort).toBeCloseTo(2)
    expect(s.wochen).toHaveLength(8)
    expect(s.wochen[7]).toBe(1) // 13.10. liegt in der letzten Woche
    expect(s.wochen[6]).toBe(1) // 06.10.
    expect(s.wochen.reduce((a, b) => a + b, 0)).toBe(2)
  })
  it('ohne Sendungen: Quote und Ø null', () => {
    const s = statistikAusAktivitaeten([], [], heute)
    expect(s).toMatchObject({ gesendet: 0, antworten7T: 0, quote: null, oeTageBisAntwort: null })
  })
  it('fmtTage mit Komma', () => {
    expect(fmtTage(1.84)).toBe('1,8 T')
    expect(fmtTage(0)).toBe('0,0 T')
  })
})

describe('Editor-Helfer', () => {
  it('platzhalterTreffer: Präfix zuerst, dann enthält', () => {
    expect(platzhalterTreffer('')).toHaveLength(24)
    expect(platzhalterTreffer('nach')).toEqual(['Nachname', 'Absender Nachname'])
    expect(platzhalterTreffer('name')).toEqual(['Vorname', 'Nachname', 'Absender Vorname', 'Absender Nachname'])
    expect(platzhalterTreffer('xyz')).toEqual([])
  })
  it('platzhalterEinfuegen ersetzt „[“ + Filter durch [Name]', () => {
    expect(platzhalterEinfuegen('Hallo [Na', 6, 9, 'Nachname')).toEqual({ text: 'Hallo [Nachname]', caret: 16 })
    expect(platzhalterEinfuegen('[ rest', 0, 1, 'Vorname')).toEqual({ text: '[Vorname] rest', caret: 9 })
  })
  it('quelleLabel, istManuell', () => {
    expect(quelleLabel('Vorname')).toBe('aus dem Lead')
    expect(quelleLabel('Reaktion')).toBe('manuell')
    expect(quelleLabel('Unbekannt')).toBe('')
    expect(istManuell('Reaktion')).toBe(true)
    expect(istManuell('Tag/Uhrzeit 1')).toBe(true)
    expect(istManuell('Vorname')).toBe(false)
  })
  it('segmente: gefüllt/offen, Literal „Frau [Nachname]“', () => {
    const s = segmente('Hallo Frau [Nachname], [Reaktion]!', { last_name: 'Beispiel', salutation: 'frau' }, {})
    expect(s.map((x) => x.art)).toEqual(['text', 'gefuellt', 'text', 'gefuellt', 'text', 'offen', 'text'])
    expect(s[1]).toMatchObject({ wert: 'Frau', name: 'Anrede' })
    expect(s[3]).toMatchObject({ wert: 'Beispiel', name: 'Nachname' })
    expect(s[5]).toMatchObject({ wert: '[Reaktion]', name: 'Reaktion' })
    expect(segmente('Hallo [Reaktion]', {}, { werte: { Reaktion: 'ja' } })[1]).toMatchObject({
      art: 'gefuellt',
      wert: 'ja',
    })
  })
  it('kopierGrund nennt den ersten offenen Platzhalter', () => {
    expect(kopierGrund([])).toBeNull()
    expect(kopierGrund(['Reaktion', 'Grund'])).toBe('Erst [Reaktion] eintragen')
  })
})

describe('Entwurf', () => {
  const t = vorlage('k', { name: 'N', when_to_use: 'W', notes: null, subject: null, form_of_address: 'du', body: 'B' })
  it('entwurfVon ↔ istGleich ↔ zeileAusEntwurf', () => {
    const e = entwurfVon(t)
    expect(e).toEqual({
      name: 'N',
      phase: 'eroeffnung',
      when_to_use: 'W',
      form_of_address: 'du',
      notes: '',
      subject: '',
      body: 'B',
    })
    expect(istGleich(e, entwurfVon(t))).toBe(true)
    expect(istGleich(e, { ...e, body: 'C' })).toBe(false)
    const z = zeileAusEntwurf(t, { ...e, notes: '  ', when_to_use: '', form_of_address: '' }, 'linkedin', 'egal')
    expect(z).toMatchObject({ id: t.id, key: 'k', notes: null, when_to_use: null, form_of_address: null, body: 'B' })
    const neu = zeileAusEntwurf(null, { ...e, name: ' Neu ' }, 'telefon', 'tel_neu')
    expect(neu).toMatchObject({ key: 'tel_neu', channel: 'telefon', active: true, name: 'Neu' })
    expect('id' in neu).toBe(false)
  })
  it('entwurfLeer nimmt die erste Phase des Kanals; kopieVon setzt variant_of und (Kopie)', () => {
    expect(entwurfLeer('telefon').phase).toBe('gatekeeper')
    expect(entwurfLeer('linkedin').phase).toBe('vernetzung')
    const k = kopieVon({ ...t, active: false }, 'k_kopie')
    expect(k).toMatchObject({ key: 'k_kopie', name: 'N (Kopie)', variant_of: t.id, active: true, body: 'B' })
    expect('id' in k).toBe(false)
  })
})
