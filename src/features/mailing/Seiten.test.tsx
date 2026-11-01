// Mailing-Seiten (01.11.2026) mit gemockten Datenhooks – nur erfundene Namen. Die Regeln selbst (Gate, Hochlauf, Motor) prüfen
// supabase/tests/mailing_test.sql gegen die echte Datenbank und die Deno-Tests der Edge Function mail-motor.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'

const K = 'k-1'
const m = vi.hoisted(() => ({
  speichern: vi.fn(),
  status: vi.fn(),
  senden: vi.fn(),
  markieren: vi.fn(),
  abmelden: vi.fn(async () => true),
}))

const jetzt = '2026-11-02T09:00:00.000Z'
const kampagne = {
  id: 'k-1',
  name: 'Nachfassen nach Telefonat',
  status: 'entwurf',
  status_text: null,
  zeitplan: { tage: [1, 2, 3, 4, 5], von: '08:00', bis: '16:00' },
  tageslimit: 50,
  neue_pro_tag: 20,
  stopp_firma: true,
  abmelde_satz: true,
  abmelde_kopf: true,
  datenschutz_satz: true,
  bounce_schutz: true,
  updated_at: jetzt,
  empfaenger: 2,
  wartend: 1,
  laufend: 1,
  beantwortet: 0,
  bounces: 0,
  gesendet: 1,
  heute: 1,
  antworten: 0,
  interessiert: 0,
}
const variante = (id: string, kennung: string, betreff: string, text: string) => ({
  id,
  schritt_id: 's',
  kennung,
  betreff,
  text,
  aktiv: true,
  updated_at: jetzt,
})
const schritte = [
  {
    id: 's1',
    kampagne_id: K,
    position: 0,
    wartetage: 0,
    im_thread: true,
    updated_at: jetzt,
    mail_varianten: [
      variante(
        'v1',
        'A',
        'Unterlagen zu [Unternehmen]',
        '[Briefanrede],\n\nwie besprochen.\n\nViele Grüße\n[Absender Vorname]',
      ),
      variante('v2', 'B', 'Kurz zu unserem Telefonat', 'Hallo [Vorname], hier der Link: www.beispiel.test'),
    ],
  },
  {
    id: 's2',
    kampagne_id: K,
    position: 1,
    wartetage: 3,
    im_thread: true,
    updated_at: jetzt,
    mail_varianten: [variante('v3', 'A', '', '[Briefanrede],\n\nkurz nachgefasst.')],
  },
]
const postfach = {
  id: 'p-1',
  adresse: 'vincent@versand-beispiel.test',
  absender_name: 'Vincent Testnutzer',
  rolle: 'versand',
  status: 'bereit',
  status_text: null,
  signatur: 'Vincent Testnutzer\nTestfirma',
  gesperrt_bis: null,
  abruf_ok_at: null,
  hochlauf_lage: {
    stufe: 'schonung',
    woche: 3,
    limit: 10,
    heute: 2,
    gruende: ['Bounce-Quote 3,1 % (Ziel unter 2 %)'],
    sends_14: 32,
    bounces_14: 1,
    bounce_quote: 0.031,
    abgelehnt_7: 0,
    platzierung: null,
  },
}
const empf = (id: string, vor: string, nach: string, status: string, schritt: number) => ({
  id,
  kampagne_id: K,
  lead_id: `l-${id}`,
  email: `${vor.toLowerCase()}@beispiel-solar.test`,
  status,
  schritt,
  naechster_versand_at: null,
  variablen: {},
  stopp_grund: null,
  leads: { first_name: vor, last_name: nach, company_name: `${nach} Solar GmbH` },
})
const antworten = [
  {
    id: 'a1',
    lead_id: 'l-e1',
    subject: 'Re: Unterlagen',
    body_text: 'Klingt gut, rufen Sie mich an.',
    from_address: 'lukas@beispiel-solar.test',
    to_address: 'vincent@versand-beispiel.test',
    sent_at: jetzt,
    hinweis: 'interessiert',
    label: null,
    gelesen_at: null,
    erledigt_at: null,
    kampagne_id: K,
    postfach_id: 'p-1',
    in_reply_to: '<a@b>',
    leads: { first_name: 'Lukas', last_name: 'Feldhaus', company_name: 'Feldhaus Solar GmbH', stage: 'dm_beantwortet' },
  },
  {
    id: 'a2',
    lead_id: 'l-e2',
    subject: 'Re: Telefonat',
    body_text: 'Bitte austragen.',
    from_address: 'jana@beispiel-solar.test',
    to_address: 'vincent@versand-beispiel.test',
    sent_at: jetzt,
    hinweis: 'abmeldung',
    label: null,
    gelesen_at: jetzt,
    erledigt_at: null,
    kampagne_id: K,
    postfach_id: 'p-1',
    in_reply_to: '<c@d>',
    leads: { first_name: 'Jana', last_name: 'Kurz', company_name: 'Kurz Energie', stage: 'dm_beantwortet' },
  },
]
const mutation = (fn: ReturnType<typeof vi.fn>) => ({ mutate: fn, mutateAsync: fn, isPending: false })

