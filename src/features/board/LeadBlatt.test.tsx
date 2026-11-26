// Lead-Blatt (25.11.2026) mit gemockten Daten-Hooks: Felder, Speichern (nur Geändertes), alte Leads ohne Liste, „Karte entfernen“
// mit Rückgängig, E-Mail-Bereich (Adresse, Erlaubnis, Widerspruch, Einzelmail), Rückfrage vor dem Verwerfen ungespeicherter
// Änderungen (auch über die Zurück-Taste), ruhiger Kopf ohne Tastenhinweis. Nur erfundene Namen.
// Das Blatt hält Navigationen über `useBlocker` an – das braucht einen Data-Router (createMemoryRouter), kein MemoryRouter.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BLATT_IM_VERLAUF } from '@/features/board/verlauf'
import { MEMBER_M, MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import type { Lead } from '@/types/domain'

const SEIT = '2026-11-25T09:00:00+00:00'

const m = vi.hoisted(() => ({
  lead: null as unknown,
  fehler: false,
  /** Fehler der Datenbank beim Laden (`error` von useLead), z. B. `{ code: 'PGRST116' }`. */
  fehlerCode: null as string | null,
  /** Ist der Lead seit dem Öffnen des Blatts neu geladen? (`isFetchedAfterMount`) */
  frisch: true,
  /** Was das Blatt von `useLead` verlangt. */
  option: undefined as unknown,
  refetch: vi.fn(),
  /** Zeichnet das Blatt neu, nachdem ein Test `lead`/`fehler`/`frisch` umgestellt hat (wie ein Neuladen im Hintergrund). */
  neu: null as null | (() => void),
  speichern: vi.fn(),
  verschieben: vi.fn(),
  toast: vi.fn(),
  toastUndo: vi.fn(),
}))

vi.mock('@/data', async () => {
  const { useReducer } = await import('react')
  return {
    // wie TanStack: nach einem gescheiterten Neuladen bleibt der zuletzt geladene Lead stehen (`data` und `isError` zugleich)
    useLead: (_id: string, option?: unknown) => {
      const [, neu] = useReducer((n: number) => n + 1, 0)
      m.neu = neu
      m.option = option
      return {
        data: m.lead ?? undefined,
        isError: m.fehler,
        error: m.fehler && m.fehlerCode ? { code: m.fehlerCode } : m.fehler ? new Error('Netz') : null,
        isFetchedAfterMount: m.frisch,
        refetch: m.refetch,
      }
    },
    useMembers: () => ({
      data: [
        { id: '00000000-0000-4000-8000-000000000002', display_name: 'Mike', email: 'mike@beispiel.test' },
        { id: '00000000-0000-4000-8000-000000000001', display_name: 'Vincent', email: 'vincent@beispiel.test' },
      ],
    }),
  }
})
vi.mock('@/data/board', () => ({
  useKarteSpeichern: () => ({ mutate: m.speichern, isPending: false }),
  useKarteVerschieben: () => ({ mutateAsync: m.verschieben }),
}))
// Der E-Mail-Bereich selbst ist nicht Teil des Boards – hier zählt nur, dass das Blatt ihn mit dem richtigen Lead einbindet
vi.mock('@/features/email/public', () => ({
  ErlaubnisBadge: ({ lead }: { lead: Lead }) => <span data-testid="erlaubnis">{lead.email_consent_basis}</span>,
  ErlaubnisErfassen: ({ leadId, trigger }: { leadId: string; trigger: ReactNode }) => (
    <span data-testid="erfassen" data-lead={leadId}>
      {trigger}
    </span>
  ),
}))
// Ebenso der Widerspruch-Dialog (components/aktionen): das Blatt reicht nur Lead und Auslöser hinein
vi.mock('@/components/aktionen/WiderspruchErfassen', () => ({
  WiderspruchErfassen: ({
    leadId,
    trigger,
    umfang,
    schlicht,
  }: {
    leadId: string
    trigger: ReactNode
    umfang?: string
    schlicht?: boolean
  }) => (
    <span
      data-testid="widerspruch"
      data-lead={leadId}
      data-umfang={umfang ?? 'alle'}
      data-schlicht={schlicht ? 'ja' : 'nein'}
    >
      {trigger}
    </span>
  ),
}))
vi.mock('@/components/toast', () => ({ toast: m.toast, toastUndo: m.toastUndo, toastFehler: vi.fn() }))

import { LeadBlatt } from './LeadBlatt'

function lead(patch: Partial<Lead> = {}): Lead {
  return vollerLead(1, {
    first_name: 'Petra',
    last_name: 'Probelauf',
    full_name: 'Petra Probelauf',
    salutation: 'frau',
    company_id: null,
    company_name: null,
    linkedin_url: 'https://www.linkedin.com/in/petra-probelauf/',
    owner_id: MEMBER_V,
    notes: null,
    email: null,
    board_liste: 'angeschrieben',
    board_seit: SEIT,
    ...patch,
  })
}

function Ort() {
  const { pathname, search } = useLocation()
  return <output data-testid="ort">{pathname + search}</output>
}

type Eintrag = string | { pathname: string; search?: string; state?: unknown }

/** Rendert das Blatt in einem Data-Router. Ohne `eintraege` steht nur `<pfad>?lead=<id>` im Verlauf. */
function rendern(leadId: string, eintraege: Eintrag[]) {
  const onClose = vi.fn()
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <LeadBlatt leadId={leadId} onClose={onClose} />
            <Ort />
          </>
        ),
      },
    ],
    { initialEntries: eintraege, initialIndex: eintraege.length - 1 },
  )
  render(<RouterProvider router={router} />)
  return { onClose, router }
}

