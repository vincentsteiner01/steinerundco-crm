// Skript: Einstieg V2 nur ohne LinkedIn-Grund (T-14), Mailbox-Tab bei Versuch 2/4, Platzhalter gefüllt/offen
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VORLAGE } from '@/lib/vorlagenKeys'
import { Skript } from './Skript'
import { naechsterTab, SKRIPT_TABS, skriptVorlagen, startTab } from './skriptLogik'
import { LEAD_A, TEMPLATES } from './_testHilfe'

describe('Skript', () => {
  it('T-14: „Einstieg V2“ nur sichtbar, wenn der Anrufgrund nicht LinkedIn-basiert ist', () => {
    expect(skriptVorlagen(TEMPLATES, 'einstieg', { callBasis: 'linkedin_vernetzt_antwort' }).map((t) => t.key)).toEqual(
      [VORLAGE.tel_einstieg_1],
    )
    expect(skriptVorlagen(TEMPLATES, 'einstieg', { callBasis: 'linkedin_vernetzt' }).map((t) => t.key)).toEqual([
      VORLAGE.tel_einstieg_1,
    ])
    expect(skriptVorlagen(TEMPLATES, 'einstieg', { callBasis: 'bestandskontakt' }).map((t) => t.key)).toEqual([
      VORLAGE.tel_einstieg_1,
      VORLAGE.tel_einstieg_2,
    ])
  })

  it('Mailbox: Versuch 4 bevorzugt Mailbox 2; Tab Mailbox nach „Anrufen“ bei Versuch 2 und 4; sonst Zentrale/Einstieg', () => {
    expect(skriptVorlagen(TEMPLATES, 'mailbox', { versuch: 2 })[0]?.key).toBe(VORLAGE.tel_mailbox_1)
    expect(skriptVorlagen(TEMPLATES, 'mailbox', { versuch: 4 })[0]?.key).toBe(VORLAGE.tel_mailbox_2)
    expect(startTab('zentrale', 1, false)).toBe('zentrale')
    expect(startTab('durchwahl', 1, false)).toBe('einstieg')
    expect(startTab('zentrale', 2, true)).toBe('mailbox')
    expect(startTab('zentrale', 3, true)).toBe('zentrale')
    expect(startTab(null, 4, true)).toBe('mailbox')
    expect(naechsterTab('zentrale', 1)).toBe('einstieg')
    expect(naechsterTab('zentrale', -1)).toBe('datenschutz')
    expect(SKRIPT_TABS.map((t) => t.label)).toEqual([
      'Zentrale',
      'Einstieg',
      'Problem',
      'Qualifizierung',
      'Pitch',
      'Einwände',
      'Abschluss',
      'Mailbox',
      'Datenschutz',
    ])
  })

  it('rendert Tabs, füllt Platzhalter aus Lead, Anrufer und Anlass; offene bleiben amber markiert', () => {
    const onTab = vi.fn()
    render(
      <Skript
        templates={TEMPLATES}
        lead={LEAD_A}
        ctx={{ me: { display_name: 'Mike Test' } }}
        versuch={1}
        tab="einstieg"
        onTab={onTab}
        vorlageId={null}
        onVorlage={() => {}}
      />,
    )
    expect(screen.getAllByRole('tab')).toHaveLength(9)
    expect(screen.getByRole('tab', { name: 'Einstieg' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTitle('aus Anrufer')).toHaveTextContent('Mike Test')
    expect(screen.getByTitle('aus Nachname')).toHaveTextContent('Feldhaus')
    expect(screen.getByTitle('aus Anlass')).toHaveTextContent('LinkedIn vernetzt + Antwort')
    fireEvent.click(screen.getByRole('tab', { name: 'Zentrale' }))
    expect(onTab).toHaveBeenCalledWith('zentrale')
  })

  it('zeigt offene Platzhalter amber und bietet bei mehreren Vorlagen die Auswahl', () => {
    render(
      <Skript
        templates={TEMPLATES}
        lead={{ ...LEAD_A, call_basis: 'bestandskontakt' }}
        versuch={1}
        tab="einstieg"
        onTab={() => {}}
        vorlageId={null}
        onVorlage={() => {}}
      />,
    )
    expect(screen.getByRole('group', { name: 'Vorlage' }).querySelectorAll('button')).toHaveLength(2)
    expect(screen.getByTitle('Anrufer – offen')).toHaveClass('text-overdue')
  })
})
