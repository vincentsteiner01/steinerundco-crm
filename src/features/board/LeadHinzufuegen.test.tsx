// „Lead hinzufügen“ gegen einen gemockten Supabase-Client (26.11.2026): Der LinkedIn-Link wird im Formular geprüft und auf den
// Profil-Teil gekürzt, bevor das RPC crm.board_karte_anlegen gerufen wird. Was kein Profil-Link ist, steht sofort am Feld –
// ohne Anfrage (vorher: „400 (Bad Request)“ in der Konsole). Nur erfundene Namen.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Member } from '@/types/domain'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
vi.mock('@/components/toast', () => ({ toast: vi.fn(), toastUndo: vi.fn(), toastFehler: vi.fn() }))

import { supabase } from '@/data/supabase'
import { LeadHinzufuegen } from './LeadHinzufuegen'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const MITGLIEDER = [
  { id: A, display_name: 'Anna', email: 'anna@beispiel.test' },
  { id: B, display_name: 'Ben', email: 'ben@beispiel.test' },
] as Member[]
const SAUBER = 'https://www.linkedin.com/in/max-muster-demo'
const KEIN_PROFIL = 'Das ist kein LinkedIn-Profil-Link – er muss linkedin.com/in/… enthalten'

function zeigen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const onAngelegt = vi.fn()
  render(
    <QueryClientProvider client={qc}>
      <LeadHinzufuegen offen onOpenChange={vi.fn()} members={MITGLIEDER} meId={A} onAngelegt={onAngelegt} />
    </QueryClientProvider>,
  )
  return { d: within(screen.getByRole('dialog', { name: 'Lead hinzufügen' })), onAngelegt }
}

type Dialog = ReturnType<typeof zeigen>['d']
const ausfuellen = (d: Dialog, link: string) => {
  fireEvent.change(d.getByLabelText('Vorname'), { target: { value: 'Max' } })
  fireEvent.change(d.getByLabelText('Nachname'), { target: { value: 'Muster' } })
  fireEvent.change(d.getByLabelText('LinkedIn-Link'), { target: { value: link } })
}
const hinzufuegen = (d: Dialog) => fireEvent.click(d.getByRole('button', { name: 'Hinzufügen' }))
/** Was als `p_linkedin_url` beim RPC ankam. */
const gesendeterLink = () => {
  const [name, args] = vi.mocked(supabase.rpc).mock.calls[0] as unknown as [string, { p_linkedin_url: unknown }]
  expect(name).toBe('board_karte_anlegen')
  return args.p_linkedin_url
}

beforeEach(() => {
  vi.mocked(supabase.rpc)
    .mockReset()
    .mockResolvedValue({
      data: { status: 'neu', lead_id: 'neu', liste: 'angeschrieben', owner_id: A },
      error: null,
    } as never)
})

describe('Lead hinzufügen: LinkedIn-Link', () => {
  it.each([
    'https://www.linkedin.com/in/max-muster-demo/overlay/contact-info/',
    'https://www.linkedin.com/in/max-muster-demo/detail/contact-info/',
    'https://www.linkedin.com/in/max-muster-demo/recent-activity/all/',
    'linkedin.com/mwlite/in/max-muster-demo',
    'https://de.linkedin.com/in/max-muster-demo/?originalSubdomain=de',
  ])('%j geht als sauberer Profil-Link an die Datenbank', async (link) => {
    const { d, onAngelegt } = zeigen()
    ausfuellen(d, link)
    hinzufuegen(d)
    await waitFor(() => expect(onAngelegt).toHaveBeenCalledTimes(1))
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(gesendeterLink()).toBe(SAUBER)
    expect(vi.mocked(supabase.rpc).mock.calls[0]![1]).toMatchObject({
      p_vorname: 'Max',
      p_nachname: 'Muster',
      p_owner: A,
    })
    expect(d.queryByRole('alert')).toBeNull()
  })

  it.each([
    'https://www.linkedin.com/company/muster-solar-demo',
    'https://www.linkedin.com/sales/lead/ACwAAABCDEF,NAME_SEARCH,abc',
    'https://notlinkedin.com/in/max-muster-demo',
  ])('%j: der Fehler steht sofort am Feld, die Datenbank wird nicht gefragt', (link) => {
    const { d, onAngelegt } = zeigen()
    ausfuellen(d, link)
    hinzufuegen(d)
    expect(d.getByRole('alert')).toHaveTextContent(KEIN_PROFIL)
    expect(d.getByLabelText('LinkedIn-Link')).toHaveAttribute('aria-invalid', 'true')
    expect(d.getByLabelText('LinkedIn-Link')).toHaveValue(link)
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(onAngelegt).not.toHaveBeenCalled()
  })

  it('Enter im Link-Feld prüft genauso; nach der Korrektur verschwindet der Fehler und der Lead wird angelegt', async () => {
    const { d, onAngelegt } = zeigen()
    ausfuellen(d, 'https://www.linkedin.com/feed/')
    fireEvent.keyDown(d.getByLabelText('LinkedIn-Link'), { key: 'Enter' })
    expect(d.getByRole('alert')).toHaveTextContent(KEIN_PROFIL)
    expect(supabase.rpc).not.toHaveBeenCalled()
    fireEvent.change(d.getByLabelText('LinkedIn-Link'), {
      target: { value: 'https://www.linkedin.com/in/max-muster-demo/overlay/contact-info/' },
    })
    fireEvent.keyDown(d.getByLabelText('LinkedIn-Link'), { key: 'Enter' })
    await waitFor(() => expect(onAngelegt).toHaveBeenCalledTimes(1))
    expect(gesendeterLink()).toBe(SAUBER)
    expect(d.getByLabelText('LinkedIn-Link')).not.toHaveAttribute('aria-invalid')
  })

  it('der Link ist freiwillig: ohne Link wird der Lead angelegt', async () => {
    const { d, onAngelegt } = zeigen()
    ausfuellen(d, '   ')
    hinzufuegen(d)
    await waitFor(() => expect(onAngelegt).toHaveBeenCalledTimes(1))
    expect(gesendeterLink()).toBeNull()
  })

  it('lehnt die Datenbank trotzdem ab, steht ihr Text weiter am Feld', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { code: 'P0001', message: KEIN_PROFIL } } as never)
    const { d, onAngelegt } = zeigen()
    ausfuellen(d, 'linkedin.com/in/max-muster-demo')
    hinzufuegen(d)
    expect(await d.findByRole('alert')).toHaveTextContent(KEIN_PROFIL)
    expect(d.getByLabelText('LinkedIn-Link')).toHaveAttribute('aria-invalid', 'true')
    expect(onAngelegt).not.toHaveBeenCalled()
  })
})
