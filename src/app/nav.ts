// BAUPLAN § 3.1.5 – statische Navigation (DESIGN-SYSTEM § 4.1). Zähler aus useNavZaehler() (src/data/nav.ts).
// 23.10.2026 (Mike: „weniger Ablenkung, mehr Klarheit“): Gruppen statt 13 gleichrangiger Punkte – Telefon klappt Mikes
// Unterpunkte aus seinem Sales Hub auf (Anrufliste · Kontakte · Deal-Pipeline · Follow-ups · Sales-KPIs · Leitfäden),
// LinkedIn bündelt Auftrag · Pipeline · KPIs · Vorlagen, Verwaltung liegt unter „Mehr“. Für alle gleich (Vincent).
import {
  BarChart3,
  BookOpen,
  Columns3,
  Ellipsis,
  Euro,
  LifeBuoy,
  ListChecks,
  Mail,
  MessageSquareWarning,
  MessagesSquare,
  Phone,
  Settings,
  Sun,
  Upload,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export type NavZaehler = 'heute' | 'leads' | 'telefon' | 'email'

export type NavEintrag = {
  /** Pfad, optional mit Query (`/leitfaeden?kanal=telefon`) */
  pfad: string
  label: string
  /** Nur oberste Ebene und „Mehr“ (Icon-Rail); Unterpunkte von Telefon/LinkedIn stehen eingerückt ohne Icon */
  icon?: LucideIcon
  akkord?: string
  zaehler?: NavZaehler
  /** Aktiv nur, wenn der Query-Parameter einen dieser Werte hat (`null` = fehlt) – gleiche Seite, andere Ansicht */
  aktivBei?: { param: string; werte: readonly (string | null)[] }
}
export type NavGruppe = {
  gruppe: 'telefon' | 'linkedin' | 'mehr'
  label: string
  icon: LucideIcon
  /** Zähler am Gruppenkopf, solange die Gruppe zu ist */
  zaehler?: NavZaehler
  /** Aufgeklappt, bis die Person sie selbst zuklappt */
  offenStandard: boolean
  kinder: NavEintrag[]
}
export type NavKnoten = NavEintrag | NavGruppe | 'trenner'

export const istGruppe = (k: NavKnoten): k is NavGruppe => typeof k === 'object' && 'kinder' in k

export const NAV_BAUM: NavKnoten[] = [
  { pfad: '/heute', label: 'Heute', icon: Sun, akkord: 'G H', zaehler: 'heute' },
  { pfad: '/leads', label: 'Leads', icon: Users, akkord: 'G L', zaehler: 'leads' },
  {
    gruppe: 'telefon',
    label: 'Telefon',
    icon: Phone,
    zaehler: 'telefon',
    offenStandard: true,
    kinder: [
      { pfad: '/telefon', label: 'Anrufliste', akkord: 'G T', zaehler: 'telefon' },
      { pfad: '/telefon/kontakte', label: 'Kontakte' },
      { pfad: '/telefon/pipeline', label: 'Deal-Pipeline' },
      { pfad: '/telefon/follow-ups', label: 'Follow-ups' },
      { pfad: '/telefon/kpis', label: 'Sales-KPIs' },
      {
        pfad: '/leitfaeden?kanal=telefon',
        label: 'Leitfäden',
        akkord: 'G F',
        aktivBei: { param: 'kanal', werte: ['telefon', 'sonstiges'] },
      },
    ],
  },
  {
    gruppe: 'linkedin',
    label: 'LinkedIn',
    icon: MessagesSquare,
    offenStandard: true,
    kinder: [
      { pfad: '/auftrag', label: 'Auftrag', akkord: 'G U' },
      { pfad: '/pipeline', label: 'Pipeline', akkord: 'G P' },
      { pfad: '/kpis', label: 'KPIs', akkord: 'G K' },
      {
        pfad: '/leitfaeden?kanal=linkedin',
        label: 'Vorlagen',
        aktivBei: { param: 'kanal', werte: ['linkedin', 'email', null] },
      },
    ],
  },
  { pfad: '/email', label: 'E-Mail', icon: Mail, akkord: 'G M', zaehler: 'email' },
  { pfad: '/umsatz', label: 'Umsatz', icon: Euro },
  'trenner',
  {
    gruppe: 'mehr',
    label: 'Mehr',
    icon: Ellipsis,
    offenStandard: false,
    kinder: [
      { pfad: '/team', label: 'Team', icon: UsersRound, akkord: 'G A' },
      { pfad: '/import', label: 'Import', icon: Upload, akkord: 'G I' },
      { pfad: '/einstellungen', label: 'Einstellungen', icon: Settings, akkord: 'G E' },
      { pfad: '/hilfe', label: 'Hilfe', icon: LifeBuoy, akkord: 'G S' },
      { pfad: '/feedback', label: 'Feedback', icon: MessageSquareWarning, akkord: 'G B' },
    ],
  },
]

/** Alle Seiten in Menü-Reihenfolge (Palette „Seiten“, aktive Seite). */
export const NAV_SEITEN: NavEintrag[] = NAV_BAUM.flatMap((k) => (k === 'trenner' ? [] : istGruppe(k) ? k.kinder : [k]))

/**
 * Icon-Rail (768–1023 px): eine Ikone je Gruppe (führt zur ersten Seite, Unterseiten über die Leiste auf der Seite),
 * „Mehr“ aufgelöst unter dem Trenner.
 */
export const NAV: (NavEintrag | 'trenner')[] = NAV_BAUM.flatMap((k): (NavEintrag | 'trenner')[] => {
  if (k === 'trenner' || !istGruppe(k)) return [k]
  if (k.gruppe === 'mehr') return k.kinder
  const erste = k.kinder[0] as NavEintrag
  return [{ ...erste, label: k.label, icon: k.icon }]
})

function pfadTeile(pfad: string): { pathname: string; query: URLSearchParams } {
  const [pathname = pfad, q = ''] = pfad.split('?')
  return { pathname, query: new URLSearchParams(q) }
}

export const pfadOhneQuery = (pfad: string): string => pfadTeile(pfad).pathname

/**
 * Der eine aktive Menüpunkt zur aktuellen Adresse: längster passender Pfad (exakt oder Unterseite). Punkte mit `aktivBei`
 * gelten nur auf genau ihrer Seite und nur mit passendem Parameter (Leitfäden Telefon vs. LinkedIn-Vorlagen).
 */
export function aktiverEintrag(
  pathname: string,
  search: string,
  eintraege: readonly NavEintrag[] = NAV_SEITEN,
): NavEintrag | null {
  const params = new URLSearchParams(search)
  let best: NavEintrag | null = null
  let laenge = -1
  for (const e of eintraege) {
    const p = pfadOhneQuery(e.pfad)
    const exakt = pathname === p
    if (!exakt && !pathname.startsWith(`${p}/`)) continue
    if (e.aktivBei && (!exakt || !e.aktivBei.werte.includes(params.get(e.aktivBei.param)))) continue
    if (p.length > laenge) {
      best = e
      laenge = p.length
    }
  }
  return best
}

/** Gruppe, in der eine Seite liegt (für automatisches Aufklappen). */
export function gruppeVon(eintrag: NavEintrag | null): NavGruppe | null {
  if (!eintrag) return null
  for (const k of NAV_BAUM) if (k !== 'trenner' && istGruppe(k) && k.kinder.includes(eintrag)) return k
  return null
}

/** Unterpunkte von Telefon (Leiste auf den Telefon-Seiten unter 1024 px). */
export const TELEFON_SEITEN: NavEintrag[] = (
  NAV_BAUM.find((k) => k !== 'trenner' && istGruppe(k) && k.gruppe === 'telefon') as NavGruppe
).kinder

/** „Mehr“ in der Tab-Leiste < 768 (ux § 7.1): Umsatz · Auftrag · Pipeline · E-Mail · Leitfäden · … – die Telefon-Bereiche
 * erreicht man über die Leiste oben auf den Telefon-Seiten. */
export const MEHR_LEISTE: { pfad: string; label: string; icon: LucideIcon; bereich: string }[] = [
  { pfad: '/umsatz', label: 'Umsatz', icon: Euro, bereich: '/umsatz' },
  { pfad: '/auftrag', label: 'Auftrag', icon: ListChecks, bereich: '/auftrag' },
  { pfad: '/pipeline', label: 'Pipeline', icon: Columns3, bereich: '/pipeline' },
  { pfad: '/email', label: 'E-Mail', icon: Mail, bereich: '/email' },
  { pfad: '/leitfaeden', label: 'Leitfäden', icon: BookOpen, bereich: '/leitfaeden' },
  { pfad: '/import/schnell', label: 'Schnellimport', icon: Upload, bereich: '/import' },
  { pfad: '/team', label: 'Team', icon: UsersRound, bereich: '/team' },
  { pfad: '/einstellungen', label: 'Einstellungen', icon: Settings, bereich: '/einstellungen' },
  { pfad: '/hilfe', label: 'Hilfe', icon: LifeBuoy, bereich: '/hilfe' },
  { pfad: '/feedback', label: 'Feedback', icon: MessageSquareWarning, bereich: '/feedback' },
]

/** Tab-Leiste < 768 (ux § 7.1): Heute · Leads · Telefon · KPIs · Mehr */
export const TAB_LEISTE: { pfad: string; label: string; icon: LucideIcon; zaehler?: 'heute' | 'telefon' }[] = [
  { pfad: '/heute', label: 'Heute', icon: Sun, zaehler: 'heute' },
  { pfad: '/leads', label: 'Leads', icon: Users },
  { pfad: '/telefon', label: 'Telefon', icon: Phone, zaehler: 'telefon' },
  { pfad: '/kpis', label: 'KPIs', icon: BarChart3 },
]