function zeigen(l: Lead, pfad = '/leads', eintraege?: Eintrag[]) {
  m.lead = l
  const r = rendern(l.id, eintraege ?? [`${pfad}?lead=${l.id}`])
  return { ...r, blatt: within(screen.getByRole('dialog')) }
}

/** Stellt den Stand von `useLead` um und zeichnet neu – so sieht das Blatt ein Neuladen im Hintergrund. */
const neuladen = (stand: { lead?: Lead; fehler?: boolean; frisch?: boolean }) =>
  act(() => {
    if (stand.lead !== undefined) m.lead = stand.lead
    if (stand.fehler !== undefined) m.fehler = stand.fehler
    if (stand.frisch !== undefined) m.frisch = stand.frisch
    m.neu?.()
  })

const frage = () => screen.findByRole('dialog', { name: 'Änderungen verwerfen?' })
const keineFrage = () => expect(screen.queryByRole('dialog', { name: 'Änderungen verwerfen?' })).toBeNull()

const gewaehlt = (gruppe: HTMLElement) =>
  within(gruppe)
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent)

beforeEach(() => {
  m.fehler = false
  m.fehlerCode = null
  m.frisch = true
  m.refetch.mockClear()
  m.speichern.mockReset().mockImplementation((_v: unknown, o?: { onSuccess?: () => void }) => o?.onSuccess?.())
  m.verschieben.mockReset().mockResolvedValue(null)
  m.toast.mockClear()
  m.toastUndo.mockClear()
})

