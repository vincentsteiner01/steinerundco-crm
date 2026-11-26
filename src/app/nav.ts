// Navigation des einfachen CRM (Neustart 25.11.2026, Vincent und Mike: „viel zu kompliziert“): Leads · Leitfäden · E-Mail ·
// Trenner · Team · Einstellungen · Hilfe. Eine Quelle für alle drei Darstellungen – Sidebar (≥ 1024), Icon-Rail (768–1023),
// Tab-Leiste (< 768). Keine Zähler, keine Tastenkürzel.
// Leads trägt die Board-Ikone (Spalten), nicht „zwei Personen“ – die sah neben Team (UsersRound) fast gleich aus, und in der
// Icon-Rail steht kein Name daneben.
import { BookOpen, LifeBuoy, Mail, Settings, SquareKanban, UsersRound, type LucideIcon } from 'lucide-react'

export type NavEintrag = {
  pfad: string
  label: string
  /** Nur oberste Ebene; die Unterpunkte von E-Mail stehen eingerückt ohne Icon */
  icon?: LucideIcon
}
export type NavGruppe = {
  gruppe: 'email'
  label: string
  icon: LucideIcon
  /** Aufgeklappt, bis die Person sie selbst zuklappt */
  offenStandard: boolean
  kinder: NavEintrag[]
}
export type NavKnoten = NavEintrag | NavGruppe | 'trenner'

export const istGruppe = (k: NavKnoten): k is NavGruppe => typeof k === 'object' && 'kinder' in k

/** Sidebar: der ganze Baum. */
export const NAV_BAUM: NavKnoten[] = [
  { pfad: '/leads', label: 'Leads', icon: SquareKanban },
  { pfad: '/leitfaeden', label: 'Leitfäden', icon: BookOpen },
  {
    // Kampagnen, Antworten (Unibox), Postfächer – Einzelmails bleiben unter /email (01.11.2026, unverändert)
    gruppe: 'email',
    label: 'E-Mail',
    icon: Mail,
    offenStandard: true,
    kinder: [
      { pfad: '/email/kampagnen', label: 'Kampagnen' },
      { pfad: '/email/antworten', label: 'Antworten' },
      { pfad: '/email/postfaecher', label: 'Postfächer' },
      { pfad: '/email', label: 'Einzelmails' },
    ],
  },
  'trenner',
  { pfad: '/team', label: 'Team', icon: UsersRound },
  { pfad: '/einstellungen', label: 'Einstellungen', icon: Settings },
  { pfad: '/hilfe', label: 'Hilfe', icon: LifeBuoy },
]

/** Alle Seiten in Menü-Reihenfolge (Grundlage der Aktiv-Markierung). */
export const NAV_SEITEN: NavEintrag[] = NAV_BAUM.flatMap((k) => (k === 'trenner' ? [] : istGruppe(k) ? k.kinder : [k]))

/**
 * Icon-Rail: eine Ikone je Punkt. Die Gruppe E-Mail führt zu ihrer ersten Seite – die Unterseiten stehen dort in der Leiste
 * auf der Seite (MailNav).
 */
export const NAV: (NavEintrag | 'trenner')[] = NAV_BAUM.map((k): NavEintrag | 'trenner' => {
  if (k === 'trenner' || !istGruppe(k)) return k
  const erste = k.kinder[0] as NavEintrag
  return { pfad: erste.pfad, label: k.label, icon: k.icon }
})

const passt = (pathname: string, pfad: string): boolean => pathname === pfad || pathname.startsWith(`${pfad}/`)

/** Der eine aktive Menüpunkt zur aktuellen Adresse: längster passender Pfad (exakt oder Unterseite). */
export function aktiverEintrag(pathname: string, eintraege: readonly NavEintrag[] = NAV_SEITEN): NavEintrag | null {
  let best: NavEintrag | null = null
  for (const e of eintraege) if (passt(pathname, e.pfad) && e.pfad.length > (best?.pfad.length ?? -1)) best = e
  return best
}

/** Gruppe, in der eine Seite liegt (bleibt aufgeklappt, solange die Seite offen ist). */
export function gruppeVon(eintrag: NavEintrag | null): NavGruppe | null {
  if (!eintrag) return null
  for (const k of NAV_BAUM) if (k !== 'trenner' && istGruppe(k) && k.kinder.includes(eintrag)) return k
  return null
}

/** Pfad der aktiven Ikone in der Icon-Rail – jede E-Mail-Seite markiert die eine E-Mail-Ikone. */
export function aktiverRailPfad(pathname: string): string | null {
  const aktiv = aktiverEintrag(pathname)
  return gruppeVon(aktiv)?.kinder[0]?.pfad ?? aktiv?.pfad ?? null
}

export type TabEintrag = {
  pfad: string
  label: string
  icon: LucideIcon
  /** Aktiv auf jeder Adresse unter diesem Präfix (E-Mail: alle vier Bereiche) */
  bereich: string
}

/** Tab-Leiste: Leads · Leitfäden · E-Mail, dahinter der Knopf „Mehr“. */
export const TAB_LEISTE: TabEintrag[] = [
  { pfad: '/leads', label: 'Leads', icon: SquareKanban, bereich: '/leads' },
  { pfad: '/leitfaeden', label: 'Leitfäden', icon: BookOpen, bereich: '/leitfaeden' },
  { pfad: '/email/kampagnen', label: 'E-Mail', icon: Mail, bereich: '/email' },
]

/** „Mehr“ in der Tab-Leiste: Team · Einstellungen · Hilfe. */
export const MEHR_LEISTE: TabEintrag[] = [
  { pfad: '/team', label: 'Team', icon: UsersRound, bereich: '/team' },
  { pfad: '/einstellungen', label: 'Einstellungen', icon: Settings, bereich: '/einstellungen' },
  { pfad: '/hilfe', label: 'Hilfe', icon: LifeBuoy, bereich: '/hilfe' },
]

/** Der aktive Punkt einer Leiste (Tabs oder „Mehr“) – über `bereich`, nicht über den Zielpfad. */
export function aktiverTab(pathname: string, leiste: readonly TabEintrag[] = TAB_LEISTE): TabEintrag | null {
  return leiste.find((t) => passt(pathname, t.bereich)) ?? null
}
