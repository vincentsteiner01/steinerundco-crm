// Reine Logik der Hilfe: Themen-Suche, Themen-Schlüssel und Wortlaut-Regeln (25.11.2026: Touren und Onboarding-Merker sind entfallen).
import { describe, expect, it } from 'vitest'
import { klartext, tastenTeile } from './markup'
import { bloeckeVon, HAEUFIGE_FRAGEN, sucheThemen, THEMEN, themaText, themaVon } from './themen'

describe('Themen', () => {
  it('eindeutige Schlüssel, jede Frage zeigt auf ein Thema', () => {
    expect(new Set(THEMEN.map((t) => t.key)).size).toBe(THEMEN.length)
    for (const f of HAEUFIGE_FRAGEN) expect(themaVon(f.thema)).toBeDefined()
    expect(THEMEN.map((t) => t.key)).toEqual(
      expect.arrayContaining(['erste-schritte', 'dein-tag', 'linkedin', 'verbindungen', 'feedback', 'noch-nicht']),
    )
    // Runde 3: „Verbindungen einrichten“ steht direkt hinter dem LinkedIn-Thema
    const keys = THEMEN.map((t) => t.key)
    expect(keys.indexOf('verbindungen')).toBe(keys.indexOf('linkedin') + 1)
    // die Gmail-Erkennung ist gebaut – nicht mehr als „geplant“ geführt
    expect(themaText(themaVon('noch-nicht')!)).not.toMatch(/geplant linkedin-antworten über die gmail/)
    expect(themaText(themaVon('noch-nicht')!)).toContain('grenzen der linkedin-brücke')
    // Runde 3: {A} im CRM trägt nur die Reaktion nach (antwortErfassen) – keine „zweite Antwort“ mehr als Grenze
    expect(themaText(themaVon('noch-nicht')!)).not.toMatch(/zweite antwort/)
    expect(themaText(themaVon('linkedin')!)).toMatch(/genauso hier im crm: .*nur die reaktion an dieser antwort nach/)
    expect(HAEUFIGE_FRAGEN.find((f) => f.frage.startsWith('Kommen LinkedIn'))!.antwort).toMatch(/^Zum Teil/)
  })

  it('Suche über den ganzen Text: Gmail → E-Mail, synchronisieren → LinkedIn, mehrere Wörter = alle müssen passen', () => {
    expect(sucheThemen('').length).toBe(THEMEN.length)
    expect(sucheThemen('gmail').map((t) => t.key)).toContain('email')
    expect(sucheThemen('synchronisiert').map((t) => t.key)).toContain('linkedin')
    expect(sucheThemen('call-block').map((t) => t.key)).toContain('telefon')
    expect(sucheThemen('anrufgrund uwg').map((t) => t.key)).toEqual(['telefon'])
    expect(sucheThemen('xyzzy')).toEqual([])
    // Ranking: Titel vor Kurztext/Stichworten vor Fließtext – ↵ öffnet das passende Thema
    expect(sucheThemen('gmail')[0]!.key).toBe('email')
    expect(sucheThemen('synchronisiert')[0]!.key).toBe('linkedin')
    expect(sucheThemen('was macht mike')[0]!.key).toBe('kpis-team')
    // Runde 3: die LinkedIn-Brücke ist auffindbar
    expect(sucheThemen('script')[0]!.key).toBe('verbindungen')
    expect(sucheThemen('seitenleiste').map((t) => t.key)).toEqual(expect.arrayContaining(['linkedin', 'verbindungen']))
    // seit 01.11.2026 auch die E-Mail-Kampagnen (Postfach verbinden) – E-Mail bleibt vorn
    expect(sucheThemen('gmail verbinden').map((t) => t.key)).toEqual(['email', 'verbindungen', 'kampagnen'])
  })

  it('Dein Tag: die angemeldete Person steht oben', () => {
    const tag = themaVon('dein-tag')!
    const titel = (p: 'vincent' | 'mike') =>
      bloeckeVon(tag, p).flatMap((b) => (b.art === 'zwischentitel' ? [b.text] : []))
    expect(titel('vincent')[0]).toMatch(/^Vincent/)
    expect(titel('mike')[0]).toMatch(/^Mike/)
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
    }
  })

  it('Auszeichnung: Klartext für die Suche, Akkorde getrennt', () => {
    expect(klartext('{C} kopiert, **dann** [Leads](/leads) {{geplant}}')).toBe('C kopiert, dann Leads geplant')
    expect(tastenTeile('G H')).toEqual(['G', 'H'])
    expect(tastenTeile('⌘⇧O')).toEqual(['⌘⇧O'])
    expect(tastenTeile('1–9')).toEqual(['1–9'])
  })
})
