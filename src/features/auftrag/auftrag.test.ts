import { describe, expect, it } from 'vitest'
import { STELLEN_WAHL } from '@/lib/vorlagenKeys'
import type { QueueItem, Template } from '@/types/domain'
import { annahmenText, chatgptPrompt, gruppiere, istLinkedin, profilUrl, stellenAuswahl } from './auftrag'

const item = (p: Partial<QueueItem>): QueueItem =>
  ({
    item_id: p.item_id ?? Math.random().toString(36).slice(2),
    item_kind: 'sequenz_schritt',
    channel: 'linkedin',
    section: 'heute',
    lead_id: 'l1',
    lead_name: 'Test Person',
    linkedin_url: 'linkedin.com/in/test-person',
    step_id: 's-folge',
    due_date: '2026-10-16',
    do_not_contact: false,
    ...p,
  }) as QueueItem

const istOpener = (s: string | null) => s === 's-opener'

describe('gruppiere', () => {
  it('trennt Opener, Follow-ups und Annahmen; nur fällige LinkedIn-Schritte', () => {
    const g = gruppiere(
      [
        item({ item_id: 'a', step_id: 's-opener' }),
        item({ item_id: 'b' }),
        item({ item_id: 'c', section: 'kommend' }),
        item({ item_id: 'd', channel: 'telefon' }),
        item({ item_id: 'e', item_kind: 'annahme_pruefen', section: 'annahme_pruefen' }),
        item({ item_id: 'f', item_kind: 'antworten', section: 'antworten' }),
        item({ item_id: 'g', item_kind: 'wiedervorlage', channel: 'sonstiges', section: 'ueberfaellig' }),
      ],
      istOpener,
    )
    expect(g.opener.map((i) => i.item_id)).toEqual(['a'])
    expect(g.followUps.map((i) => i.item_id).sort()).toEqual(['b', 'g'])
    expect(g.annahmen.map((i) => i.item_id)).toEqual(['e'])
    expect(g.antwortenOffen).toBe(1)
  })

  it('lässt gesperrte Leads weg und sortiert Überfälliges nach oben', () => {
    const g = gruppiere(
      [
        item({ item_id: 'spaet', due_date: '2026-10-16', lead_name: 'Anna' }),
        item({ item_id: 'frueh', due_date: '2026-10-09', lead_name: 'Zora', section: 'ueberfaellig' }),
        item({ item_id: 'gesperrt', do_not_contact: true }),
      ],
      istOpener,
    )
    expect(g.followUps.map((i) => i.item_id)).toEqual(['frueh', 'spaet'])
  })

  it('Sheet-Wiedervorlage ohne LinkedIn-Profil ist kein LinkedIn-Auftrag', () => {
    expect(istLinkedin({ channel: null, item_kind: 'wiedervorlage', linkedin_url: null })).toBe(false)
    expect(istLinkedin({ channel: 'email', item_kind: 'wiedervorlage', linkedin_url: 'linkedin.com/in/x' })).toBe(false)
  })
})

describe('profilUrl', () => {
  it('macht aus der normalisierten Form einen klickbaren Link', () => {
    expect(profilUrl('linkedin.com/in/test-person')).toBe('https://www.linkedin.com/in/test-person')
    expect(profilUrl('https://www.linkedin.com/in/x/')).toBe('https://www.linkedin.com/in/x/')
    expect(profilUrl(null)).toBeNull()
  })
})

describe('chatgptPrompt', () => {
  it('nennt die Auftragsseite, das Format, die Knöpfe und die Grenze', () => {
    const p = chatgptPrompt('https://crm.steinerundco.de/auftrag', 25)
    for (const teil of [
      'https://crm.steinerundco.de/auftrag',
      'Neue Annahmen eintragen',
      'Herr Vorname Nachname | Firma | https://www.linkedin.com/in/profil',
      '„Gesendet“',
      '„Hat geantwortet“',
      '„War schon gesendet“',
      'Höchstens 25 Nachrichten',
      'Ergebniszeile',
      'Auftragsseite neu laden',
    ])
      expect(p).toContain(teil)
    expect(p).not.toMatch(/!/)
  })

  it('erklärt die Stellen-Wahl mit genau den Knopf-Namen der Auftragsseite (13.11.2026)', () => {
    const p = chatgptPrompt()
    const schritt = p.split('\n').find((z) => z.includes('„Stellenanzeige prüfen“')) ?? ''
    for (const s of STELLEN_WAHL) expect(schritt).toContain(`„${s.label}“`)
    expect(schritt).toContain('Website der Firma')
    expect(schritt).toContain('Reiter „Jobs“')
  })

  it('lässt beantwortete Chats auf LinkedIn wieder als ungelesen markieren (29.10.2026, Feedback 448a060a)', () => {
    const p = chatgptPrompt()
    const schrittB = p.split('\n').find((z) => z.trimStart().startsWith('b)')) ?? ''
    expect(schrittB).toContain('„Hat geantwortet“')
    expect(schrittB).toContain('„Als ungelesen markieren“')
  })
})

describe('annahmenText', () => {
  it('fasst das Ergebnis in einem Satz zusammen', () => {
    expect(annahmenText({ neu: 2, bekannt: 1, angenommen: 3, uebersprungen: [], fehlgeschlagen: 0 })).toBe(
      '3 als angenommen eingetragen · 2 neu angelegt · 1 schon im CRM.',
    )
    expect(
      annahmenText({
        neu: 0,
        bekannt: 0,
        angenommen: 0,
        uebersprungen: ['Max Beispiel (gesperrt)'],
        fehlgeschlagen: 0,
      }),
    ).toContain('Übersprungen: Max Beispiel (gesperrt)')
  })

  it('nennt nicht gespeicherte Annahmen und wie es weitergeht (16.10.2026: Abbruch nach 18 von 37)', () => {
    const s = annahmenText({ neu: 36, bekannt: 1, angenommen: 18, uebersprungen: [], fehlgeschlagen: 19 })
    expect(s).toContain('18 als angenommen eingetragen')
    expect(s).toContain('19 Annahmen nicht gespeichert')
    expect(s).toContain('noch einmal „Eintragen“')
  })
})

describe('stellenAuswahl', () => {
  const t = (id: string, key: string, active = true) => ({ id, key, active }) as Template
  const alle = [
    t('pl', 'li_projektleiter_neue_eroeffnung'),
    t('bu', 'li_bueromitarbeiter_neue_eroeffnung'),
    t('el', 'li_elektriker_neue_eroeffnung'),
    t('ke', 'li_keine_mitarbeitersuche_neue_eroeffnung'),
    t('k1', 'li_fu_kurz_1'),
  ]

  it('bietet die vier Stellen an, wenn der Schritt eine Stellen-Vorlage hat', () => {
    expect(stellenAuswahl(alle, 'ke')).toEqual([
      { label: 'Projektleiter', id: 'pl' },
      { label: 'Büro', id: 'bu' },
      { label: 'Elektriker', id: 'el' },
      { label: 'Keine passende Stelle', id: 'ke' },
    ])
  })

  it('sonst keine Auswahl; inaktive Vorlagen fallen weg', () => {
    expect(stellenAuswahl(alle, 'k1')).toEqual([])
    expect(stellenAuswahl(undefined, 'ke')).toEqual([])
    const ohneBuero = alle.map((x) => (x.id === 'bu' ? { ...x, active: false } : x))
    expect(stellenAuswahl(ohneBuero, 'ke').map((s) => s.id)).toEqual(['pl', 'el', 'ke'])
  })
})
