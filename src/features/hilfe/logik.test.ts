// Reine Logik der Hilfe: Onboarding-Merker, Platzierung des Popovers, Zielsuche, Themen-Suche, Touren und Wortlaut-Regeln.
import { afterEach, describe, expect, it } from 'vitest'
import { TOUR_KEYS } from './ereignis'
import { klartext, tastenTeile } from './markup'
import { mitOnboarding, onboardingStatus, statusNachEnde } from './praeferenz'
import { ERGAENZUNG, tastenRegister } from './register'
import { bloeckeVon, HAEUFIGE_FRAGEN, sucheThemen, THEMEN, themaText, themaVon } from './themen'
import { mitName, TOUREN } from './touren'
import { beschneide, findeZiel, loch, platziere, scrollDelta } from './ziel'

describe('Onboarding-Merker (member_profiles.preferences.onboarding_v1)', () => {
  it('liest done/skipped, alles andere ist „nie gesehen“', () => {
    expect(onboardingStatus({ onboarding_v1: 'done' })).toBe('done')
    expect(onboardingStatus({ onboarding_v1: 'skipped' })).toBe('skipped')
    expect(onboardingStatus({})).toBeNull()
    expect(onboardingStatus(null)).toBeNull()
    expect(onboardingStatus({ onboarding_v1: 'irgendwas' })).toBeNull()
    expect(onboardingStatus([] as never)).toBeNull()
  })

  it('setzt den Status und lässt alle anderen Schlüssel stehen; null entfernt ihn', () => {
    const alt = { kanaele: { linkedin: true, telefon: false, email: true }, realtime_toasts: false }
    expect(mitOnboarding(alt, 'done')).toEqual({ ...alt, onboarding_v1: 'done' })
    expect(mitOnboarding({ ...alt, onboarding_v1: 'done' }, null)).toEqual(alt)
    expect(mitOnboarding(null, 'skipped')).toEqual({ onboarding_v1: 'skipped' })
  })

  it('Fertig schreibt done (nur einmal), Überspringen schreibt skipped nur beim ersten Mal – nie über done', () => {
    expect(statusNachEnde(null, 'fertig')).toBe('done')
    expect(statusNachEnde('skipped', 'fertig')).toBe('done')
    expect(statusNachEnde('done', 'fertig')).toBeNull()
    expect(statusNachEnde(null, 'uebersprungen')).toBe('skipped')
    expect(statusNachEnde('done', 'uebersprungen')).toBeNull()
    expect(statusNachEnde('skipped', 'uebersprungen')).toBeNull()
  })
})

