// Test-Hilfen M5: supabase-Mock mit echten Filtern (eq/gte/lte/lt/in auf den Fixture-Zeilen, range, single) und synthetische
// Fixtures für Oktober 2026 (BAUPLAN § 1.5 Nr. 30, § 7.2 Referenzwerte).
// 25.11.2026: Die KPI-Seite ist archiviert – geblieben ist, was die Team-Tests und kennzahlen.test.ts brauchen.
import { vi } from 'vitest'
import { MEMBER_M, MEMBER_V } from '@/test/fixtures/leads'
import { kette, supabaseMock } from '@/test/supabaseMock'

type Zeile = Record<string, unknown>
export type Tabellen = Record<string, Zeile[]>

/** Kette, die Filter wirklich anwendet (eq, in, gte, lte, lt, gt) und `range`/`limit`/`single` respektiert. */
export function filterKette(zeilen: Zeile[]) {
  const k = kette({ data: zeilen, error: null })
  const filter: ((z: Zeile) => boolean)[] = []
  let von = 0
  let bis = Infinity
  const f = (fn: (z: Zeile) => boolean) => {
    filter.push(fn)
    return k
  }
  k['eq'] = vi.fn((feld: string, wert: unknown) => f((z) => z[feld] === wert))
  k['in'] = vi.fn((feld: string, werte: unknown[]) => f((z) => werte.includes(z[feld])))
  k['gte'] = vi.fn((feld: string, wert: string) => f((z) => String(z[feld] ?? '') >= wert))
  k['lte'] = vi.fn((feld: string, wert: string) => f((z) => String(z[feld] ?? '') <= wert))
  k['lt'] = vi.fn((feld: string, wert: string) => f((z) => String(z[feld] ?? '') < wert))
  k['gt'] = vi.fn((feld: string, wert: string) => f((z) => String(z[feld] ?? '') > wert))
  k['range'] = vi.fn((a: number, b: number) => {
    von = a
    bis = b
    return k
  })
  k['limit'] = vi.fn((n: number) => {
    bis = von + n - 1
    return k
  })
  const ergebnis = () => zeilen.filter((z) => filter.every((fn) => fn(z))).slice(von, bis + 1)
  k['then'] = (res: (a: { data: unknown; error: null }) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve({ data: ergebnis(), error: null }).then(res, rej)
  k['single'] = vi.fn(async () => ({ data: ergebnis()[0] ?? null, error: null }))
  k['maybeSingle'] = vi.fn(async () => ({ data: ergebnis()[0] ?? null, error: null }))
  return k
}

/** Tabellen, deren Abfragen mit einem PostgREST-Fehler antworten (Fehlerzustand). */
export const FEHLER = new Set<string>()

export function fehlerKette(meldung = 'kaputt') {
  const k = kette({ data: null, error: { message: meldung } })
  const antwort = { data: null, error: { message: meldung } }
  k['then'] = (res: (a: typeof antwort) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(antwort).then(res, rej)
  k['single'] = vi.fn(async () => antwort)
  k['maybeSingle'] = vi.fn(async () => antwort)
  return k
}

/**
 * Mock-Modul für `vi.mock('@/data/supabase', …)`. Hinweis: `@/data/supabase` im Test NICHT statisch importieren (die Seite lädt
 * dann nicht mehr – Modulreihenfolge mit dem asynchronen Factory); `await import('@/data/supabase')` nach dem Rendern geht.
 */
export function supabaseMitTabellen(tabellen: () => Tabellen) {
  const basis = supabaseMock()
  const from = vi.fn((tabelle: string) =>
    FEHLER.has(tabelle) ? fehlerKette() : filterKette(tabellen()[tabelle] ?? []),
  )
  return { ...basis, supabase: { ...basis.supabase, from, schema: vi.fn(() => ({ from })) } }
}

const ev = (member_id: string, day: string, metric: string, value: number, period: 'tag' | 'monat' = 'tag') => ({
  member_id,
  day,
  metric,
  value,
  source: 'zaehler',
  period,
})

/** v_metric_events Okt/Sept 2026 (Vincent) + Mike (§ 7.2 Referenzwerte, gekürzt). */
export const METRIC_EVENTS: Zeile[] = [
  // Vincent Oktober: Sheet-Monatswerte + Tageswerte Gespräche eröffnet (28/9/28/17 → 82)
  ev(MEMBER_V, '2026-10-01', 'vernetzungen_versendet', 305, 'monat'),
  ev(MEMBER_V, '2026-10-01', 'vernetzungen_angenommen', 93, 'monat'),
  ev(MEMBER_V, '2026-10-01', 'ausstehend', 212, 'monat'),
  ev(MEMBER_V, '2026-10-01', 'dm_beantwortet', 19, 'monat'),
  ev(MEMBER_V, '2026-10-01', 'gespraeche_eroeffnet', 28),
  ev(MEMBER_V, '2026-10-02', 'gespraeche_eroeffnet', 9),
  ev(MEMBER_V, '2026-10-03', 'gespraeche_eroeffnet', 28),
  ev(MEMBER_V, '2026-10-12', 'gespraeche_eroeffnet', 17),
  { ...ev(MEMBER_V, '2026-10-12', 'erstgespraeche', 1), source: 'ereignis' },
  { ...ev(MEMBER_V, '2026-10-05', 'erstgespraeche_vereinbart', 1), source: 'ereignis' },
  { ...ev(MEMBER_V, '2026-10-09', 'erstgespraeche_vereinbart', 1), source: 'ereignis' },
  // Vincent September (Vorperiode)
  ev(MEMBER_V, '2026-09-01', 'vernetzungen_versendet', 288, 'monat'),
  ev(MEMBER_V, '2026-09-01', 'vernetzungen_angenommen', 55, 'monat'),
  ev(MEMBER_V, '2026-09-01', 'gespraeche_eroeffnet', 51, 'monat'),
  ev(MEMBER_V, '2026-09-01', 'dm_beantwortet', 10, 'monat'),
  ev(MEMBER_V, '2026-09-01', 'erstgespraech_gepitcht', 1, 'monat'),
  ev(MEMBER_V, '2026-09-01', 'erstgespraeche', 1, 'monat'),
  // Mike Oktober (Ereignisse)
  { ...ev(MEMBER_M, '2026-10-06', 'gespraeche_eroeffnet', 4), source: 'ereignis' },
  { ...ev(MEMBER_M, '2026-10-06', 'anrufe', 12), source: 'ereignis' },
  { ...ev(MEMBER_M, '2026-10-06', 'anrufe_erreicht', 4), source: 'ereignis' },
  { ...ev(MEMBER_M, '2026-10-06', 'entscheider_gespraeche', 2), source: 'ereignis' },
  { ...ev(MEMBER_M, '2026-10-06', 'termine_telefon', 1), source: 'ereignis' },
]

const funnel = (member_id: string, month_key: string, w: Zeile): Zeile => ({
  member_id,
  month: `${month_key}-01`,
  month_key,
  vernetzungen_versendet: 0,
  vernetzungen_angenommen: 0,
  ausstehend: 0,
  gespraeche_eroeffnet: 0,
  dm_beantwortet: 0,
  erstgespraech_gepitcht: 0,
  erstgespraeche_vereinbart: 0,
  erstgespraeche: 0,
  strategiegespraeche: 0,
  kunden_gewonnen: 0,
  erstgespraech_no_show: 0,
  erstgespraech_abgesagt: 0,
  strategiegespraech_no_show: 0,
  strategiegespraech_abgesagt: 0,
  anrufe: 0,
  anrufe_erreicht: 0,
  entscheider_gespraeche: 0,
  termine_telefon: 0,
  emails_gesendet: 0,
  annahme_quote: null,
  antwort_quote: null,
  pitch_quote: null,
  erstgespraech_quote: null,
  strategiegespraech_quote: null,
  kunden_quote: null,
  connect_rate: null,
  entscheider_quote: null,
  termine_pro_100_anrufe: null,
  ...w,
})

export const FUNNEL_MONATLICH: Zeile[] = [
  funnel(MEMBER_V, '2026-10', {
    vernetzungen_versendet: 305,
    vernetzungen_angenommen: 93,
    ausstehend: 212,
    gespraeche_eroeffnet: 82,
    dm_beantwortet: 19,
    erstgespraeche_vereinbart: 2,
    erstgespraeche: 1,
    annahme_quote: 0.3049,
    antwort_quote: 0.2317,
    pitch_quote: 0,
  }),
  funnel(MEMBER_V, '2026-09', {
    vernetzungen_versendet: 288,
    vernetzungen_angenommen: 55,
    gespraeche_eroeffnet: 51,
    dm_beantwortet: 10,
    erstgespraech_gepitcht: 1,
    erstgespraeche: 1,
    annahme_quote: 0.191,
    antwort_quote: 0.1961,
    pitch_quote: 0.1,
    erstgespraech_quote: 1,
  }),
  funnel(MEMBER_M, '2026-10', {
    gespraeche_eroeffnet: 4,
    anrufe: 12,
    anrufe_erreicht: 4,
    entscheider_gespraeche: 2,
    termine_telefon: 1,
    connect_rate: 0.3333,
    entscheider_quote: 0.1667,
    termine_pro_100_anrufe: 8.33,
  }),
]

const tagZeile = (member_id: string, day: string, w: Zeile): Zeile => ({
  member_id,
  day,
  week_start: day,
  month_key: day.slice(0, 7),
  vernetzungen_versendet: 0,
  vernetzungen_angenommen: 0,
  gespraeche_eroeffnet: 0,
  dm_beantwortet: 0,
  erstgespraech_gepitcht: 0,
  erstgespraeche: 0,
  strategiegespraeche: 0,
  anrufe: 0,
  anrufe_erreicht: 0,
  entscheider_gespraeche: 0,
  termine_telefon: 0,
  emails_gesendet: 0,
  ...w,
})

/** v_daily_activity Oktober 2026: 01.10. 28 · 02.10. 9 · 03.10. 28 · 12.10. 17 (Vincent), Mike 06.10. */
export const DAILY: Zeile[] = [
  tagZeile(MEMBER_V, '2026-10-01', { gespraeche_eroeffnet: 28, vernetzungen_versendet: 40 }),
  tagZeile(MEMBER_V, '2026-10-02', { gespraeche_eroeffnet: 9 }),
  tagZeile(MEMBER_V, '2026-10-03', { gespraeche_eroeffnet: 28 }),
  tagZeile(MEMBER_V, '2026-10-12', { gespraeche_eroeffnet: 17, dm_beantwortet: 3 }),
  tagZeile(MEMBER_M, '2026-10-06', { gespraeche_eroeffnet: 4, anrufe: 12, anrufe_erreicht: 4 }),
]
