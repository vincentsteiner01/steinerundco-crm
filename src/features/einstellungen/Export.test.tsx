// BAUPLAN § 3.9 Export.test: CSV-Format (BOM, `;`, DD.MM.YYYY), Backup-Dateiname, settings.backup gesetzt (E-09),
// „Letztes Backup“-Karte, ?aktion=backup aus der Palette, CSV je Tabelle lädt alle Seiten.
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('./_testDaten')).supabaseAntworten())
vi.mock('@/components/toast', () => ({
  toast: vi.fn(),
  toastFehler: vi.fn(),
  toastUndo: vi.fn(),
  registriereUndo: vi.fn(),
}))
vi.mock('@/lib/csv', async (orig) => {
  const m = await orig<typeof import('@/lib/csv')>()
  return { ...m, download: vi.fn(), downloadJson: vi.fn() }
})

import { toast } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { csvText, download, downloadJson } from '@/lib/csv'
import { vollerLead } from '@/test/fixtures/leads'
import { Export } from './Export'
import { leadSpalten } from './daten/export'
import { letzterAufruf, MEMBER_V, MEMBERS, testZustand } from './_testDaten'
import { rendern } from './_testHilfe'

const vonMock = () => vi.mocked(supabase.from)
const rpcMock = () => vi.mocked(supabase.rpc) as unknown as ReturnType<typeof vi.fn>
const BACKUP = { exported_at: '2026-10-15T07:00:00Z', version: 1, tables: { leads: [], companies: [], activities: [] } }

describe('Export', () => {
  beforeEach(() => {
    useAuth.setState({
      status: 'mitglied',
      member: { user_id: MEMBER_V, email: 'v@example.test', display_name: 'Vincent' },
    })
    useUiStore.setState({ hotkeyScope: 'global', scopeStack: [] })
    vonMock().mockClear()
    rpcMock().mockReset()
    rpcMock().mockResolvedValue({ data: BACKUP, error: null })
    vi.mocked(download).mockClear()
    vi.mocked(downloadJson).mockClear()
    vi.mocked(toast).mockClear()
    testZustand.backup = null
  })

  it('CSV-Format: Spalten mit Labels, Datum DD.MM.YYYY, Stufen-Label, Zuständig als Name', () => {
    const lead = vollerLead(1, {
      owner_id: MEMBER_V,
      created_at: '2026-10-14T08:00:00+02:00',
      stage: 'pitch',
      company_name: 'Solar; "01" GmbH',
    })
    const text = csvText([lead], leadSpalten({ members: MEMBERS, settings: undefined }))
    const [kopf, zeile] = text.split('\r\n')
    expect(kopf).toBe(
      'Name;Unternehmen;Rolle;Stadt;LinkedIn-URL;E-Mail;Telefon;Stufe;Zuständig;Sales-Verantwortlich;Nächste Aktion;Nächster Schritt;Letzte Aktivität;E-Mail-Erlaubnis;Widerspruch;Quelle;Angelegt;ID',
    )
    expect(zeile).toContain('"Solar; ""01"" GmbH"')
    expect(zeile).toContain(';Erstgespräch gepitcht;Vincent;')
    expect(zeile).toContain('14.10.2026, 08:00')
    expect(zeile).toContain(';nein;')
  })

  it('zeigt „noch nie“ ohne settings.backup und den Actions-Link', async () => {
    rendern(<Export />, '/einstellungen/export')
    expect(await screen.findByText('noch nie')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Actions-Tab öffnen/ })).toHaveAttribute(
      'href',
      'https://github.com/vincentsteiner01/steinerundco-crm/actions',
    )
    expect(screen.getAllByRole('button', { name: /als CSV herunterladen/ })).toHaveLength(5)
  })

  it('E-09: „Voll-Backup JSON“ ruft export_backup (GET), lädt die Datei und setzt settings.backup', async () => {
    rendern(<Export />, '/einstellungen/export')
    fireEvent.click(await screen.findByRole('button', { name: /Voll-Backup JSON/ }))
    await waitFor(() => expect(downloadJson).toHaveBeenCalledTimes(1))
    expect(rpcMock()).toHaveBeenCalledWith('export_backup', {}, { get: true })
    const [doc, name] = vi.mocked(downloadJson).mock.calls[0] as [unknown, string]
    expect(doc).toEqual(BACKUP)
    expect(name).toMatch(/^steinerundco-crm-backup-\d{4}-\d{2}-\d{2}\.json$/)
    await waitFor(() => expect(letzterAufruf(vonMock(), 'settings', 'upsert')).not.toBeNull())
    const u = letzterAufruf(vonMock(), 'settings', 'upsert') as { key: string; value: { last_at: string; by: string } }
    expect(u.key).toBe('backup')
    expect(u.value.by).toBe('Vincent')
    expect(Date.parse(u.value.last_at)).not.toBeNaN()
    expect(toast).toHaveBeenCalledWith('Backup heruntergeladen – 3 Tabellen.')
  })

  it('„Letztes Backup“: vor 9 Tagen in Amber (≥ 7), gestern in ink-bright', async () => {
    testZustand.backup = { last_at: '2026-10-06T08:00:00+02:00', by: 'Vincent' }
    vi.useFakeTimers({ now: new Date('2026-10-15T09:00:00+02:00'), toFake: ['Date'] })
    try {
      rendern(<Export />, '/einstellungen/export')
      const abstand = await screen.findByText('vor 9 Tagen')
      expect(abstand).toHaveClass('text-overdue')
      expect(screen.getByText('06.10.2026 (Vincent)')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
    testZustand.backup = { last_at: '2026-10-14T20:00:00+02:00', by: 'Mike' }
    vi.useFakeTimers({ now: new Date('2026-10-15T09:00:00+02:00'), toFake: ['Date'] })
    try {
      rendern(<Export />, '/einstellungen/export')
      const abstand = await screen.findByText('gestern')
      expect(abstand).toHaveClass('text-ink-bright')
    } finally {
      vi.useRealTimers()
    }
  })

  it('B löst das Backup aus; ?aktion=backup startet es automatisch und räumt den Parameter weg', async () => {
    rendern(<Export />, '/einstellungen/export')
    await screen.findByText('noch nie')
    fireEvent.keyDown(document.body, { key: 'b' })
    await waitFor(() => expect(downloadJson).toHaveBeenCalledTimes(1))

    vi.mocked(downloadJson).mockClear()
    const { router } = rendern(<Export />, '/einstellungen/export?aktion=backup')
    await waitFor(() => expect(downloadJson).toHaveBeenCalledTimes(1))
    expect(router.state.location.search).toBe('')
  })

  it('CSV je Tabelle: Leads lädt ohne Papierkorb, benennt crm-leads-<Tag>.csv', async () => {
    rendern(<Export />, '/einstellungen/export')
    fireEvent.click(await screen.findByRole('button', { name: 'Leads als CSV herunterladen' }))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    const name = vi.mocked(download).mock.calls[0]?.[1]
    expect(name).toMatch(/^crm-leads-\d{4}-\d{2}-\d{2}\.csv$/)
    const kette = vonMock().mock.results[vonMock().mock.calls.findIndex((c) => c[0] === 'leads')]?.value as Record<
      string,
      ReturnType<typeof vi.fn>
    >
    expect(kette.is).toHaveBeenCalledWith('deleted_at', null)
    expect(kette.range).toHaveBeenCalledWith(0, 499)
    expect(toast).toHaveBeenCalledWith('CSV heruntergeladen – 0 Zeilen.')
  })
})
