// BAUPLAN § 3.9 Ziele.test.tsx: Merge-Upsert, Validierung 0–1000 / 0–300 / Prozent, die beiden Auto-Enroll-Switches schreiben
// nur ihren Key und lassen `sending_enabled` unangetastet (§ 1.5 Nr. 45). E-07, E-12 (Feiertag → settings.feiertage).
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
import { useAuth } from '@/features/auth/authStore'
import { SETTINGS } from '@/test/fixtures/settings'
import { Ziele } from './Ziele'
import { anzahlAufrufe, letzterAufruf, MEMBER_V } from './_testDaten'
import { rendern } from './_testHilfe'

type Upsert = { key: string; value: Record<string, unknown> }
const vonMock = () => vi.mocked(supabase.from)

describe('Ziele', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    vonMock().mockClear()
  })

  it('zeigt alle sieben Blöcke mit Seed-Werten', async () => {
    rendern(<Ziele />, '/einstellungen/ziele')
    expect(await screen.findByLabelText('Warnschwelle Budget')).toHaveValue('90')
    expect(screen.getByLabelText('Tagesziel Anfragen (Vincent)')).toHaveValue('30')
    expect(screen.getByLabelText('Wochenbudget (Vincent)')).toHaveValue('150')
    expect(screen.getByLabelText('Annahmequote')).toHaveValue('25')
    expect(screen.getByLabelText('Hat Partner')).toHaveValue('180')
    expect(screen.getByLabelText('Zeitfenster A')).toHaveValue('09:30–11:30')
    expect(screen.getByRole('form', { name: 'Feiertage' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Nach Erstgespräch/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: /Nach Strategiegespräch/ })).toHaveAttribute('aria-checked', 'true')
    // sending_enabled bleibt unsichtbar (§ 3.9 Regeln)
    expect(screen.queryByText(/sending/i)).not.toBeInTheDocument()
  })

  it('E-07: Warnschwelle ändern → Upsert settings.linkedin mit Merge (übrige Keys bleiben)', async () => {
    rendern(<Ziele />, '/einstellungen/ziele')
    const feld = await screen.findByLabelText('Warnschwelle Budget')
    const block = screen.getByRole('form', { name: 'LinkedIn' })
    const speichern = () => within(block).getByRole('button', { name: /Speichern/ })
    expect(speichern()).toBeDisabled()
    expect(screen.getAllByLabelText('Nichts geändert').length).toBeGreaterThan(0)
    fireEvent.change(feld, { target: { value: '80' } })
    expect(speichern()).toBeEnabled()
    fireEvent.click(speichern())
    await waitFor(() => expect(letzterAufruf(vonMock(), 'settings', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'settings', 'upsert') as Upsert
    expect(u.key).toBe('linkedin')
    expect(u.value.warn_at_pct).toBe(80)
    expect(u.value.weekly_budget_default).toEqual(SETTINGS.linkedin.weekly_budget_default)
    expect(u.value.default_sequence).toBe('linkedin_standard')
    // Profilwerte unverändert → kein member_profiles-Upsert
    expect(anzahlAufrufe(vonMock(), 'member_profiles', 'upsert')).toBe(0)
  })

  it('E-07: Tagesziel/Wochenbudget schreiben das eigene Profil', async () => {
    rendern(<Ziele />, '/einstellungen/ziele')
    const feld = await screen.findByLabelText('Tagesziel Anfragen (Vincent)')
    fireEvent.change(feld, { target: { value: '40' } })
    fireEvent.click(within(screen.getByRole('form', { name: 'LinkedIn' })).getByRole('button', { name: /Speichern/ }))
    await waitFor(() => expect(letzterAufruf(vonMock(), 'member_profiles', 'upsert')).not.toBeNull())
    const p = letzterAufruf(vonMock(), 'member_profiles', 'upsert') as Record<string, unknown>
    expect(p.member_id).toBe(MEMBER_V)
    expect(p.daily_target).toBe(40)
    expect(p.weekly_budget).toBe(150)
    expect(anzahlAufrufe(vonMock(), 'settings', 'upsert')).toBe(0)
  })

  it('Validierung: 1001 / 301 / 101 % blockieren das Speichern mit Fehlertext', async () => {
    rendern(<Ziele />, '/einstellungen/ziele')
    fireEvent.change(await screen.findByLabelText('Tagesziel Anfragen (Vincent)'), { target: { value: '1001' } })
    fireEvent.change(screen.getByLabelText('Anfrage zurückziehen nach'), { target: { value: '301' } })
    fireEvent.change(screen.getByLabelText('Warnschwelle Budget'), { target: { value: '101' } })
    fireEvent.click(within(screen.getByRole('form', { name: 'LinkedIn' })).getByRole('button', { name: /Speichern/ }))
    const alerts = screen.getAllByRole('alert').map((a) => a.textContent)
    expect(alerts).toContain('Zwischen 0 und 1000')
    expect(alerts).toContain('Zwischen 0 und 300 Tage')
    expect(alerts).toContain('Zwischen 0 und 100\u202F%')
    expect(anzahlAufrufe(vonMock(), 'settings', 'upsert')).toBe(0)
    expect(anzahlAufrufe(vonMock(), 'member_profiles', 'upsert')).toBe(0)
  })

  it('KPI-Zielwerte: Prozent → Anteil, Merge-Upsert settings.kpi_targets', async () => {
    rendern(<Ziele />, '/einstellungen/ziele')
    fireEvent.change(await screen.findByLabelText('Annahmequote'), { target: { value: '35' } })
    fireEvent.click(
      within(screen.getByRole('form', { name: 'KPI-Zielwerte' })).getByRole('button', { name: /Speichern/ }),
    )
    await waitFor(() => expect(letzterAufruf(vonMock(), 'settings', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'settings', 'upsert') as Upsert
    expect(u.key).toBe('kpi_targets')
    expect(u.value.annahme_quote).toBe(0.35)
    expect(u.value.antwortzeit_werktage).toBe(1)
  })

  it('Auto-Enroll-Switch schreibt nur seinen Key; sending_enabled bleibt false', async () => {
    rendern(<Ziele />, '/einstellungen/ziele')
    const sw = await screen.findByRole('switch', { name: /Nach Erstgespräch/ })
    fireEvent.click(sw)
    await waitFor(() => expect(letzterAufruf(vonMock(), 'settings', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'settings', 'upsert') as Upsert
    expect(u.key).toBe('email')
    expect(u.value.auto_enroll_after_erstgespraech).toBe(false)
    expect(u.value.auto_enroll_after_strategiegespraech).toBe(true)
    expect(u.value.sending_enabled).toBe(false)
    expect(u.value.provider).toBe('gmail_api')
  })

  it('zweiter Auto-Enroll-Switch (Strategiegespräch) schreibt ebenfalls nur seinen Key', async () => {
    rendern(<Ziele />, '/einstellungen/ziele')
    fireEvent.click(await screen.findByRole('switch', { name: /Nach Strategiegespräch/ }))
    await waitFor(() => expect(letzterAufruf(vonMock(), 'settings', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'settings', 'upsert') as Upsert
    expect(u.key).toBe('email')
    expect(u.value.auto_enroll_after_strategiegespraech).toBe(false)
    expect(u.value.auto_enroll_after_erstgespraech).toBe(true)
    expect(u.value.sending_enabled).toBe(false)
  })

  it('E-12: Feiertag hinzufügen (24.12.2026) → Chip, Speichern ersetzt settings.feiertage sortiert', async () => {
    rendern(<Ziele />, '/einstellungen/ziele')
    const feld = await screen.findByLabelText('Feiertag hinzufügen')
    fireEvent.change(feld, { target: { value: '24.12.2026' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    const liste = screen.getByRole('list', { name: 'Feiertage 2026' })
    expect(within(liste).getByText('Do 24.12.')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('form', { name: 'Feiertage' })).getByRole('button', { name: /Speichern/ }))
    await waitFor(() => expect(letzterAufruf(vonMock(), 'settings', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'settings', 'upsert') as { key: string; value: string[] }
    expect(u.key).toBe('feiertage')
    expect(u.value).toEqual(['2026-10-31', '2026-12-24', '2026-12-25', '2026-12-26', '2027-01-01'])
  })

  it('Feiertag: ungültige Eingabe und Dublette zeigen einen Hinweis, Entfernen nimmt den Chip raus', async () => {
    rendern(<Ziele />, '/einstellungen/ziele')
    const feld = await screen.findByLabelText('Feiertag hinzufügen')
    fireEvent.change(feld, { target: { value: 'irgendwann' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(screen.getByText(/Datum wie/)).toBeInTheDocument()
    fireEvent.change(feld, { target: { value: '31.10.2026' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(screen.getByText(/steht schon in der Liste/)).toBeInTheDocument()
    const liste = screen.getByRole('list', { name: 'Feiertage 2026' })
    expect(within(liste).getAllByRole('listitem')).toHaveLength(3)
    fireEvent.click(within(liste).getAllByRole('button', { name: 'Entfernen' })[0]!)
    expect(within(liste).getAllByRole('listitem')).toHaveLength(2)
  })
})
