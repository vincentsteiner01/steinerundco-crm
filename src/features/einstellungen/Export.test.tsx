// Export & Backup (Neustart 25.11.2026): CSV nur noch für Leads und Einzelmails – Leads mit der Spalte „Liste“ (board_liste)
// statt „Stufe“. Voll-Backup: Dateiname, settings.backup gesetzt (E-09), „Letztes Backup“-Karte. Keine Taste B, kein
// ?aktion=backup, keine Verweise auf Heute und Import.
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

import { toast, toastFehler } from '@/components/toast'
import { supabase } from '@/data/supabase'
import { useUiStore } from '@/app/uiStore'
import { useAuth } from '@/features/auth/authStore'
import { csvText, download, downloadJson } from '@/lib/csv'
import { vollerLead } from '@/test/fixtures/leads'
import { Export } from './Export'
import { emailSpalten, EXPORT_TABELLEN, leadSpalten } from './daten/export'
import { anzahlAufrufe, letzterAufruf, MEMBER_V, MEMBERS, testZustand, testZustandZuruecksetzen } from './_testDaten'
import { rendern } from './_testHilfe'

const vonMock = () => vi.mocked(supabase.from)
const rpcMock = () => vi.mocked(supabase.rpc) as unknown as ReturnType<typeof vi.fn>
/** Namen der Tabellen, die über supabase.from(…) angefragt wurden – in der Reihenfolge der Aufrufe. */
const tabellen = (): string[] => vonMock().mock.calls.map((c) => String(c[0]))
const BACKUP = { exported_at: '2026-10-15T07:00:00Z', version: 1, tables: { leads: [], companies: [], activities: [] } }
const LEAD_KOPF =
  'Name;Unternehmen;Rolle;Stadt;LinkedIn-URL;E-Mail;Telefon;Liste;Zuständig;Sales-Verantwortlich;Nächste Aktion;Nächster Schritt;Letzte Aktivität;E-Mail-Erlaubnis;Widerspruch;Quelle;Angelegt;ID'

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
    vi.mocked(toastFehler).mockClear()
    testZustandZuruecksetzen()
  })

  it('CSV Leads: Spalte „Liste“ aus board_liste an der Stelle der alten „Stufe“ – die Stufe steht nirgends mehr', () => {
    const aufDemBoard = vollerLead(1, {
      owner_id: MEMBER_V,
      created_at: '2026-10-14T08:00:00+02:00',
      stage: 'pitch',
      board_liste: 'gespraech',
      company_name: 'Solar; "01" GmbH',
    })
    const text = csvText([aufDemBoard], leadSpalten({ members: MEMBERS }))
    const [kopf, zeile] = text.split('\r\n')
    expect(kopf).toBe(LEAD_KOPF)
    const koepfe = kopf!.split(';')
    expect(koepfe).toContain('Liste')
    expect(koepfe).not.toContain('Stufe')
    expect(koepfe.indexOf('Liste')).toBe(7)
    expect(zeile).toContain('"Solar; ""01"" GmbH"')
    expect(zeile).toContain(';Gespräch vereinbart;Vincent;')
    // Weder das alte Stufen-Label noch der rohe Wert tauchen auf
    expect(zeile).not.toContain('Erstgespräch gepitcht')
    expect(zeile).not.toMatch(/;pitch;/)
    expect(zeile).toContain('14.10.2026, 08:00')
    expect(zeile).toContain(';nein;')
  })

  it('CSV Leads: jede der vier Listen mit ihrem Titel, alte Leads ohne Liste mit leerer Zelle', () => {
    const spalte = leadSpalten({ members: MEMBERS }).find((s) => s.label === 'Liste')!
    const titel = (liste: string | null) => spalte.wert!(vollerLead(2, { board_liste: liste }))
    expect(titel('angeschrieben')).toBe('Angeschrieben')
    expect(titel('gespraech')).toBe('Gespräch vereinbart')
    expect(titel('im_geschaeft')).toBe('Im Geschäft')
    expect(titel('verloren')).toBe('Verloren')
    expect(titel(null)).toBe('')
    const alt = vollerLead(3, { owner_id: MEMBER_V, board_liste: null })
    const zeile = csvText([alt], leadSpalten({ members: MEMBERS })).split('\r\n')[1]!
    expect(zeile.split(';')[7]).toBe('')
    expect(zeile.split(';')[8]).toBe('Vincent')
  })

  it('CSV-Liste: nur noch Leads und Einzelmails', async () => {
    expect(EXPORT_TABELLEN.map((t) => t.key)).toEqual(['leads', 'emails'])
    expect(emailSpalten({ members: MEMBERS }).map((s) => s.label)).toEqual([
      'Gesendet',
      'Lead-ID',
      'Person',
      'Richtung',
      'An',
      'Betreff',
      'Status',
      'Erlaubnis',
      'ID',
    ])
    rendern(<Export />, '/einstellungen/export')
    await screen.findByText('noch nie')
    expect(
      screen.getAllByRole('button', { name: /als CSV herunterladen/ }).map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Leads als CSV herunterladen', 'Einzelmails als CSV herunterladen'])
    expect(screen.queryByText(/Ereignisse|Anrufe|KPI/)).not.toBeInTheDocument()
  })

  it('Texte ohne Verweise auf Heute und Import, keine Tastenhinweise', async () => {
    const { container } = rendern(<Export />, '/einstellungen/export')
    await screen.findByText('noch nie')
    expect(container.textContent).not.toMatch(/Heute|Import|Preset|v1\.1|Papierkorb|Ansicht/)
    expect(container.querySelector('kbd')).toBeNull()
    expect(screen.getByText(/Kampagnen und Postfächer sind nicht enthalten/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sicherungen auf GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/vincentsteiner01/steinerundco-crm/actions',
    )
  })

  it('E-09: „Backup herunterladen“ ruft export_backup (GET), lädt die Datei und setzt settings.backup', async () => {
    rendern(<Export />, '/einstellungen/export')
    await screen.findByText('noch nie')
    fireEvent.click(screen.getByRole('button', { name: 'Backup herunterladen' }))
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

  it('leere Antwort ist kein Backup: kein Download, „Letztes Backup“ bleibt unberührt, Fehlermeldung', async () => {
    rpcMock().mockResolvedValue({ data: null, error: null })
    rendern(<Export />, '/einstellungen/export')
    await screen.findByText('noch nie')
    fireEvent.click(screen.getByRole('button', { name: 'Backup herunterladen' }))
    await waitFor(() => expect(toastFehler).toHaveBeenCalledTimes(1))
    expect(vi.mocked(toastFehler).mock.calls[0]?.[0]).toBe('Das Backup kam leer zurück.')
    expect(downloadJson).not.toHaveBeenCalled()
    expect(anzahlAufrufe(vonMock(), 'settings', 'upsert')).toBe(0)
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

  it('ohne Zeilen in crm.settings: „noch nie“ statt Absturz, die Knöpfe sind da', async () => {
    testZustand.settingsOhne = 'alle'
    rendern(<Export />, '/einstellungen/export')
    expect(await screen.findByText('noch nie')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Backup herunterladen' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: /als CSV herunterladen/ })).toHaveLength(2)
  })

  it('Neustart: die Taste B löst nichts aus, ?aktion=backup startet kein Backup', async () => {
    rendern(<Export />, '/einstellungen/export?aktion=backup')
    await screen.findByText('noch nie')
    fireEvent.keyDown(document.body, { key: 'b' })
    // Zeit für einen (falschen) Start geben, dann prüfen
    await new Promise((r) => setTimeout(r, 30))
    expect(rpcMock()).not.toHaveBeenCalled()
    expect(downloadJson).not.toHaveBeenCalled()
  })

  it('CSV Leads: lädt ohne Papierkorb, benennt crm-leads-<Tag>.csv', async () => {
    rendern(<Export />, '/einstellungen/export')
    fireEvent.click(await screen.findByRole('button', { name: 'Leads als CSV herunterladen' }))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    const name = vi.mocked(download).mock.calls[0]?.[1]
    expect(name).toMatch(/^crm-leads-\d{4}-\d{2}-\d{2}\.csv$/)
    const kette = vonMock().mock.results[tabellen().indexOf('leads')]?.value as Record<string, ReturnType<typeof vi.fn>>
    expect(kette.is).toHaveBeenCalledWith('deleted_at', null)
    expect(kette.range).toHaveBeenCalledWith(0, 499)
    expect(toast).toHaveBeenCalledWith('CSV heruntergeladen – 0 Zeilen.')
  })

  it('CSV Einzelmails: lädt aus emails, benennt crm-emails-<Tag>.csv', async () => {
    rendern(<Export />, '/einstellungen/export')
    fireEvent.click(await screen.findByRole('button', { name: 'Einzelmails als CSV herunterladen' }))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(vi.mocked(download).mock.calls[0]?.[1]).toMatch(/^crm-emails-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(tabellen()).toContain('emails')
  })
})