describe('Popover-Platzierung', () => {
  const vp = { w: 1440, h: 900 }
  const karte = { w: 360, h: 220 }

  it('Navigation links → rechts daneben, auf Höhe des Ziels', () => {
    const p = platziere({ top: 120, left: 12, width: 208, height: 34 }, karte, vp)
    expect(p.seite).toBe('rechts')
    expect(p.left).toBe(12 + 208 + 12)
    expect(p.top).toBe(120)
  })

  it('Inhalt → unten; unten kein Platz → oben; großes Ziel → innen unten rechts (Kopf bleibt frei)', () => {
    expect(platziere({ top: 200, left: 400, width: 700, height: 120 }, karte, vp).seite).toBe('unten')
    expect(platziere({ top: 760, left: 400, width: 700, height: 100 }, karte, vp).seite).toBe('oben')
    // aufgeklappte Queue-Karte auf 1024 × 768
    const innen = platziere({ top: 232, left: 252, width: 752, height: 501 }, karte, { w: 1024, h: 768 })
    expect(innen).toEqual({ top: 733 - 220 - 16, left: 1004 - 360 - 16, seite: 'innen' })
    expect(innen.top).toBeGreaterThan(232 + 100) // Kopf und Name der Karte bleiben sichtbar
  })

  it('ohne Ziel mittig, immer im Viewport (Rand 16 px)', () => {
    expect(platziere(null, karte, vp)).toEqual({ top: 340, left: 540, seite: 'mitte' })
    const rechtsAussen = platziere({ top: 100, left: 1300, width: 120, height: 30 }, karte, vp)
    expect(rechtsAussen.left + karte.w).toBeLessThanOrEqual(vp.w - 16)
    expect(platziere(null, { w: 600, h: 400 }, { w: 390, h: 844 }).left).toBe(16)
  })

  it('Loch mit 6 px Luft, auf den Viewport begrenzt', () => {
    expect(loch({ top: 100, left: 100, width: 50, height: 20 }, vp)).toEqual({
      top: 94,
      left: 94,
      width: 62,
      height: 32,
    })
    expect(loch({ top: 0, left: 0, width: 50, height: 20 }, vp)).toEqual({ top: 0, left: 0, width: 56, height: 26 })
  })

  it('beschneide: Loch endet an Topbar und Tab-Leiste', () => {
    expect(beschneide({ top: 20, left: 0, width: 10, height: 900 }, 56, 788)).toEqual({
      top: 56,
      left: 0,
      width: 10,
      height: 732,
    })
    expect(beschneide({ top: 800, left: 0, width: 10, height: 40 }, 56, 788).height).toBe(0)
  })

  it('scrollDelta: sichtbar → 0, darunter → nach unten in die Mitte, zu groß → Oberkante', () => {
    expect(scrollDelta({ top: 200, left: 0, width: 10, height: 100 }, 100, 800)).toBe(0)
    expect(scrollDelta({ top: 1000, left: 0, width: 10, height: 100 }, 100, 800)).toBe(1000 - 400)
    expect(scrollDelta({ top: 50, left: 0, width: 10, height: 2000 }, 100, 800)).toBe(-50)
  })
})

describe('Zielsuche', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const sichtbarMachen = (el: Element) => {
    el.getBoundingClientRect = () =>
      ({
        top: 10,
        left: 10,
        width: 100,
        height: 30,
        right: 110,
        bottom: 40,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      }) as DOMRect
  }

  it('nimmt das erste sichtbare Element der ersten passenden Spezifikation', () => {
    document.body.innerHTML = `
      <nav aria-label="Hauptnavigation"><a href="/heute">Heute</a></nav>
      <nav aria-label="Navigation"><a href="/heute">Heute</a></nav>`
    const [versteckt, tab] = Array.from(document.querySelectorAll('a'))
    sichtbarMachen(tab!)
    expect(
      findeZiel([
        'nav[aria-label="Hauptnavigation"] a[href="/heute"]',
        'nav[aria-label="Navigation"] a[href="/heute"]',
      ]),
    ).toBe(tab)
    sichtbarMachen(versteckt!)
    expect(findeZiel(['nav[aria-label="Hauptnavigation"] a[href="/heute"]'])).toBe(versteckt)
  })

  it('Text-Spezifikation, ungültiger Selektor und fehlendes Ziel brechen nichts', () => {
    document.body.innerHTML = '<button>Abbrechen</button><button>Call-Block starten</button>'
    const knopf = document.querySelectorAll('button')[1]!
    sichtbarMachen(knopf)
    expect(findeZiel(['[[kaputt', { css: 'button', text: 'call-block' }])).toBe(knopf)
    expect(findeZiel(['[data-gibt-es-nicht]'])).toBeNull()
    expect(findeZiel(undefined)).toBeNull()
  })
})