describe('Lead-Blatt', () => {
  it('zeigt die Felder des Leads: Name, Anrede, Firma, Link, Zugehörigkeit, Liste, Notiz', () => {
    const { blatt } = zeigen(lead({ company_name: 'Muster Solar GmbH', notes: 'Ruft Dienstag zurück' }))
    expect(screen.getByRole('dialog', { name: 'Petra Probelauf' })).toBeInTheDocument()
    expect(blatt.getByLabelText('Vorname')).toHaveValue('Petra')
    expect(blatt.getByLabelText('Nachname')).toHaveValue('Probelauf')
    expect(blatt.getByLabelText('Firma')).toHaveValue('Muster Solar GmbH')
    expect(blatt.getByLabelText('Firma')).toBeEnabled()
    expect(blatt.getByLabelText('LinkedIn-Link')).toHaveValue('https://www.linkedin.com/in/petra-probelauf/')
    expect(blatt.getByLabelText('Notiz')).toHaveValue('Ruft Dienstag zurück')
    expect(gewaehlt(blatt.getByRole('group', { name: 'Anrede' }))).toEqual(['Frau'])
    expect(
      within(blatt.getByRole('group', { name: 'Zugehörigkeit' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Vincent', 'Mike'])
    expect(gewaehlt(blatt.getByRole('group', { name: 'Zugehörigkeit' }))).toEqual(['Vincent'])
    expect(
      within(blatt.getByRole('group', { name: 'Liste' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Angeschrieben', 'Gespräch vereinbart', 'Im Geschäft', 'Verloren'])
    expect(gewaehlt(blatt.getByRole('group', { name: 'Liste' }))).toEqual(['Angeschrieben'])
  })

  it('Speichern schickt nur die geänderten Felder, meldet „Gespeichert.“ und schließt', () => {
    const l = lead()
    const { blatt, onClose } = zeigen(l)
    fireEvent.change(blatt.getByLabelText('Nachname'), { target: { value: 'Probelauf-Muster' } })
    fireEvent.change(blatt.getByLabelText('Firma'), { target: { value: 'Muster Solar GmbH' } })
    fireEvent.change(blatt.getByLabelText('Notiz'), { target: { value: 'Ruft Dienstag zurück' } })
    fireEvent.click(within(blatt.getByRole('group', { name: 'Anrede' })).getByRole('button', { name: 'Herr' }))
    fireEvent.click(within(blatt.getByRole('group', { name: 'Zugehörigkeit' })).getByRole('button', { name: 'Mike' }))
    fireEvent.click(
      within(blatt.getByRole('group', { name: 'Liste' })).getByRole('button', { name: 'Gespräch vereinbart' }),
    )
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(m.speichern).toHaveBeenCalledTimes(1)
    expect(m.speichern.mock.calls[0]![0]).toEqual({
      id: l.id,
      patch: {
        last_name: 'Probelauf-Muster',
        company_name: 'Muster Solar GmbH',
        notes: 'Ruft Dienstag zurück',
        salutation: 'herr',
        owner_id: MEMBER_M,
        board_liste: 'gespraech',
      },
    })
    expect(m.toast).toHaveBeenCalledWith('Gespeichert.')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Speichern ohne Änderung schließt nur; Abbrechen ohne Änderung schließt sofort und speichert nichts', () => {
    const { blatt, onClose } = zeigen(lead())
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(m.speichern).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(blatt.getByRole('button', { name: 'Abbrechen' }))
    keineFrage()
    expect(m.speichern).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('schlägt das Speichern fehl, bleibt das Blatt mit den Eingaben offen', () => {
    m.speichern.mockImplementation(() => {})
    const { blatt, onClose } = zeigen(lead())
    fireEvent.change(blatt.getByLabelText('Nachname'), { target: { value: 'Anders' } })
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(m.speichern).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(blatt.getByLabelText('Nachname')).toHaveValue('Anders')
  })

  it('ein neuer Link, der kein Profil-Link ist, wird nicht gespeichert', () => {
    const { blatt, onClose } = zeigen(lead())
    fireEvent.change(blatt.getByLabelText('LinkedIn-Link'), {
      target: { value: 'https://www.linkedin.com/company/muster-solar' },
    })
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(blatt.getByRole('alert')).toHaveTextContent('Das ist kein LinkedIn-Profil-Link')
    expect(blatt.getByLabelText('LinkedIn-Link')).toHaveAttribute('aria-invalid', 'true')
    expect(m.speichern).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  // 26.11.2026: Mit offener „Kontaktinfo“ auf LinkedIn hängt /overlay/contact-info/ am Profil-Link – der wurde abgelehnt
  it.each([
    'https://www.linkedin.com/in/max-muster-demo/overlay/contact-info/',
    'https://www.linkedin.com/in/max-muster-demo/detail/contact-info/',
    'https://www.linkedin.com/in/max-muster-demo/recent-activity/all/',
    'linkedin.com/mwlite/in/max-muster-demo',
  ])('ein Profil-Link mit Anhang (%s) wird als sauberer Profil-Link gespeichert', (link) => {
    const l = lead()
    const { blatt, onClose } = zeigen(l)
    fireEvent.change(blatt.getByLabelText('LinkedIn-Link'), { target: { value: link } })
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(blatt.queryByRole('alert')).toBeNull()
    expect(m.speichern).toHaveBeenCalledTimes(1)
    expect(m.speichern.mock.calls[0]![0]).toEqual({
      id: l.id,
      patch: { linkedin_url: 'https://www.linkedin.com/in/max-muster-demo' },
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Anrede: noch einmal auf die gewählte tippen nimmt sie zurück (neutral)', () => {
    const l = lead()
    const { blatt } = zeigen(l)
    fireEvent.click(within(blatt.getByRole('group', { name: 'Anrede' })).getByRole('button', { name: 'Frau' }))
    expect(gewaehlt(blatt.getByRole('group', { name: 'Anrede' }))).toEqual([])
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(m.speichern.mock.calls[0]![0]).toEqual({ id: l.id, patch: { salutation: 'neutral' } })
  })

  it('alter Lead ohne Liste: bei „Liste“ ist nichts gewählt, kein „Karte entfernen“; eine Liste wählen legt ihn aufs Board', () => {
    const l = lead({ board_liste: null, board_seit: null })
    const { blatt } = zeigen(l, '/email')
    expect(gewaehlt(blatt.getByRole('group', { name: 'Liste' }))).toEqual([])
    expect(blatt.queryByRole('button', { name: 'Karte entfernen' })).toBeNull()
    fireEvent.click(within(blatt.getByRole('group', { name: 'Liste' })).getByRole('button', { name: 'Im Geschäft' }))
    fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
    expect(m.speichern.mock.calls[0]![0]).toEqual({ id: l.id, patch: { board_liste: 'im_geschaeft' } })
  })

  it('Firma eines alten Leads mit verknüpftem Unternehmen ist nur Anzeige (die Datenbank schreibt sie selbst)', () => {
    const { blatt } = zeigen(lead({ company_id: 'firma-1', company_name: 'Muster Solar GmbH' }))
    expect(blatt.getByLabelText('Firma')).toHaveValue('Muster Solar GmbH')
    expect(blatt.getByLabelText('Firma')).toBeDisabled()
  })

  it('„Karte entfernen“ nimmt die Karte vom Board (nichts wird gelöscht); Rückgängig legt sie mit board_seit zurück', async () => {
    const l = lead({ board_liste: 'gespraech' })
    const { blatt, onClose } = zeigen(l)
    fireEvent.click(blatt.getByRole('button', { name: 'Karte entfernen' }))
    expect(m.verschieben).toHaveBeenCalledWith({ id: l.id, liste: null })
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(m.toastUndo).toHaveBeenCalledTimes(1))
    const [text, zurueck] = m.toastUndo.mock.calls[0] as [string, () => Promise<void>]
    expect(text).toBe('Karte entfernt.')
    await act(async () => {
      await zurueck()
    })
    expect(m.verschieben).toHaveBeenLastCalledWith({ id: l.id, liste: 'gespraech', seit: SEIT })
  })

  it('E-Mail-Bereich: Adresse oder „–“, Erlaubnis des Leads, „Erlaubnis erfassen“ und „E-Mail schreiben“ mit Rücksprung', () => {
    const l = lead({ email: 'petra@beispiel-solar.test', email_consent_basis: 'requested_linkedin' })
    const { blatt } = zeigen(l)
    const bereich = within(blatt.getByRole('region', { name: 'E-Mail' }))
    expect(bereich.getByText('petra@beispiel-solar.test')).toBeInTheDocument()
    expect(bereich.getByTestId('erlaubnis')).toHaveTextContent('requested_linkedin')
    expect(bereich.getByTestId('erfassen')).toHaveAttribute('data-lead', l.id)
    expect(bereich.getByRole('button', { name: 'Erlaubnis erfassen' })).toBeInTheDocument()
    const ziel = new URL(
      bereich.getByRole('link', { name: 'E-Mail schreiben' }).getAttribute('href')!,
      'https://x.test',
    )
    expect(ziel.pathname).toBe('/email/verfassen')
    expect(ziel.searchParams.get('lead')).toBe(l.id)
    expect(ziel.searchParams.get('zurueck')).toBe(`/leads?lead=${l.id}`)
    // ohne Änderungen ist „E-Mail schreiben“ ein gewöhnlicher Link: der Klick führt ohne Rückfrage in den Composer
    fireEvent.click(bereich.getByRole('link', { name: 'E-Mail schreiben' }))
    keineFrage()
    expect(screen.getByTestId('ort')).toHaveTextContent('/email/verfassen?lead=')
  })

  it('E-Mail-Bereich: leise „Widerspruch erfassen“ für alle Kanäle – darauf verweist E-Mail › Antworten', () => {
    const l = lead()
    const { blatt } = zeigen(l)
    const bereich = within(blatt.getByRole('region', { name: 'E-Mail' }))
    const huelle = bereich.getByTestId('widerspruch')
    expect(huelle).toHaveAttribute('data-lead', l.id)
    expect(huelle).toHaveAttribute('data-umfang', 'alle')
    const knopf = within(huelle).getByRole('button', { name: 'Widerspruch erfassen' })
    expect(knopf).toBeEnabled()
    // leise (keine Füllung, kein Rahmen), aber mit großer Fläche
    expect(knopf).toHaveClass('h-11', 'text-ink-2', 'border-transparent')
  })

  it('hat die Person schon widersprochen, ist „Widerspruch erfassen“ nicht mehr wählbar', () => {
    const { blatt } = zeigen(lead({ do_not_contact: true }))
    expect(blatt.getByRole('button', { name: 'Widerspruch erfassen' })).toBeDisabled()
  })

  it('ohne Adresse steht „–“', () => {
    const { blatt } = zeigen(lead())
    expect(within(blatt.getByRole('region', { name: 'E-Mail' })).getByText('–')).toBeInTheDocument()
  })

  // Fund 37: iOS zoomt beim Antippen in Felder unter 16 px
  it('Felder und Notiz sind am Telefon 16 px groß', () => {
    const { blatt } = zeigen(lead())
    for (const name of ['Vorname', 'Nachname', 'Firma', 'LinkedIn-Link', 'Notiz'])
      expect(blatt.getByLabelText(name)).toHaveClass('text-[15px]', 'max-md:text-[16px]')
  })

  it('Kopf: kein Tastenhinweis, Schließen als × mit 44-px-Fläche', () => {
    const { blatt, onClose } = zeigen(lead())
    expect(screen.getByRole('dialog').querySelector('kbd')).toBeNull()
    const zu = blatt.getByRole('button', { name: 'Schließen' })
    expect(zu).toHaveClass('size-11')
    expect(zu).not.toHaveTextContent('Esc')
    fireEvent.click(zu)
    keineFrage()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('ungespeicherte Änderungen', () => {
    const aendern = (blatt: ReturnType<typeof zeigen>['blatt']) =>
      fireEvent.change(blatt.getByLabelText('Notiz'), { target: { value: 'Ruft Dienstag zurück' } })

    it('ohne Änderung schließt Esc sofort', () => {
      const { blatt, onClose } = zeigen(lead())
      fireEvent.keyDown(blatt.getByLabelText('Notiz'), { key: 'Escape' })
      keineFrage()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('Leerzeichen am Rand sind keine Änderung', () => {
      const { blatt, onClose } = zeigen(lead())
      fireEvent.change(blatt.getByLabelText('Nachname'), { target: { value: 'Probelauf ' } })
      fireEvent.click(blatt.getByRole('button', { name: 'Abbrechen' }))
      keineFrage()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('Esc in einem Feld fragt „Änderungen verwerfen?“ – „Weiter bearbeiten“ behält Eingabe und Cursor', async () => {
      const { blatt, onClose } = zeigen(lead())
      const notiz = blatt.getByLabelText('Notiz')
      notiz.focus()
      aendern(blatt)
      fireEvent.keyDown(notiz, { key: 'Escape' })
      const f = await frage()
      expect(onClose).not.toHaveBeenCalled()
      // Knöpfe der Rückfrage 44 px
      expect(within(f).getByRole('button', { name: 'Weiter bearbeiten' })).toHaveClass('h-11')
      expect(within(f).getByRole('button', { name: 'Verwerfen' })).toHaveClass('h-11')
      fireEvent.click(within(f).getByRole('button', { name: 'Weiter bearbeiten' }))
      await waitFor(() => keineFrage())
      expect(onClose).not.toHaveBeenCalled()
      expect(notiz).toHaveValue('Ruft Dienstag zurück')
      // der Fokus fällt nicht auf <body>, sondern zurück ins Feld
      await waitFor(() => expect(document.activeElement).toBe(notiz))
    })

    it('„Schließen“ (×) und „Abbrechen“ fragen ebenso; „Verwerfen“ schließt, gespeichert wird nichts', async () => {
      const { blatt, onClose } = zeigen(lead())
      aendern(blatt)
      fireEvent.click(blatt.getByRole('button', { name: 'Schließen' }))
      fireEvent.click(within(await frage()).getByRole('button', { name: 'Weiter bearbeiten' }))
      await waitFor(() => keineFrage())
      fireEvent.click(blatt.getByRole('button', { name: 'Abbrechen' }))
      fireEvent.click(within(await frage()).getByRole('button', { name: 'Verwerfen' }))
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(m.speichern).not.toHaveBeenCalled()
    })

    it('Klick neben das Blatt fragt ebenso', async () => {
      const { blatt, onClose } = zeigen(lead())
      aendern(blatt)
      // Radix hört erst einen Moment nach dem Öffnen auf Klicks außerhalb
      await act(async () => {
        await new Promise((fertig) => setTimeout(fertig, 10))
      })
      // die abgedunkelte Fläche neben dem Blatt: Radix schließt beim Klick (Zeiger runter + Klick), nicht schon beim Drücken
      const daneben = document.querySelector('.bg-scrim') as HTMLElement
      fireEvent.pointerDown(daneben, { pointerType: 'mouse', button: 0 })
      fireEvent.click(daneben, { button: 0 })
      expect(await frage()).toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('Esc in der Rückfrage schließt nur die Rückfrage – das Blatt bleibt mit der Eingabe offen', async () => {
      const { blatt, onClose } = zeigen(lead())
      aendern(blatt)
      fireEvent.click(blatt.getByRole('button', { name: 'Abbrechen' }))
      const f = await frage()
      fireEvent.keyDown(within(f).getByRole('button', { name: 'Weiter bearbeiten' }), { key: 'Escape' })
      await waitFor(() => keineFrage())
      expect(onClose).not.toHaveBeenCalled()
      expect(blatt.getByLabelText('Notiz')).toHaveValue('Ruft Dienstag zurück')
    })

    it('Speichern fragt nicht nach', () => {
      const { blatt, onClose } = zeigen(lead())
      aendern(blatt)
      fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
      keineFrage()
      expect(m.speichern).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('„Karte entfernen“ mit Änderungen: erst die Rückfrage, dann entfernen', async () => {
      const l = lead()
      const { blatt, onClose } = zeigen(l)
      aendern(blatt)
      fireEvent.click(blatt.getByRole('button', { name: 'Karte entfernen' }))
      const f = await frage()
      expect(m.verschieben).not.toHaveBeenCalled()
      fireEvent.click(within(f).getByRole('button', { name: 'Verwerfen' }))
      expect(m.verschieben).toHaveBeenCalledWith({ id: l.id, liste: null })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('„E-Mail schreiben“ mit Änderungen: erst die Rückfrage, dann der Composer', async () => {
      const l = lead()
      const { blatt } = zeigen(l)
      aendern(blatt)
      fireEvent.click(blatt.getByRole('link', { name: 'E-Mail schreiben' }))
      const f = await frage()
      expect(screen.getByTestId('ort')).toHaveTextContent(`/leads?lead=${l.id}`)
      fireEvent.click(within(f).getByRole('button', { name: 'Verwerfen' }))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/email/verfassen?lead='))
    })
  })

  it('Ladefehler: ein Satz und ein großer Knopf ohne Tastenhinweis statt des Formulars', () => {
    m.fehler = true
    m.lead = null
    rendern('x', ['/leads?lead=x'])
    const zeile = screen.getByRole('alert')
    expect(zeile).toHaveTextContent(/^Der Lead konnte nicht geladen werden\.Erneut versuchen$/)
    expect(zeile.querySelector('kbd')).toBeNull()
    expect(screen.queryByLabelText('Vorname')).toBeNull()
    const nochmal = within(zeile).getByRole('button', { name: 'Erneut versuchen' })
    expect(nochmal).toHaveClass('h-11')
    fireEvent.click(nochmal)
    expect(m.refetch).toHaveBeenCalledTimes(1)
  })

  // Fund 28: eine Adresse mit unbekanntem oder kaputtem ?lead= endete in „Erneut versuchen“, das nie helfen kann
  it.each([
    ['unbekannte ID', 'PGRST116'],
    ['keine gültige ID', '22P02'],
  ])('%s in der Adresse: ein ruhiger Satz statt „Erneut versuchen“, das Blatt lässt sich schließen', (_name, code) => {
    m.fehler = true
    m.fehlerCode = code
    m.lead = null
    const { onClose } = rendern('x', ['/leads?lead=x'])
    expect(screen.getByText('Diesen Lead gibt es nicht mehr.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByLabelText('Vorname')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // Fund 36: Nach dem Schließen fiel der Fokus auf <body> – jetzt zurück auf das Element, von dem aus geöffnet wurde
  describe('Fokus nach dem Schließen', () => {
    /** Ein Board-Ersatz neben dem Blatt: die Karte des Leads (wie Karte.tsx: li[data-karte] > h3 > button) und <main>. */
    function mitKarte(l: Lead, karteDa: boolean) {
      m.lead = l
      function Seite() {
        const { search } = useLocation()
        const offen = new URLSearchParams(search).has('lead')
        return (
          <>
            <main id="main" tabIndex={-1}>
              {karteDa ? (
                <ul>
                  <li data-karte={l.id}>
                    <h3>
                      <button type="button">Petra Probelauf</button>
                    </h3>
                  </li>
                </ul>
              ) : null}
            </main>
            {offen ? <LeadBlatt leadId={l.id} onClose={() => void router.navigate('/leads')} /> : null}
          </>
        )
      }
      const router = createMemoryRouter([{ path: '*', element: <Seite /> }], { initialEntries: ['/leads'] })
      render(<RouterProvider router={router} />)
      return router
    }

    it('von der Karte geöffnet: nach „Schließen“ liegt der Fokus wieder auf der Karte', async () => {
      const l = lead()
      const router = mitKarte(l, true)
      const karte = screen.getByRole('button', { name: 'Petra Probelauf' })
      karte.focus()
      await act(() => router.navigate(`/leads?lead=${l.id}`))
      fireEvent.click(await screen.findByRole('button', { name: 'Schließen' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await waitFor(() => expect(karte).toHaveFocus())
    })

    it('ohne Auslöser (Direktaufruf der Adresse): die Karte des Leads bekommt den Fokus', async () => {
      const l = lead()
      const router = mitKarte(l, true)
      await act(() => router.navigate(`/leads?lead=${l.id}`))
      fireEvent.click(await screen.findByRole('button', { name: 'Schließen' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Petra Probelauf' })).toHaveFocus())
    })

    it('liegt keine Karte (mehr) auf der Seite, geht der Fokus auf den Seiteninhalt – nicht auf <body>', async () => {
      const l = lead()
      const router = mitKarte(l, false)
      await act(() => router.navigate(`/leads?lead=${l.id}`))
      fireEvent.click(await screen.findByRole('button', { name: 'Schließen' }))
      await waitFor(() => expect(document.getElementById('main')).toHaveFocus())
    })
  })

  // 25.11.2026: Das Formular entstand aus dem Cache von vorhin – nach einem Zug stand die alte Liste da, und eine Notiz der
  // anderen Person wurde ungesehen überschrieben.
  describe('frischer Stand', () => {
    it('verlangt beim Öffnen immer ein Neuladen', () => {
      zeigen(lead())
      expect(m.option).toEqual({ frisch: true })
    })

    it('Lead aus dem Cache, aber noch nicht neu geladen: kein Formular – es entsteht erst aus dem neu geladenen Stand', () => {
      m.frisch = false
      const alt = lead({ notes: 'alter Stand' })
      const { blatt } = zeigen(alt)
      expect(blatt.queryByLabelText('Vorname')).toBeNull()
      expect(blatt.queryByRole('button', { name: 'Speichern' })).toBeNull()
      expect(screen.queryByRole('alert')).toBeNull()
      // inzwischen: Karte verschoben, die andere Person hat die Notiz geändert
      neuladen({ frisch: true, lead: { ...alt, board_liste: 'gespraech', notes: 'WICHTIG – ruft Dienstag zurück' } })
      expect(blatt.getByLabelText('Notiz')).toHaveValue('WICHTIG – ruft Dienstag zurück')
      expect(gewaehlt(blatt.getByRole('group', { name: 'Liste' }))).toEqual(['Gespräch vereinbart'])
    })

    it('scheitert das Neuladen beim Öffnen, steht die Fehlerzeile – kein Formular aus dem alten Stand', () => {
      m.fehler = true
      const { blatt } = zeigen(lead({ notes: 'alter Stand' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Der Lead konnte nicht geladen werden.')
      expect(blatt.queryByLabelText('Notiz')).toBeNull()
      // „Erneut versuchen“ hat geklappt
      neuladen({ fehler: false })
      expect(blatt.getByLabelText('Notiz')).toHaveValue('alter Stand')
    })

    it('scheitert ein späteres Neuladen im Hintergrund, bleibt das Formular mit den Eingaben stehen', async () => {
      const { blatt, onClose } = zeigen(lead())
      fireEvent.change(blatt.getByLabelText('Notiz'), { target: { value: 'Ruft Dienstag zurück' } })
      neuladen({ fehler: true })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(blatt.getByLabelText('Vorname')).toHaveValue('Petra')
      expect(blatt.getByLabelText('Notiz')).toHaveValue('Ruft Dienstag zurück')
      // die Eingabe gilt weiter als ungespeichert
      fireEvent.click(blatt.getByRole('button', { name: 'Abbrechen' }))
      expect(await frage()).toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('ein späteres Neuladen lässt begonnene Eingaben stehen', () => {
      const l = lead()
      const { blatt } = zeigen(l)
      fireEvent.change(blatt.getByLabelText('Notiz'), { target: { value: 'Ruft Dienstag zurück' } })
      neuladen({ lead: { ...l, email: 'petra@beispiel-solar.test' } })
      expect(blatt.getByLabelText('Notiz')).toHaveValue('Ruft Dienstag zurück')
      expect(blatt.getByText('petra@beispiel-solar.test')).toBeInTheDocument()
    })
  })

  // 25.11.2026: Die Karte legt einen Verlaufseintrag an, damit „Zurück“ das Blatt schließt – ohne Rückfrage gingen Eingaben verloren
  describe('Zurück-Taste des Browsers', () => {
    const mitVerlauf = (l: Lead): Eintrag[] => [
      '/leads',
      { pathname: '/leads', search: `?lead=${l.id}`, state: BLATT_IM_VERLAUF },
    ]
    const aendern = (blatt: ReturnType<typeof zeigen>['blatt']) =>
      fireEvent.change(blatt.getByLabelText('Notiz'), { target: { value: 'Ruft Dienstag zurück' } })

    it('ohne Änderung führt „Zurück“ sofort aufs Board', async () => {
      const l = lead()
      const { router } = zeigen(l, '/leads', mitVerlauf(l))
      await act(() => router.navigate(-1))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/))
      keineFrage()
    })

    it('mit Änderung hält „Zurück“ an und fragt; „Weiter bearbeiten“ behält Ort und Eingabe, „Verwerfen“ geht zurück', async () => {
      const l = lead()
      const { router, blatt, onClose } = zeigen(l, '/leads', mitVerlauf(l))
      aendern(blatt)
      await act(() => router.navigate(-1))
      fireEvent.click(within(await frage()).getByRole('button', { name: 'Weiter bearbeiten' }))
      await waitFor(() => keineFrage())
      expect(screen.getByTestId('ort')).toHaveTextContent(`/leads?lead=${l.id}`)
      expect(blatt.getByLabelText('Notiz')).toHaveValue('Ruft Dienstag zurück')

      await act(() => router.navigate(-1))
      const f = await frage()
      expect(screen.getByTestId('ort')).toHaveTextContent(`/leads?lead=${l.id}`)
      fireEvent.click(within(f).getByRole('button', { name: 'Verwerfen' }))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/))
      // der Router ist schon zurückgegangen – das Blatt schließt nicht ein zweites Mal
      expect(onClose).not.toHaveBeenCalled()
      expect(m.speichern).not.toHaveBeenCalled()
    })

    it('nach dem Speichern hält nichts mehr an: der Schritt zurück der Hülle geht durch', async () => {
      const l = lead()
      const { router, blatt, onClose } = zeigen(l, '/leads', mitVerlauf(l))
      aendern(blatt)
      fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
      expect(onClose).toHaveBeenCalledTimes(1)
      // LeadOutlet schließt mit navigate(-1)
      await act(() => router.navigate(-1))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/))
      keineFrage()
    })

    it('nach bestätigtem „Verwerfen“ (Abbrechen) geht der Schritt zurück der Hülle ebenfalls durch', async () => {
      const l = lead()
      const { router, blatt, onClose } = zeigen(l, '/leads', mitVerlauf(l))
      aendern(blatt)
      fireEvent.click(blatt.getByRole('button', { name: 'Abbrechen' }))
      fireEvent.click(within(await frage()).getByRole('button', { name: 'Verwerfen' }))
      expect(onClose).toHaveBeenCalledTimes(1)
      await act(() => router.navigate(-1))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/))
      await waitFor(() => keineFrage())
    })
  })

  // 25.11.2026: Der Composer kehrt per `replace` zurück – der Karten-Eintrag mit offenem Blatt blieb sonst im Verlauf liegen
  describe('„E-Mail schreiben“ und der Verlauf', () => {
    it('hat eine Karte das Blatt geöffnet, ersetzt der Composer diesen Eintrag – ein Schritt zurück führt aufs Board', async () => {
      const l = lead()
      const { router, blatt } = zeigen(l, '/leads', [
        '/leads',
        { pathname: '/leads', search: `?lead=${l.id}`, state: BLATT_IM_VERLAUF },
      ])
      fireEvent.click(blatt.getByRole('link', { name: 'E-Mail schreiben' }))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/email/verfassen?lead='))
      await act(() => router.navigate(-1))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/))
    })

    it('mit Änderungen und Rückfrage ebenso', async () => {
      const l = lead()
      const { router, blatt } = zeigen(l, '/leads', [
        '/leads',
        { pathname: '/leads', search: `?lead=${l.id}`, state: BLATT_IM_VERLAUF },
      ])
      fireEvent.change(blatt.getByLabelText('Notiz'), { target: { value: 'Ruft Dienstag zurück' } })
      fireEvent.click(blatt.getByRole('link', { name: 'E-Mail schreiben' }))
      fireEvent.click(within(await frage()).getByRole('button', { name: 'Verwerfen' }))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/email/verfassen?lead='))
      await act(() => router.navigate(-1))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/leads$/))
    })

    it('ohne Marke (E-Mail › Gesendet, Direktaufruf) bleibt es ein gewöhnlicher Link: zurück führt wieder ins Blatt', async () => {
      const l = lead()
      const { router, blatt } = zeigen(l, '/email', ['/email', `/email?lead=${l.id}`])
      fireEvent.click(blatt.getByRole('link', { name: 'E-Mail schreiben' }))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent('/email/verfassen?lead='))
      await act(() => router.navigate(-1))
      await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(`/email?lead=${l.id}`))
    })
  })

  // 25.11.2026: „Lead hinzufügen“ (crm.board_karte_anlegen) lehnt Personen mit Widerspruch ab – das Blatt ließ sie aufs Board
  describe('Widerspruch und „Liste“', () => {
    const listenKnoepfe = (blatt: ReturnType<typeof zeigen>['blatt']) =>
      within(blatt.getByRole('group', { name: 'Liste' })).getAllByRole('button')

    it('alter Lead mit Widerspruch, nicht auf dem Board: „Liste“ ist gesperrt, gespeichert wird keine Liste', () => {
      const l = lead({ do_not_contact: true, board_liste: null, board_seit: null })
      const { blatt, onClose } = zeigen(l, '/email')
      for (const knopf of listenKnoepfe(blatt)) expect(knopf).toBeDisabled()
      // Im Browser kommt ein Klick auf gesperrte Knöpfe gar nicht an; jsdom stellt ihn trotzdem zu – auch dann wird keine
      // Liste gespeichert. Die übrigen Felder bleiben speicherbar.
      fireEvent.click(listenKnoepfe(blatt)[0]!)
      fireEvent.change(blatt.getByLabelText('Notiz'), { target: { value: 'Hat widersprochen' } })
      fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
      expect(m.speichern.mock.calls[0]![0]).toEqual({ id: l.id, patch: { notes: 'Hat widersprochen' } })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('liegt die Karte schon auf dem Board, bleibt die Liste wählbar (verschieben und entfernen gehen weiter)', () => {
      const l = lead({ do_not_contact: true })
      const { blatt } = zeigen(l)
      for (const knopf of listenKnoepfe(blatt)) expect(knopf).toBeEnabled()
      expect(blatt.getByRole('button', { name: 'Karte entfernen' })).toBeEnabled()
      fireEvent.click(within(blatt.getByRole('group', { name: 'Liste' })).getByRole('button', { name: 'Verloren' }))
      fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
      expect(m.speichern.mock.calls[0]![0]).toEqual({ id: l.id, patch: { board_liste: 'verloren' } })
    })

    it('erst Liste gewählt, dann im offenen Blatt der Widerspruch erfasst: die Liste wird nicht gespeichert', () => {
      const l = lead({ board_liste: null, board_seit: null })
      const { blatt, onClose } = zeigen(l, '/email')
      fireEvent.click(
        within(blatt.getByRole('group', { name: 'Liste' })).getByRole('button', { name: 'Angeschrieben' }),
      )
      neuladen({ lead: { ...l, do_not_contact: true } })
      fireEvent.click(blatt.getByRole('button', { name: 'Speichern' }))
      expect(m.speichern).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('reicht dem Widerspruch-Dialog die schlichte Fassung durch (keine Tastenmarken, kurzer Text)', () => {
    const { blatt } = zeigen(lead())
    expect(blatt.getByTestId('widerspruch')).toHaveAttribute('data-schlicht', 'ja')
  })
})
