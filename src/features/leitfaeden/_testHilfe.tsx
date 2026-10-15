// Test-Hilfen M6: synthetische Vorlagen je Kanal (Keys nur aus lib/vorlagenKeys – § 3.0 Nr. 12), Render-Hülle mit
// QueryClient + Router + TooltipProvider, supabase-Antworten je Tabelle, matchMedia-Schalter für Desktop/Mobil.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { VORLAGE } from '@/lib/vorlagenKeys'
import { MEMBER_M, MEMBER_V, vollerLead } from '@/test/fixtures/leads'
import { SEQUENZEN } from '@/test/fixtures/sequenzen'
import { SETTINGS } from '@/test/fixtures/settings'
import { vorlage } from '@/test/fixtures/vorlagen'
import { supabaseMock, type Antwort } from '@/test/supabaseMock'
import type { Template, TemplatePerformance } from '@/types/domain'

let n = 0
/** Eindeutige IDs je Aufruf (die Fixture leitet die ID sonst aus den ersten 12 Key-Zeichen ab – Kollisionen). */
const t = (key: string, patch: Partial<Template>): Template => {
  n++
  return vorlage(key, {
    id: `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    sort_order: n,
    when_to_use: null,
    ...patch,
  })
}

/** Acht aktive Phase-2-Vorlagen in Seed-Reihenfolge (LF-08) + eine inaktive. */
export const BEDARF: Template[] = [
  t(VORLAGE.li_bedarf_ja_v1, {
    name: 'Ja (V1)',
    phase: 'bedarfsermittlung',
    body: 'Danke, [Anrede] [Nachname] – [Punkt 1]',
  }),
  t(VORLAGE.li_bedarf_ja_v2, { name: 'Ja (V2)', phase: 'bedarfsermittlung' }),
  t(VORLAGE.li_bedarf_nein_ohne_grund, { name: 'Nein (ohne Grund)', phase: 'bedarfsermittlung' }),
  t(VORLAGE.li_bedarf_nein_mit_grund, {
    name: 'Nein (mit Grund)',
    phase: 'bedarfsermittlung',
    body: 'Verstehe – [Grund]',
  }),
  t(VORLAGE.li_bedarf_hat_partner, { name: 'Hat Partner', phase: 'bedarfsermittlung' }),
  t(VORLAGE.li_bedarf_nein_falsches_problem, { name: 'Falsches Problem', phase: 'bedarfsermittlung' }),
  t(VORLAGE.li_bedarf_ja_v3, { name: 'Rückfrage (V3)', phase: 'bedarfsermittlung' }),
  t(VORLAGE.li_bedarf_vernetzt_ohne_antwort, { name: 'Vernetzt ohne Antwort', phase: 'bedarfsermittlung' }),
  t(`${VORLAGE.li_bedarf_ja_v1}_alt`, { name: 'Ja (alt)', phase: 'bedarfsermittlung', active: false }),
]

export const LINKEDIN: Template[] = [
  t(VORLAGE.li_eroeffnung_v1, {
    name: 'Gesprächseröffnung (V1)',
    phase: 'eroeffnung',
    body: 'Hallo [Vorname], [Unternehmen] in [Stadt]',
  }),
  t(VORLAGE.li_eroeffnung_v2, { name: 'Gesprächseröffnung (V2)', phase: 'eroeffnung', active: false, body: '' }),
  t(VORLAGE.li_eroeffnung_v3, { name: 'Gesprächseröffnung (V3)', phase: 'eroeffnung' }),
  ...BEDARF,
  t(VORLAGE.li_pitch_a, { name: 'Pitch A', phase: 'pitch', body: 'Passt [Tag/Uhrzeit 1] oder [Tag/Uhrzeit 2]?' }),
  t(VORLAGE.li_pitch_b, { name: 'Pitch B', phase: 'pitch' }),
  t(VORLAGE.li_fu_kurz_1, { name: 'Kurzfristig 1', phase: 'follow_up' }),
  t(VORLAGE.li_fu_lang_1, { name: 'Langfristig 1', phase: 'langfristig' }),
]

const TEL_PHASEN = [
  'gatekeeper',
  'einstieg',
  'problem',
  'qualifizierung',
  'pitch',
  'einwand',
  'abschluss',
  'mailbox',
  'rueckruf',
  'datenschutz',
] as const

/** Je Telefon-Phase eine Vorlage – absichtlich in verdrehter Reihenfolge angelegt (der Baum muss sortieren, LF-09). */
export const TELEFON: Template[] = [...TEL_PHASEN].reverse().map((phase, i) =>
  t(`${VORLAGE.tel_einstieg_1}_${phase}`, {
    name: `Skript ${phase}`,
    channel: 'telefon',
    phase,
    sort_order: 100 - i,
  }),
)

export const EMAIL: Template[] = [
  t(VORLAGE.em_erstgespraech_zusammenfassung, {
    name: 'Zusammenfassung Erstgespräch',
    channel: 'email',
    phase: 'zusammenfassung',
    subject: 'Unser Gespräch',
    body: 'Hallo [Vorname],\n[Signatur]',
  }),
  t(VORLAGE.em_strategiegespraech_zusammenfassung, {
    name: 'Zusammenfassung Strategiegespräch',
    channel: 'email',
    phase: 'zusammenfassung',
  }),
  t(VORLAGE.em_nachfassen_3_tage, { name: 'Nachfassen 3 Tage', channel: 'email', phase: 'nachfassen' }),
  t(VORLAGE.em_nachfassen_10_tage_mehrwert, { name: 'Nachfassen 10 Tage', channel: 'email', phase: 'nachfassen' }),
  t(VORLAGE.em_nachfassen_abhaken, { name: 'Abhaken', channel: 'email', phase: 'nachfassen' }),
  t(VORLAGE.em_langfristig, { name: 'Langfristig', channel: 'email', phase: 'nachfassen' }),
  t(VORLAGE.em_info_nach_linkedin_zusage, { name: 'Info nach LinkedIn', channel: 'email', phase: 'infomail' }),
  t(VORLAGE.em_info_nach_telefonat, { name: 'Info nach Telefonat', channel: 'email', phase: 'infomail' }),
  t(VORLAGE.em_terminbestaetigung_erstgespraech, {
    name: 'Terminbestätigung',
    channel: 'email',
    phase: 'transaktional',
  }),
  t(VORLAGE.em_noshow_erstgespraech, { name: 'No-Show Erstgespräch', channel: 'email', phase: 'transaktional' }),
]

export const ALLE: Template[] = [...LINKEDIN, ...TELEFON, ...EMAIL]

export const ERSTE_ID = LINKEDIN[0]?.id ?? ''
export const PITCH_A_ID = LINKEDIN.find((x) => x.key === VORLAGE.li_pitch_a)?.id ?? ''
export const JA_V1_ID = BEDARF[0]?.id ?? ''

/** Nutzung: Ja (V1) = 12 gesendet · 25 %; Pitch A = 4 · 50 % */
export const PERF: TemplatePerformance[] = [
  {
    template_id: JA_V1_ID,
    key: VORLAGE.li_bedarf_ja_v1,
    name: 'Ja (V1)',
    channel: 'linkedin',
    phase: 'bedarfsermittlung',
    active: true,
    gesendet: 12,
    beantwortet: 3,
    termine: 1,
    antwort_quote: 0.25,
    termin_quote: 0.0833,
    zuletzt_verwendet: '2026-10-14T09:00:00+02:00',
  },
  {
    template_id: PITCH_A_ID,
    key: VORLAGE.li_pitch_a,
    name: 'Pitch A',
    channel: 'linkedin',
    phase: 'pitch',
    active: true,
    gesendet: 4,
    beantwortet: 2,
    termine: 2,
    antwort_quote: 0.5,
    termin_quote: 0.5,
    zuletzt_verwendet: null,
  },
]

/** Sequenz „A“ nutzt Ja (V1) als Schritt 2 (Chip „Standard für Schritt 2“). */
export const SEQUENZEN_MIT_STANDARD = SEQUENZEN.map((s, i) =>
  i === 0 ? { ...s, steps: s.steps.map((st) => (st.position === 2 ? { ...st, template_id: JA_V1_ID } : st)) } : s,
)

export const LEAD = vollerLead(1, {
  first_name: 'Nora',
  last_name: 'Beispiel',
  company_name: 'Solar 01 GmbH',
  city: 'Hamburg',
  salutation: 'frau',
})

export type Antworten = Partial<Record<string, Antwort>>

/** supabase-Antworten je Tabelle; `extra` überschreibt einzelne Tabellen. */
export function supabaseAntworten(extra: Antworten = {}) {
  const antwortFuer = (tabelle: string): Antwort => {
    if (extra[tabelle]) return extra[tabelle]
    switch (tabelle) {
      case 'templates':
        return { data: ALLE, error: null }
      case 'v_template_performance':
        return { data: PERF, error: null }
      case 'sequences':
        return {
          data: SEQUENZEN_MIT_STANDARD.map(({ steps, ...s }) => ({ ...s, sequence_steps: steps })),
          error: null,
        }
      case 'leads':
        return {
          data: [
            {
              ...LEAD,
              companies: null,
              enrollments: [],
              tasks: [],
              meetings: [],
              linkedin_connections: [],
              lead_tags: [],
            },
          ],
          error: null,
        }
      case 'members':
        return {
          data: [
            {
              id: MEMBER_V,
              display_name: 'Vincent Steiner',
              short_name: 'Vincent',
              preferences: {},
              caller_number_e164: '+4940111',
              calendly_url: 'https://calendly.com/x',
              signature: 'Viele Grüße',
            },
            { id: MEMBER_M, display_name: 'Mike', short_name: 'Mike', preferences: {} },
          ],
          error: null,
        }
      case 'settings':
        return { data: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })), error: null }
      default:
        return { data: [], error: null, count: 0 }
    }
  }
  const m = supabaseMock(antwortFuer)
  const basis = m.supabase.from.getMockImplementation() as (t: string) => Record<string, unknown>
  // `.single()`/`.maybeSingle()` liefern die erste Zeile (useLead), Listenabfragen das Array (useLeadSuche, useTemplates)
  m.supabase.from.mockImplementation(((tabelle: string) => {
    const k = basis(tabelle)
    const a = antwortFuer(tabelle)
    if (Array.isArray(a.data)) {
      const einzel = { ...a, data: a.data[0] ?? null }
      k['single'] = vi.fn(async () => einzel)
      k['maybeSingle'] = vi.fn(async () => einzel)
    }
    return k
  }) as never)
  return m
}

/** matchMedia so stellen, dass `(min-width: 1024px)` = desktop. */
export function setzeDesktop(desktop: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('min-width: 1024px') ? desktop : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  })
}

export function rendern(ui: ReactElement, start = '/leitfaeden') {
  const router = createMemoryRouter(
    [
      { path: '/leitfaeden', element: ui },
      { path: '/leitfaeden/:id', element: ui },
      { path: '/einstellungen/:bereich', element: <p>EINSTELLUNGEN</p> },
      { path: '*', element: ui },
    ],
    { initialEntries: [start] },
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const r = render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { ...r, router, qc }
}
