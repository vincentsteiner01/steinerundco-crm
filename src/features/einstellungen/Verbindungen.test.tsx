// Einstellungen → Verbindungen: Status, Script kopieren (wörtlich die Datei aus tools/apps-script), Schlüssel einmal zeigen
// (nie im Query-Cache), neuer Schlüssel/Widerrufen nur nach Rückfrage, eigenes LinkedIn-Profil, Schritt 5 live,
// Chrome-Erweiterung, Eingang als Tab (?tab=eingang).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const SCHLUESSEL = 'Ab3_dEf-ghIJklmNOPqrsTUVwxyz0123456789ABCDE'

const zustand: {
  token: { created_at: string; last_used_at: string | null; label: string | null } | null
  eingang: Record<string, unknown>[]
} = { token: null, eingang: [] }

vi.mock('@/data/supabase', async () => {
  const { supabaseMock } = await import('@/test/supabaseMock')
  const { MEMBERS } = await import('./_testDaten')
  return supabaseMock((tabelle) => {
    switch (tabelle) {
      case 'members':
        return { data: MEMBERS, error: null }
      case 'eingang_tokens':
        return { data: zustand.token ? [zustand.token] : [], error: null }
      case 'eingang':
        return { data: zustand.eingang, error: null, count: zustand.eingang.length }
      case 'member_profiles':
        return { data: { member_id: MEMBERS[0]!.id }, error: null }
      default:
        return { data: [], error: null, count: 0 }
    }
  })
})
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(),
  toastRealtime: vi.fn(),
  registriereUndo: vi.fn(),
  UNDO_MS: 6000,
  TOAST_MS: 4000,
}))

import { toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useAuth } from '@/features/auth/authStore'
import type { KanalMock } from '@/test/supabaseMock'
import { Component as EinstellungenSeite } from './EinstellungenSeite'
import { SKRIPT } from './verbindungen/konstanten'
import { letzterAufruf, MEMBER_V } from './_testDaten'
import { rendern } from './_testHilfe'

const rpc = () => vi.mocked(supabase.rpc)
const kanaele = () => (supabase as unknown as { __kanaele: KanalMock[] }).__kanaele