vi.mock('@/data', () => ({
  useMe: () => ({ id: 'me', display_name: 'Vincent', email: 'vincent@steinerundco.de' }),
  useMeId: () => 'me',
  useMembers: () => ({ data: [{ id: 'me', display_name: 'Vincent', email: 'vincent@steinerundco.de' }] }),
  useSettings: () => ({
    data: {
      email: {
        objection_sentence: 'Wenn Sie keine weiteren E-Mails möchten, genügt eine kurze Antwort.',
        privacy_url: 'https://beispiel.test/datenschutz',
      },
    },
  }),
}))
vi.mock('@/data/mailing', () => ({
  useKampagne: () => ({
    data: { kampagne, schritte, postfaecher: ['p-1'] },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useKampagnen: () => ({ data: [kampagne], isPending: false, isError: false, refetch: vi.fn() }),
  useEmpfaenger: () => ({
    data: [empf('e1', 'Lukas', 'Feldhaus', 'aktiv', 1), empf('e2', 'Jana', 'Kurz', 'wartet', 0)],
  }),
  usePostfaecher: () => ({ data: [postfach], isPending: false, isError: false, refetch: vi.fn() }),
  useDomains: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
  useAntworten: () => ({ data: antworten, isPending: false, isError: false, refetch: vi.fn() }),
  useMailVerlauf: () => ({ data: [] }),
  useVariantenZahlen: () => ({ data: [] }),
  useKampagnePruefen: () => ({ data: [{ empfaenger_id: 'e2', grund: 'Keine Erlaubnis-Grundlage' }] }),
  usePlatzierungsTests: () => ({ data: [] }),
  useSperrdomains: () => ({ data: [] }),
  useMailLeads: () => ({ data: [], isPending: false }),
  useKampagneSpeichern: () => mutation(m.speichern),
  useKampagneStatus: () => mutation(m.status),
  useKampagneLoeschen: () => mutation(vi.fn()),
  useEmpfaengerHinzufuegen: () => mutation(vi.fn()),
  useEmpfaengerEntfernen: () => mutation(vi.fn()),
  useAntwortSenden: () => mutation(m.senden),
  useEingangMarkieren: () => mutation(m.markieren),
  usePostfachSpeichern: () => mutation(vi.fn()),
  usePostfachTesten: () => mutation(vi.fn()),
  usePostfachAendern: () => mutation(vi.fn()),
  usePostfachLoeschen: () => mutation(vi.fn()),
  useTestmail: () => mutation(vi.fn()),
  useDomainSpeichern: () => mutation(vi.fn()),
  useDomainLoeschen: () => mutation(vi.fn()),
  usePlatzierungStarten: () => mutation(vi.fn()),
  useSperrdomainSetzen: () => mutation(vi.fn()),
  abmelden: m.abmelden,
}))

import { Component as Abmelden } from './Abmelden'
import { Component as AntwortenSeite } from './AntwortenSeite'
import { Component as KampagneSeite } from './KampagneSeite'
import { Component as PostfaecherSeite } from './PostfaecherSeite'

function zeigen(pfad: string, route: string, Seite: () => React.JSX.Element) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[pfad]}>
          <Routes>
            <Route path={route} element={<Seite />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  for (const f of Object.values(m)) f.mockClear()
})

