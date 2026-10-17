// @vitest-environment jsdom
// Verlauf in der Seitenleiste (17.10.2026): Gespräche/Alles, Aufklappen, Ältere laden, Tageslabel.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeadAnsicht, VerlaufEintrag, VerlaufSeite } from '../src/shared/typen'
import { istGespraech, tagLabel, Verlauf } from '../src/ui/panel/Verlauf'

const eintrag = (id: number, p: Partial<VerlaufEintrag>): VerlaufEintrag => ({
  id,
  zeit: '2026-10-16T10:00:00Z',
  typ: 'nachricht_gesendet',
  kanal: 'linkedin',
  kategorie: 'nachrichten',
  text: `Eintrag ${id}`,
  wer: 'VS',
  eingehend: false,
  details: null,
  notiz: null,
  ...p,
})

const SEITE_1: VerlaufSeite = {
  eintraege: [
    eintrag(5, { typ: 'nachricht_erhalten', eingehend: true, wer: 'Tilda', text: 'Antwort erhalten: ‚Gern mehr Infos.‘' }),
    eintrag(4, { text: 'Kurzfristig 1 gesendet', details: 'Hallo Frau Testfall, …' }),
    eintrag(3, { typ: 'stage_wechsel', kategorie: 'status', kanal: 'sonstiges', wer: '', text: 'Phase: Gespräch eröffnet' }),
  ],
  weiter: { occurredAt: '2026-10-10T08:00:00Z', id: 3 },
}
const SEITE_2: VerlaufSeite = {
  eintraege: [eintrag(2, { typ: 'anruf', kanal: 'telefon', kategorie: 'anrufe', text: 'Anruf: nicht erreicht' })],
  weiter: null,
}

describe('Verlauf', () => {
  const sendMessage = vi.fn(async (n: unknown) => {
    const m = n as { typ: string; vor: unknown }
    return { ok: true, daten: m.vor ? SEITE_2 : SEITE_1 }
  })
  beforeEach(() => {
    sendMessage.mockClear()
    ;(globalThis as unknown as { chrome: unknown }).chrome = { runtime: { sendMessage } }
  })
  afterEach(() => cleanup())

  it('zeigt Gespräche (ohne Statuswechsel), Eingang mit Namen; „Alles“ blendet System-Einträge ein', async () => {
    render(<Verlauf leadId="lead-1" stand={{} as LeadAnsicht} />)
    const liste = await screen.findByRole('list', { name: 'Einträge' })
    expect(within(liste).getAllByRole('listitem')).toHaveLength(2)
    expect(within(liste).getByText('Tilda')).toBeTruthy()
    expect(within(liste).queryByText('Phase: Gespräch eröffnet')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Alles' }))
    expect(within(liste).getAllByRole('listitem')).toHaveLength(3)
    expect(sendMessage).toHaveBeenCalledWith({ typ: 'verlauf', leadId: 'lead-1', vor: null })
  })

  it('„anzeigen“ klappt den gesendeten Text auf; „Ältere laden“ holt die nächste Seite mit Cursor', async () => {
    render(<Verlauf leadId="lead-1" stand={{} as LeadAnsicht} />)
    await screen.findByRole('list', { name: 'Einträge' })
    expect(screen.queryByText('Hallo Frau Testfall, …')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'anzeigen' }))
    expect(screen.getByText('Hallo Frau Testfall, …')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ältere laden' }))
    await waitFor(() => expect(screen.getByText('Anruf: nicht erreicht')).toBeTruthy())
    expect(sendMessage).toHaveBeenLastCalledWith({ typ: 'verlauf', leadId: 'lead-1', vor: SEITE_1.weiter })
    expect(screen.queryByRole('button', { name: 'Ältere laden' })).toBeNull()
  })

  it('Hilfsregeln: Termine zählen als Gespräch, Tageslabel Heute/Gestern', () => {
    expect(istGespraech({ kategorie: 'status', typ: 'meeting_geplant' })).toBe(true)
    expect(istGespraech({ kategorie: 'system', typ: 'sequenz_gestartet' })).toBe(false)
    const jetzt = new Date('2026-10-17T12:00:00Z')
    expect(tagLabel('2026-10-17T06:00:00Z', jetzt)).toBe('Heute')
    expect(tagLabel('2026-10-16T21:30:00Z', jetzt)).toBe('Gestern')
  })
})
