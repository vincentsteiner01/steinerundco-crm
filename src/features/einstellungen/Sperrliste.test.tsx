// BAUPLAN § 3.9 Sperrliste.test.tsx / E-08: alle Einträge sichtbar, Suche, Hinzufügen braucht mind. einen Schlüssel + Grund,
// Entfernen fragt Bestätigung + Grund und schreibt eine Notiz-Aktivität am Lead.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testDaten')).supabaseAntworten())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(),
  registriereUndo: vi.fn(),
}))

import { supabase } from '@/data/supabase'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { Sperrliste } from './Sperrliste'
import { anzahlAufrufe, letzterAufruf, MEMBER_V, SPERRLISTE } from './_testDaten'
import { rendern } from './_testHilfe'

const vonMock = () => vi.mocked(supabase.from)

describe('Sperrliste', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    vonMock().mockClear()
    Object.defineProperty(window, 'scrollTo', { configurable: true, writable: true, value: vi.fn() })
  })

  it('E-08: zeigt alle Einträge mit Kanal-Umfang, Grund-Chip, Datum, erfasst von und Quelle', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const tabelle = await screen.findByRole('table', { name: 'Sperrliste' })
    expect(tabelle.querySelectorAll('tr[data-id]')).toHaveLength(2)
    const erste = tabelle.querySelector(`tr[data-id="${SPERRLISTE[0]!.id}"]`) as HTMLElement
    expect(erste).toHaveTextContent('Test Gesperrt')
    expect(erste).toHaveTextContent('Solar 99 GmbH')
    expect(erste).toHaveTextContent('alle Kanäle')
    expect(erste).toHaveTextContent('Widerspruch · Widerspruch per Telefon')
    expect(erste).toHaveTextContent('05.10.2026')
    expect(erste).toHaveTextContent('Mike')
    expect(erste).toHaveTextContent('Lead')
    const zweite = tabelle.querySelector(`tr[data-id="${SPERRLISTE[1]!.id}"]`) as HTMLElement
    expect(zweite).toHaveTextContent('E-Mail')
    expect(zweite).toHaveTextContent('Manuell · Sammeladresse')
    expect(zweite).toHaveTextContent('manuell')
    expect(screen.getByText('2 von 2')).toBeInTheDocument()
  })

  it('Runde 3: Köpfe „Unternehmen“, „Kanal-Umfang“, „Erfasst von“ breiter bzw. zweizeilig statt mit „…“ gekürzt', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const tabelle = await screen.findByRole('table', { name: 'Sperrliste' })
    for (const kopf of ['Unternehmen', 'Kanal-Umfang', 'Erfasst von']) {
      const th = within(tabelle)
        .getAllByRole('columnheader')
        .find((t) => t.textContent?.startsWith(kopf)) as HTMLElement
      const knopf = th.querySelector('button')
      if (knopf) {
        expect(knopf).toHaveClass('whitespace-normal')
        expect(knopf.querySelector('span')).not.toHaveClass('truncate')
      }
    }
    const breiten = [...tabelle.querySelectorAll('col')].map((c) => (c as HTMLElement).style.width)
    expect(breiten).toEqual(expect.arrayContaining(['14%', '15%', '13%']))
  })

  it('Suche filtert clientseitig', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const suche = await screen.findByLabelText('Sperrliste durchsuchen')
    fireEvent.change(suche, { target: { value: 'solar' } })
    expect(screen.getByRole('table').querySelectorAll('tr[data-id]')).toHaveLength(1)
    expect(screen.getByText('1 von 2')).toBeInTheDocument()
    fireEvent.change(suche, { target: { value: 'gibtesnicht' } })
    expect(screen.getByText('Nichts gefunden für ‚gibtesnicht‘.')).toBeInTheDocument()
  })

  it('Hinzufügen: ohne Schlüssel und Grund → Fehler, kein Insert; mit E-Mail + Grund → Insert mit Normalisierung', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    fireEvent.click(await screen.findByRole('button', { name: /Eintrag hinzufügen/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eintragen' }))
    expect(within(dialog).getByText(/Mindestens eine Angabe/)).toBeInTheDocument()
    expect(within(dialog).getByText('Grund eingeben')).toBeInTheDocument()
    expect(anzahlAufrufe(vonMock(), 'sperrliste', 'insert')).toBe(0)

    fireEvent.change(within(dialog).getByLabelText('E-Mail', { selector: 'input[type=email]' }), {
      target: { value: 'Neu@Example.test' },
    })
    fireEvent.change(within(dialog).getByLabelText('Telefon', { selector: 'input[type=tel]' }), {
      target: { value: '040 999 888' },
    })
    fireEvent.change(within(dialog).getByLabelText('LinkedIn-URL'), {
      target: { value: 'https://www.linkedin.com/in/Test-Neu/' },
    })
    fireEvent.change(within(dialog).getByLabelText('Grund'), { target: { value: 'Bitte nicht kontaktieren' } })
    fireEvent.click(within(dialog).getByLabelText('Telefon', { selector: 'input[type=checkbox]' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eintragen' }))
    await waitFor(() => expect(letzterAufruf(vonMock(), 'sperrliste', 'insert')).not.toBeNull())
    const i = letzterAufruf(vonMock(), 'sperrliste', 'insert') as Record<string, unknown>
    expect(i.email).toBe('neu@example.test')
    expect(i.phone_e164).toBe('+4940999888')
    expect(i.linkedin_url_norm).toBe('linkedin.com/in/test-neu')
    expect(i.channels).toEqual(['linkedin', 'email'])
    // `reason` ist ein Enum (DB-Check) – der Freitext-Grund steht in `note` (Review-Korrektur)
    expect(i.reason).toBe('manuell')
    expect(i.note).toBe('Bitte nicht kontaktieren')
    expect(i.created_by).toBe(MEMBER_V)
  })

  it('N öffnet den Dialog „Eintrag hinzufügen“', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    await screen.findByRole('table', { name: 'Sperrliste' })
    fireEvent.keyDown(document.body, { key: 'n' })
    expect(await screen.findByRole('dialog')).toHaveTextContent('Eintrag hinzufügen')
  })

  it('E-08: Entfernen fragt nach Bestätigung und Grund; dann Delete + Notiz-Aktivität am Lead', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const tabelle = await screen.findByRole('table', { name: 'Sperrliste' })
    const erste = tabelle.querySelector(`tr[data-id="${SPERRLISTE[0]!.id}"]`) as HTMLElement
    fireEvent.click(within(erste).getByRole('button', { name: /Entfernen/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Eintrag entfernen? Die Person könnte wieder kontaktiert werden.')
    const bestaetigen = within(dialog).getByRole('button', { name: 'Entfernen' })
    expect(bestaetigen).toBeDisabled()
    expect(anzahlAufrufe(vonMock(), 'sperrliste', 'delete')).toBe(0)
    fireEvent.change(within(dialog).getByLabelText('Grund'), { target: { value: 'Versehen beim Import' } })
    expect(bestaetigen).toBeEnabled()
    fireEvent.click(bestaetigen)
    await waitFor(() => expect(anzahlAufrufe(vonMock(), 'sperrliste', 'delete')).toBe(1))
    await waitFor(() => expect(letzterAufruf(vonMock(), 'activities', 'insert')).not.toBeNull())
    const a = letzterAufruf(vonMock(), 'activities', 'insert') as Record<string, unknown>
    expect(a.lead_id).toBe(SPERRLISTE[0]!.lead_id)
    expect(a.type).toBe('notiz')
    expect(a.note).toContain('Versehen beim Import')
    expect(a.member_id).toBe(MEMBER_V)
  })

  it('Entfernen eines manuellen Eintrags (ohne lead_id) schreibt keine Aktivität', async () => {
    rendern(<Sperrliste />, '/einstellungen/sperrliste')
    const tabelle = await screen.findByRole('table', { name: 'Sperrliste' })
    const zweite = tabelle.querySelector(`tr[data-id="${SPERRLISTE[1]!.id}"]`) as HTMLElement
    fireEvent.click(within(zweite).getByRole('button', { name: /Entfernen/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Grund'), { target: { value: 'Adresse gehört jetzt uns' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entfernen' }))
    await waitFor(() => expect(anzahlAufrufe(vonMock(), 'sperrliste', 'delete')).toBe(1))
    expect(anzahlAufrufe(vonMock(), 'activities', 'insert')).toBe(0)
  })
})