describe('Kampagne', () => {
  it('Übersicht: Checkliste vor dem Start, Starten ruft den Status auf', () => {
    zeigen(`/email/kampagnen/${K}`, '/email/kampagnen/:id', KampagneSeite)
    expect(screen.getByRole('heading', { name: 'Nachfassen nach Telefonat' })).toBeInTheDocument()
    expect(screen.getByText(/Startklar: vincent@versand-beispiel\.test \(Schonung, heute 10\)/)).toBeInTheDocument()
    expect(screen.getByText('1 von 2 offenen Empfängern dürfen angeschrieben werden')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Starten' }))
    expect(m.status).toHaveBeenCalledWith({ id: K, status: 'aktiv' }, expect.anything())
  })

  it('Ablauf: Vorschau mit echtem Empfänger, Signatur und Abmelde-Satz; Link in der ersten Mail wird angemahnt; Speichern schickt alle Mails', () => {
    zeigen(`/email/kampagnen/${K}?tab=ablauf`, '/email/kampagnen/:id', KampagneSeite)
    const vorschau = screen.getAllByLabelText('Vorschau')[0]!
    expect(within(vorschau).getByText('Unterlagen zu Feldhaus Solar GmbH')).toBeInTheDocument()
    expect(vorschau.textContent).toContain('Guten Tag Lukas Feldhaus')
    expect(vorschau.textContent).toContain('Vincent Testnutzer')
    expect(vorschau.textContent).toContain('genügt eine kurze Antwort')
    expect(vorschau.textContent).toContain('Hinweise zum Datenschutz')
    // Folgemail: Betreff „Re: …“ im selben Verlauf, ohne Datenschutz-Hinweis
    const zweite = screen.getAllByLabelText('Vorschau')[1]!
    expect(zweite.textContent).toContain('Re: Unterlagen zu Feldhaus Solar GmbH')
    expect(zweite.textContent).not.toContain('Hinweise zum Datenschutz')
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Varianten von Mail 1' })).getByRole('button', { name: 'B' }),
    )
    expect(screen.getByText(/Link in der ersten Mail/)).toBeInTheDocument()
    fireEvent.change(screen.getAllByLabelText('Betreff')[0]!, { target: { value: 'Neuer Betreff' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ablauf speichern' }))
    const arg = m.speichern.mock.calls[0]![0] as { schritte: { varianten: { kennung: string; betreff: string }[] }[] }
    expect(arg.schritte).toHaveLength(2)
    expect(arg.schritte[0]!.varianten.find((v) => v.kennung === 'B')!.betreff).toBe('Neuer Betreff')
  })

  it('Empfänger: Grund fürs Überspringen steht in der Zeile', () => {
    zeigen(`/email/kampagnen/${K}?tab=empfaenger`, '/email/kampagnen/:id', KampagneSeite)
    expect(screen.getByText('Wird übersprungen: Keine Erlaubnis-Grundlage')).toBeInTheDocument()
    expect(screen.getByText(/1 × Keine Erlaubnis-Grundlage/)).toBeInTheDocument()
  })
})

describe('Antworten (Unibox)', () => {
  it('Liste mit Hinweisen, erste Antwort offen, Antworten sendet über die Datenbank, Abmeldung ohne Antwortfeld', () => {
    zeigen('/email/antworten', '/email/antworten', AntwortenSeite)
    expect(screen.getByRole('list', { name: 'Antworten' })).toBeInTheDocument()
    expect(m.markieren).toHaveBeenCalledWith({ id: 'a1', werte: { gelesen_at: expect.any(String) } })
    fireEvent.change(screen.getByLabelText('Antwort'), { target: { value: 'Gern, Donnerstag 10 Uhr.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Antworten' }))
    expect(m.senden).toHaveBeenCalledWith({ eingang: 'a1', text: 'Gern, Donnerstag 10 Uhr.' }, expect.anything())
    fireEvent.click(screen.getByRole('button', { name: /Jana Kurz/ }))
    expect(screen.getByText(/Abmeldung erkannt/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Antwort')).toBeNull()
  })
})

describe('Postfächer', () => {
  it('Einrichtung mit Begründungen, Postfach mit Hochlauf-Stufe und Grund für die Schonung', () => {
    zeigen('/email/postfaecher', '/email/postfaecher', PostfaecherSeite)
    expect(screen.getByRole('heading', { name: /Einrichtung · \d von 5 erledigt/ })).toBeInTheDocument()
    expect(screen.getByText('Schonung')).toBeInTheDocument()
    expect(screen.getByText('Bounce-Quote 3,1 % (Ziel unter 2 %)')).toBeInTheDocument()
  })
})

describe('Abmelden (öffentlich)', () => {
  it('meldet erst nach dem Klick ab', async () => {
    window.location.hash = '#11111111-1111-4111-8111-111111111111'
    zeigen('/abmelden', '/abmelden', Abmelden)
    expect(m.abmelden).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Abmelden' })))
    expect(m.abmelden).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
    expect(screen.getByText('Sie sind abgemeldet.')).toBeInTheDocument()
    window.location.hash = ''
  })
})