describe('Touren', () => {
  it('jede Tour existiert, die Einführung hat 7–9 Schritte', () => {
    for (const k of TOUR_KEYS) expect(TOUREN[k].schritte.length).toBeGreaterThan(0)
    const n = TOUREN.onboarding.schritte.length
    expect(n).toBeGreaterThanOrEqual(7)
    expect(n).toBeLessThanOrEqual(9)
    expect(TOUREN.onboarding.schritte.map((s) => s.id)).toEqual([
      'heute',
      'karte',
      'zaehler',
      'leads',
      'pipeline',
      'deals',
      'kpis',
      'hilfe',
      'feedback',
    ])
  })

  it('Schritte: eindeutige IDs, ein bis zwei Sätze, Pfade nur auf echte Routen', () => {
    const routen = [
      '/heute',
      '/leads',
      '/leads/pipeline',
      '/pipeline',
      '/telefon',
      '/email',
      '/kpis',
      '/team',
      '/leitfaeden',
      '/import',
      '/auftrag',
    ]
    for (const t of Object.values(TOUREN)) {
      expect(new Set(t.schritte.map((s) => s.id)).size).toBe(t.schritte.length)
      for (const s of t.schritte) {
        const saetze = s.text.split(/[.?]\s/).filter(Boolean).length
        expect(saetze, `${t.key}/${s.id}`).toBeLessThanOrEqual(2)
        if (s.pfad) expect(routen).toContain(s.pfad)
      }
    }
  })

  it('{name} wird ersetzt, ohne Namen bleibt „Willkommen.“', () => {
    expect(mitName('Willkommen, {name}.', 'Vincent')).toBe('Willkommen, Vincent.')
    expect(mitName('Willkommen, {name}.', null)).toBe('Willkommen.')
  })
})

describe('Themen', () => {
  it('eindeutige Schlüssel, jede Tour existiert, jede Frage zeigt auf ein Thema', () => {
    expect(new Set(THEMEN.map((t) => t.key)).size).toBe(THEMEN.length)
    for (const t of THEMEN) if (t.tour) expect(TOUR_KEYS).toContain(t.tour)
    for (const f of HAEUFIGE_FRAGEN) expect(themaVon(f.thema)).toBeDefined()
    expect(THEMEN.map((t) => t.key)).toEqual(
      expect.arrayContaining([
        'erste-schritte',
        'dein-tag',
        'linkedin',
        'verbindungen',
        'tastenkuerzel',
        'feedback',
        'noch-nicht',
      ]),
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
    // die LinkedIn-Mini-Tour behauptet nicht mehr, das CRM sehe keine Annahmen/Antworten
    const linkedinTour = TOUREN.linkedin.schritte.map((x) => x.text).join(' ')
    expect(linkedinTour).not.toMatch(/sieht nicht, wer|meldet dem CRM keine Antworten/)
    expect(linkedinTour).toMatch(/LinkedIn-Mails/)
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
    expect(sucheThemen('tastenkürzel')[0]!.key).toBe('tastenkuerzel')
    expect(sucheThemen('was macht mike')[0]!.key).toBe('kpis-team')
    // Runde 3: die LinkedIn-Brücke ist auffindbar
    expect(sucheThemen('script')[0]!.key).toBe('verbindungen')
    expect(sucheThemen('seitenleiste').map((t) => t.key)).toEqual(expect.arrayContaining(['linkedin', 'verbindungen']))
    expect(sucheThemen('gmail verbinden').map((t) => t.key)).toEqual(['email', 'verbindungen'])
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
      ...Object.values(TOUREN).flatMap((t) => t.schritte.map((s) => `${s.titel} ${s.text} ${s.leer ?? ''}`)),
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

describe('Tastenregister', () => {
  it('Registry + Hilfe-Gruppe; fehlende globale Tasten werden ergänzt, vorhandene nicht doppelt', () => {
    const ohne = tastenRegister([{ gruppe: 'Global', eintraege: [{ tasten: ['⌘K'], beschreibung: 'Palette' }] }])
    expect(ohne.map((g) => g.gruppe)).toEqual(['Global', 'Hilfe & Tour', ERGAENZUNG.gruppe])
    // G S steht schon in der Hilfe-Gruppe → nicht noch einmal in der Ergänzung
    expect(ohne.at(-1)!.eintraege.map((e) => e.tasten[0])).toEqual(['G A', 'G B', '⌥F'])
    const mit = tastenRegister([
      { gruppe: 'Global', eintraege: ERGAENZUNG.eintraege },
      { gruppe: 'Hilfe & Tour', eintraege: [{ tasten: ['G S'], beschreibung: 'Hilfe' }] },
    ])
    expect(mit.map((g) => g.gruppe)).toEqual(['Global', 'Hilfe & Tour'])
  })
})