describe('Einstellungen → Verbindungen', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    zustand.token = null
    zustand.eingang = []
    rpc().mockReset()
    rpc().mockResolvedValue({ data: null, error: null } as never)
    vi.mocked(toast).mockClear()
    vi.mocked(navigator.clipboard.writeText).mockClear()
  })

  it('zeigt Gmail-Abschnitt mit Status und fünf Schritten, die Chrome-Erweiterung und den Weg zum Eingang', async () => {
    rendern(<EinstellungenSeite />, '/einstellungen/verbindungen')
    expect(screen.getByRole('heading', { level: 2, name: 'Verbindungen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'LinkedIn-Benachrichtigungen aus Gmail' })).toBeInTheDocument()
    expect(await screen.findByText('Nicht eingerichtet')).toBeInTheDocument()
    const schritte = screen.getByRole('list', { name: 'Einrichtung in fünf Schritten' })
    expect(within(schritte).getAllByRole('heading', { level: 4 })).toHaveLength(5)
    expect(screen.getByText('Wartet auf den ersten Eingang')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Chrome-Erweiterung' })).toBeInTheDocument()
    expect(screen.getByText('1.1.0')).toBeInTheDocument()
    expect(screen.getAllByText('⌥C').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /script.google.com öffnen/ })).toHaveAttribute(
      'href',
      'https://script.google.com/home',
    )
    expect(screen.getByRole('button', { name: 'Eingang ansehen' })).toBeInTheDocument()
  })

  it('„Script kopieren“ kopiert wörtlich tools/apps-script/LinkedIn-ins-CRM.gs', async () => {
    rendern(<EinstellungenSeite />, '/einstellungen/verbindungen')
    const datei = readFileSync(join(process.cwd(), 'tools/apps-script/LinkedIn-ins-CRM.gs'), 'utf8')
    expect(SKRIPT).toBe(datei)
    fireEvent.click(screen.getByRole('button', { name: 'Script kopieren' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(datei))
    expect(datei).toContain('function einrichten')
  })

  it('Schlüssel erzeugen: RPC, Klartext einmal sichtbar, nie im Query-Cache, „ausblenden“ entfernt ihn', async () => {
    rpc().mockResolvedValue({ data: SCHLUESSEL, error: null } as never)
    const { qc } = rendern(<EinstellungenSeite />, '/einstellungen/verbindungen')
    fireEvent.click(await screen.findByRole('button', { name: 'Schlüssel erzeugen' }))
    await waitFor(() =>
      expect(rpc()).toHaveBeenCalledWith('eingang_token_erzeugen', { p_label: 'Gmail (Apps Script) · CRM-App' }),
    )
    const feld = await screen.findByLabelText('Dein Schlüssel – nur jetzt sichtbar')
    expect(feld).toHaveValue(SCHLUESSEL)
    expect(feld).toHaveAttribute('readonly')
    expect(
      JSON.stringify(
        qc
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain(SCHLUESSEL)
    expect(
      JSON.stringify(
        qc
          .getMutationCache()
          .getAll()
          .map((m) => m.state.data),
      ),
    ).not.toContain(SCHLUESSEL)
    expect(JSON.stringify({ ...localStorage })).not.toContain(SCHLUESSEL)
    fireEvent.click(screen.getByRole('button', { name: 'Eingetragen – ausblenden' }))
    expect(screen.queryByDisplayValue(SCHLUESSEL)).not.toBeInTheDocument()
  })

  it('unvollständiger Schlüssel wird nicht angezeigt', async () => {
    rpc().mockResolvedValue({ data: 'kurz', error: null } as never)
    rendern(<EinstellungenSeite />, '/einstellungen/verbindungen')
    fireEvent.click(await screen.findByRole('button', { name: 'Schlüssel erzeugen' }))
    await waitFor(() => expect(rpc()).toHaveBeenCalledTimes(1))
    expect(screen.queryByLabelText('Dein Schlüssel – nur jetzt sichtbar')).not.toBeInTheDocument()
  })

  it('aktiver Schlüssel: Status „Läuft“, neuer Schlüssel und Widerrufen nur nach Rückfrage', async () => {
    zustand.token = {
      created_at: '2026-10-10T08:00:00Z',
      last_used_at: new Date(Date.now() - 65 * 60_000).toISOString(),
      label: null,
    }
    zustand.eingang = [
      {
        id: 'a',
        status: 'verarbeitet',
        art: 'nachricht',
        created_at: '2026-10-15T09:00:00Z',
        empfangen_at: '2026-10-15T09:00:00Z',
        absender_name: 'Erika Test',
      },
      {
        id: 'b',
        status: 'unbekannt',
        art: 'nachricht',
        created_at: '2026-10-15T08:00:00Z',
        empfangen_at: '2026-10-15T08:00:00Z',
        absender_name: null,
      },
    ]
    rendern(<EinstellungenSeite />, '/einstellungen/verbindungen')
    expect(await screen.findByText(/^Läuft – zuletzt übertragen vor 1\sStd\.$/)).toHaveAttribute(
      'data-zustand',
      'aktiv',
    )
    const status = screen.getByLabelText('Status')
    expect(status.textContent).toContain('1 verarbeitet·1 unbekannt·0 ignoriert·0 Fehler')
    expect(status.textContent).toContain('Nachricht · verarbeitet')
    expect(screen.getByText('Angekommen')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Neuen Schlüssel erzeugen' }))
    expect(await screen.findByRole('dialog', { name: 'Neuen Schlüssel erzeugen?' })).toBeInTheDocument()
    expect(rpc()).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abbrechen' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    rpc().mockResolvedValue({ data: 1, error: null } as never)
    fireEvent.click(within(status).getByRole('button', { name: 'Widerrufen' }))
    const dialog = await screen.findByRole('dialog', { name: 'Schlüssel widerrufen?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Widerrufen' }))
    await waitFor(() => expect(rpc()).toHaveBeenCalledWith('eingang_token_widerrufen'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Schlüssel widerrufen – dein Script überträgt nichts mehr.'))
  })

  it('eigenes LinkedIn-Profil: normalisiert speichern, ungültige Adresse abgelehnt', async () => {
    rendern(<EinstellungenSeite />, '/einstellungen/verbindungen')
    fireEvent.click(await screen.findByRole('button', { name: 'Eintragen' }))
    const feld = screen.getByRole('textbox', { name: 'Dein LinkedIn-Profil' })
    fireEvent.change(feld, { target: { value: 'linkedin.com/company/firma' } })
    fireEvent.submit(feld.closest('form')!)
    expect(await screen.findByText(/Profil-Adresse nicht erkannt/)).toBeInTheDocument()
    fireEvent.change(feld, { target: { value: 'https://de.linkedin.com/in/Test-Person/?trk=x' } })
    fireEvent.submit(feld.closest('form')!)
    await waitFor(() => expect(toast).toHaveBeenCalledWith('LinkedIn-Profil gespeichert.'))
    expect(letzterAufruf(supabase.from, 'member_profiles', 'upsert')).toMatchObject({
      member_id: MEMBER_V,
      linkedin_url: 'https://www.linkedin.com/in/test-person/',
    })
  })

  it('Schritt 5: der erste Eingang erscheint live (Kanal crm:eingang)', async () => {
    rendern(<EinstellungenSeite />, '/einstellungen/verbindungen')
    expect(await screen.findByText('Wartet auf den ersten Eingang')).toBeInTheDocument()
    zustand.eingang = [
      {
        id: 'x',
        status: 'verarbeitet',
        art: 'annahme',
        created_at: '2026-10-15T10:00:00Z',
        empfangen_at: '2026-10-15T10:00:00Z',
        absender_name: 'Fritz Muster',
      },
    ]
    const k = kanaele().find((x) => x.name === 'crm:eingang')
    k?.handler[0]?.cb({ eventType: 'INSERT' })
    expect(await screen.findByText(/Einladung angenommen von Fritz Muster/)).toBeInTheDocument()
  })

  it('Eingang ist ein Tab (?tab=eingang) – keine eigene Route', async () => {
    const { router } = rendern(<EinstellungenSeite />, '/einstellungen/verbindungen')
    fireEvent.click(screen.getByRole('tab', { name: /Eingang/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?tab=eingang'))
    expect(router.state.location.pathname).toBe('/einstellungen/verbindungen')
    expect(await screen.findByText('Nichts zuzuordnen.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Einrichtung' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })
})
