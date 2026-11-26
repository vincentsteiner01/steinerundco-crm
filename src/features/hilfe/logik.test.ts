// Reine Logik der Hilfe nach dem Neustart (25.11.2026): Themenliste, Suche, Wortlaut-Regeln, Auszeichnung.
// 26.11.2026: Thema „KPIs“ ist zurück (neuer Schlüssel `kpis`; das alte `kpis-team` bleibt entfernt).
// Die Links der Themen prüft links.test.ts gegen die Routentabelle.
import { describe, expect, it } from 'vitest'
import { klartext, linkZiele } from './markup'
import {
  bloeckeVon,
  HAEUFIGE_FRAGEN,
  sucheThemen,
  THEMEN,
  themaRohtexte,
  themaText,
  themaVon,
  type Thema,
} from './themen'

/** Neu geschriebene Themen – „E-Mail“ und „E-Mail-Kampagnen“ sind übernommen und dürfen länger sein. */
const NEU = ['erste-schritte', 'leads', 'leitfaeden', 'kpis', 'team-einstellungen', 'archiv']

const woerter = (t: Thema) => klartext(themaRohtexte(t).join(' ')).split(/\s+/).filter(Boolean).length

describe('Themen', () => {
  it('genau die acht Themen des einfachen CRM, in dieser Reihenfolge', () => {
    expect(THEMEN.map((t) => t.key)).toEqual([
      'erste-schritte',
      'leads',
      'leitfaeden',
      'email',
      'kampagnen',
      'kpis',
      'team-einstellungen',
      'archiv',
    ])
    for (const t of THEMEN) {
      expect(t.titel.trim(), t.key).not.toBe('')
      expect(t.kurz.trim(), t.key).not.toBe('')
      expect(bloeckeVon(t, null).length, t.key).toBeGreaterThan(0)
    }
  })

  it('entfernte Themen gibt es nicht mehr', () => {
    for (const alt of [
      'dein-tag',
      'heute',
      'linkedin',
      'verbindungen',
      'recherche',
      'telefon',
      'kpis-team',
      'import',
      'tastenkuerzel',
      'feedback',
      'noch-nicht',
    ])
      expect(themaVon(alt), alt).toBeUndefined()
  })

  it('häufige Fragen: höchstens drei, kurz, jede zeigt auf ein Thema, ohne Auszeichnung', () => {
    expect(HAEUFIGE_FRAGEN.length).toBeGreaterThan(0)
    expect(HAEUFIGE_FRAGEN.length).toBeLessThanOrEqual(3)
    for (const f of HAEUFIGE_FRAGEN) {
      expect(themaVon(f.thema), f.frage).toBeDefined()
      // die Übersicht zeigt die Antwort als reinen Text
      expect(klartext(f.antwort), f.frage).toBe(f.antwort)
      expect(f.antwort.split(/\s+/).length, f.frage).toBeLessThanOrEqual(30)
    }
    expect(HAEUFIGE_FRAGEN.map((f) => f.thema)).toContain('archiv')
  })

  it('neue Themen bleiben kurz – höchstens eine Bildschirmseite', () => {
    // Gemessen bei 1440 × 900: „Leads“ (178 Wörter) endet bei 884 px. Wer hier anstößt, kürzt den Text, nicht die Grenze.
    for (const key of NEU) expect(woerter(themaVon(key)!), key).toBeLessThanOrEqual(180)
  })

  it('Leads: vier Listen, die Knöpfe je Liste, Lead-Blatt, Entfernen löscht nichts', () => {
    const text = themaText(themaVon('leads')!)
    for (const liste of ['angeschrieben', 'gespräch vereinbart', 'im geschäft', 'verloren'])
      expect(text).toContain(liste)
    expect(text).toMatch(/in „angeschrieben“: der grüne knopf „hat interesse“ legt die karte in „gespräch vereinbart“/)
    expect(text).toMatch(/in „gespräch vereinbart“: der grüne knopf „im geschäft“ legt sie in „im geschäft“/)
    expect(text.match(/der rote knopf „kein interesse“ legt sie in „verloren“/g)).toHaveLength(2)
    for (const wort of ['lead hinzufügen', 'ziehen', 'rückgängig', 'suchen', 'zugehörigkeit', 'e-mail-erlaubnis'])
      expect(text, wort).toContain(wort)
    for (const feld of ['name', 'anrede', 'firma', 'linkedin-link', 'liste', 'notiz'])
      expect(text, feld).toContain(feld)
    expect(text).toMatch(/„karte entfernen“ .*nur vom board\. gelöscht wird nichts/)
  })

  it('Leitfäden: blauer Knopf, Platzhalter-Knöpfe, Text kopieren, „Löschen“ archiviert nur', () => {
    const text = themaText(themaVon('leitfaeden')!)
    expect(text).toContain('großen blauen knopf „leitfaden schreiben“')
    for (const chip of ['anrede', 'vorname', 'nachname', 'unternehmen', 'absender vorname'])
      expect(text).toContain(chip)
    expect(text).toContain('[vorname]')
    expect(text).toContain('„text kopieren“')
    expect(text).toMatch(/„löschen“\. er verschwindet aus deiner liste, bleibt aber gespeichert/)
  })

  it('KPIs: acht Zahlen, vier Zeiträume, zwei Zahlen von Hand – alles andere zählt das Board', () => {
    const thema = themaVon('kpis')!
    expect(thema.titel).toBe('KPIs')
    expect(themaRohtexte(thema).flatMap(linkZiele)).toEqual(['/kpis'])
    const text = themaText(thema)
    for (const zahl of [
      'vernetzungen versendet und angenommen',
      'angeschrieben',
      'gespräch vereinbart',
      'im geschäft',
      'verloren',
      'e-mails gesendet und antworten',
    ])
      expect(text, zahl).toContain(zahl)
    expect(text).toContain('monat, woche, 7 oder 30 tage')
    expect(text).toContain('vergleich zum zeitraum davor')
    expect(text).toContain('die kleine prozentzahl daneben ist der anteil an der stufe davor')
    expect(text).toContain('deine zahlen oder die des teams')
    // von Hand: einmal am Tag, die Zahl des ganzen Tages, neu eintragen ersetzt, „Gestern“ zum Nachtragen
    expect(text).toMatch(/„meine vernetzungen“\. dort trägst du einmal am tag ein/)
    expect(text).toContain('die zahl des ganzen tages')
    expect(text).toContain('neu eintragen ersetzt die alte zahl')
    expect(text).toContain('mit „gestern“ trägst du nach')
    // von selbst: der Klick zählt, zurück nimmt die Zahl heraus, vom Board nehmen ändert nichts
    expect(text).toMatch(
      /karte anlegen zählt als angeschrieben, „hat interesse“ als gespräch vereinbart, „im geschäft“ als im geschäft, „kein interesse“ als verloren – am tag des klicks/,
    )
    expect(text).toMatch(/karte zurück oder klickst auf „rückgängig“, ist die zahl wieder weg/)
    expect(text).toContain('eine karte vom board zu nehmen ändert keine zahlen – außer direkt nach dem anlegen')
    expect(text).toContain('die zahl gehört der person, der die karte gehört')
    expect(text).toContain('zahlen bis 24.11.2026 stammen aus dem alten crm')
  })

  it('Team & Einstellungen nennt die fünf Bereiche, Archiv den gesicherten Stand', () => {
    const team = themaText(themaVon('team-einstellungen')!)
    for (const b of ['profil', 'passcode', 'sperrliste', 'feiertage', 'export & backup']) expect(team).toContain(b)
    const archiv = themaText(themaVon('archiv')!)
    expect(themaVon('archiv')!.titel).toBe('Wo ist das alte CRM?')
    expect(archiv).toContain('nichts gelöscht')
    expect(archiv).toContain('25.11.2026')
    expect(archiv).toContain('vollständig gesichert')
    expect(archiv).toMatch(/mit ihrem linkedin-link neu als karte hinzu, bekommst du denselben lead zurück/)
    expect(archiv).toContain('die alten leitfäden sind archiviert')
    // 26.11.2026: KPIs stehen nicht mehr unter den entfallenen Seiten
    expect(archiv).toContain('heute, pipeline, telefon und import gibt es nicht mehr')
    expect(archiv).toContain('die kpis sind zurück')
  })

  it('übernommene Themen ohne Verweise auf Entferntes: Erlaubnis in der Lead-Karte, nichts „unter Heute“', () => {
    const email = themaText(themaVon('email')!)
    expect(email).toContain('„erlaubnis erfassen“ und „widerspruch erfassen“ stehen in der lead-karte')
    expect(email).not.toMatch(/palette|verbindungen einrichten|linkedin-benachrichtigungen/)
    const kampagnen = themaText(themaVon('kampagnen')!)
    expect(kampagnen).toContain('in der lead-karte „erlaubnis erfassen“')
    expect(kampagnen).not.toMatch(/unter heute/)
  })

  it('Suche findet die neuen Themen; mehrere Wörter = alle müssen passen', () => {
    expect(sucheThemen('').length).toBe(THEMEN.length)
    expect(sucheThemen('xyzzy')).toEqual([])
    const erstes = (q: string) => sucheThemen(q)[0]?.key
    expect(erstes('board')).toBe('leads')
    expect(erstes('karte hinzufügen')).toBe('leads')
    // „Kein Interesse“ steht auch in „Erste Schritte“ – das Stichwort holt das Board-Thema nach oben
    // (das KPI-Thema nennt die Knöpfe auch – es steht dahinter)
    expect(sucheThemen('kein interesse').map((t) => t.key)).toEqual(['leads', 'erste-schritte', 'kpis'])
    expect(sucheThemen('rückgängig').map((t) => t.key)).toEqual(['leads', 'kpis'])
    expect(erstes('karte entfernen')).toBe('leads')
    expect(erstes('platzhalter')).toBe('leitfaeden')
    expect(erstes('text kopieren')).toBe('leitfaeden')
    expect(sucheThemen('passcode').map((t) => t.key)).toEqual(['team-einstellungen'])
    expect(erstes('backup')).toBe('team-einstellungen')
    // „Feiertage“ und „Sperrliste“ stehen auch bei den Kampagnen – die Einstellungen stehen oben
    expect(erstes('feiertage')).toBe('team-einstellungen')
    expect(erstes('sperrliste')).toBe('team-einstellungen')
    expect(erstes('kpis')).toBe('kpis')
    expect(erstes('vernetzungen')).toBe('kpis')
    expect(erstes('heute eintragen')).toBe('kpis')
    expect(erstes('nachtragen')).toBe('kpis')
    expect(erstes('kennzahlen')).toBe('kpis')
    expect(erstes('altes crm')).toBe('archiv')
    expect(erstes('pipeline')).toBe('archiv')
    expect(erstes('erste schritte')).toBe('erste-schritte')
    // Ranking: Titel vor Kurztext/Stichworten vor Fließtext
    expect(erstes('gmail')).toBe('email')
    expect(erstes('erlaubnis')).toBe('email')
    expect(erstes('postfach verbinden')).toBe('email')
    expect(sucheThemen('postfach verbinden').map((t) => t.key)).toEqual(['email', 'kampagnen'])
    expect(erstes('dkim')).toBe('kampagnen')
  })

  it('keine Tastenhinweise, keine Touren, kein Feedback', () => {
    const texte = [...THEMEN.flatMap((t) => themaRohtexte(t)), ...HAEUFIGE_FRAGEN.flatMap((f) => [f.frage, f.antwort])]
    for (const t of texte) {
      // geschweifte Klammern waren die Tasten-Auszeichnung – übrig ist nur {{geplant}}
      expect(t.replaceAll('{{geplant}}', ''), t).not.toMatch(/[{}]/)
      expect(t, t).not.toMatch(/[⌘⌥⇧⌃↵⎋]/)
      expect(t, t).not.toMatch(/tastenk|\btaste\b|palette|\btour\b|feedback|zeig’s mir/i)
    }
  })

  it('Wortlaut: deutsche Typografie (keine geraden Anführungszeichen, kein „...“, kein Ausrufezeichen, kein „erfolgreich“)', () => {
    const texte = [
      ...THEMEN.map((t) => themaText(t, 'vincent') + themaText(t, 'mike')),
      ...HAEUFIGE_FRAGEN.map((f) => `${f.frage} ${f.antwort}`),
    ]
    for (const t of texte) {
      expect(t).not.toMatch(/["']/)
      expect(t).not.toContain('...')
      expect(t).not.toContain('!')
      expect(t).not.toMatch(/erfolgreich/i)
      expect(t).not.toMatch(/\s-\s/)
      expect(t).not.toMatch(/\bok\b/i)
    }
  })

  it('Blöcke dürfen von der angemeldeten Person abhängen (Themen-Modell)', () => {
    const thema: Thema = {
      key: 'probe',
      titel: 'Probe',
      kurz: 'Nur für diesen Test.',
      bloecke: (person) => [{ art: 'absatz', text: person === 'mike' ? 'Für Mike' : 'Für alle anderen' }],
    }
    expect(bloeckeVon(thema, 'mike')).toEqual([{ art: 'absatz', text: 'Für Mike' }])
    expect(themaText(thema, 'vincent')).toContain('für alle anderen')
  })

  it('Auszeichnung: Klartext für die Suche, Link-Ziele für die Routen-Prüfung', () => {
    expect(klartext('**Erst** auf [Leads](/leads) klicken {{geplant}}')).toBe('Erst auf Leads klicken geplant')
    expect(linkZiele('Auf [Leads](/leads) oder [Profil](/einstellungen/profil), nicht [Vorname].')).toEqual([
      '/leads',
      '/einstellungen/profil',
    ])
    // ein Platzhalter in eckigen Klammern ist kein Link
    expect(klartext('Platzhalter wie [Vorname] bleiben stehen.')).toBe('Platzhalter wie [Vorname] bleiben stehen.')
  })
})
