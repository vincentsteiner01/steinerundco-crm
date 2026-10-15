// VorlageWaehlen (§ 3.1.10a, LF-08, LF-11): Filter Kanal/Phase, inaktive ausgeblendet, Markierung aktuell, Gruppen-Untertitel,
// Quote Mono, Tastatur (↓ ↵), Suche ab 8 Einträgen, onSelect.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testHilfe')).supabaseAntworten())

import { useAuth } from '@/features/auth/authStore'
import { VORLAGE } from '@/lib/vorlagenKeys'
import { MEMBER_V } from '@/test/fixtures/leads'
import { BEDARF, JA_V1_ID, rendern } from './_testHilfe'
import { VorlageWaehlen } from './public'

const oeffnen = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Leitfaden wählen' }))
  return await screen.findByRole('dialog', { name: 'Vorlage wählen' })
}
const eintraege = (dlg: HTMLElement) =>
  within(dlg)
    .getAllByRole('option')
    .map((o) => o.textContent ?? '')

describe('VorlageWaehlen', () => {
  beforeEach(() => {
    useAuth.setState({ status: 'mitglied', member: { user_id: MEMBER_V, email: 'v@x', display_name: 'Vincent' } })
  })

  it('LF-08: Kanal linkedin / Phase bedarfsermittlung liefert genau die acht aktiven Phase-2-Vorlagen in Seed-Reihenfolge', async () => {
    const onSelect = vi.fn()
    rendern(
      <VorlageWaehlen
        kanal="linkedin"
        phase="bedarfsermittlung"
        onSelect={onSelect}
        trigger={<button type="button">Leitfaden wählen</button>}
      />,
    )
    const dlg = await oeffnen()
    await waitFor(() => expect(within(dlg).getAllByRole('option')).toHaveLength(8))
    const namen = eintraege(dlg)
    const erwartet = [
      VORLAGE.li_bedarf_ja_v1,
      VORLAGE.li_bedarf_ja_v2,
      VORLAGE.li_bedarf_nein_ohne_grund,
      VORLAGE.li_bedarf_nein_mit_grund,
      VORLAGE.li_bedarf_hat_partner,
      VORLAGE.li_bedarf_nein_falsches_problem,
      VORLAGE.li_bedarf_ja_v3,
      VORLAGE.li_bedarf_vernetzt_ohne_antwort,
    ].map((k) => BEDARF.find((t) => t.key === k)?.name ?? '?')
    erwartet.forEach((name, i) => expect(namen[i]).toContain(name))
    expect(namen.join(' ')).not.toContain('Ja (alt)') // inaktiv ausgeblendet
    // Suche ab 8 Einträgen
    expect(within(dlg).getByRole('combobox')).toBeInTheDocument()
    // Quote Mono: Ja (V1) hat 25 %
    expect(namen[0]).toContain('25 %')
  })

  it('LF-11: Gruppenköpfe tragen Label und Untertitel aus phasen.ts; ohne Phase alle Phasen des Kanals', async () => {
    rendern(
      <VorlageWaehlen kanal="linkedin" onSelect={() => {}} trigger={<button type="button">Leitfaden wählen</button>} />,
    )
    const dlg = await oeffnen()
    await waitFor(() => expect(within(dlg).getAllByRole('option').length).toBeGreaterThan(8))
    for (const [label, text] of [
      ['Gesprächseröffnung', 'Problem erkennen & Antwort auslösen'],
      ['Bedarfsermittlung', 'Bedarf, Priorität & Einwände qualifizieren'],
      ['Pitch', 'Unverbindliches 15-Min.-Gespräch vereinbaren'],
      ['Follow-ups', 'Nicht-Antworter erneut aktivieren'],
    ]) {
      expect(within(dlg).getByText(label as string)).toBeInTheDocument()
      expect(within(dlg).getByText(text as string)).toBeInTheDocument()
    }
    expect(within(dlg).queryByText('Zentrale')).not.toBeInTheDocument()
    const gruppen = dlg.querySelectorAll('[cmdk-group]')
    expect(Array.from(gruppen).map((g) => g.getAttribute('data-value'))).toEqual([
      'eroeffnung',
      'bedarfsermittlung',
      'pitch',
      'follow_up',
      'langfristig',
    ])
  })

  it('Kanal telefon zeigt nur Telefon-Vorlagen (zehn Phasen), keine Suche unter 8 Einträgen bei Phase-Filter', async () => {
    rendern(
      <VorlageWaehlen
        kanal="telefon"
        phase="einstieg"
        onSelect={() => {}}
        trigger={<button type="button">Leitfaden wählen</button>}
      />,
    )
    const dlg = await oeffnen()
    await waitFor(() => expect(within(dlg).getAllByRole('option')).toHaveLength(1))
    expect(within(dlg).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(dlg).getByText('Anrufgrund in einem Satz, Erlaubnis für zwei Minuten')).toBeInTheDocument()
  })

  it('aktueller Eintrag ist markiert; ↓ und ↵ wählen den nächsten; onSelect bekommt die Vorlage, Popover schließt', async () => {
    const onSelect = vi.fn()
    rendern(
      <VorlageWaehlen
        kanal="linkedin"
        phase="bedarfsermittlung"
        aktuellId={JA_V1_ID}
        onSelect={onSelect}
        trigger={<button type="button">Leitfaden wählen</button>}
      />,
    )
    const dlg = await oeffnen()
    await waitFor(() => expect(within(dlg).getAllByRole('option')).toHaveLength(8))
    const aktuell = within(dlg).getByRole('option', { current: true })
    expect(aktuell).toHaveTextContent('Ja (V1)')
    const root = dlg.querySelector('[cmdk-root]') as HTMLElement
    fireEvent.keyDown(root, { key: 'ArrowDown' })
    fireEvent.keyDown(root, { key: 'Enter' })
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ key: VORLAGE.li_bedarf_ja_v2 })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Vorlage wählen' })).not.toBeInTheDocument())
  })

  it('Klick auf einen Eintrag wählt ihn; Suche filtert', async () => {
    const onSelect = vi.fn()
    rendern(
      <VorlageWaehlen kanal="linkedin" onSelect={onSelect} trigger={<button type="button">Leitfaden wählen</button>} />,
    )
    const dlg = await oeffnen()
    const suche = await within(dlg).findByRole('combobox')
    fireEvent.change(suche, { target: { value: 'Pitch B' } })
    await waitFor(() => expect(within(dlg).getAllByRole('option')).toHaveLength(1))
    fireEvent.click(within(dlg).getByRole('option'))
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ key: VORLAGE.li_pitch_b })
  })

  it('leerer Kanal: Hinweis statt Liste', async () => {
    rendern(
      <VorlageWaehlen
        kanal="sonstiges"
        onSelect={() => {}}
        trigger={<button type="button">Leitfaden wählen</button>}
      />,
    )
    const dlg = await oeffnen()
    await within(dlg).findByText('Keine aktive Vorlage für diesen Kanal.')
  })
})
