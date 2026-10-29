import { describe, expect, it } from 'vitest'
import type { QueueItem } from '@/types/domain'
import { annahmenText, chatgptPrompt, gruppiere, istLinkedin, profilUrl } from './auftrag'

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
