// BAUPLAN § 3.1.5 – statische Navigation (DESIGN-SYSTEM § 4.1). Zähler aus useNavZaehler() (src/data/nav.ts).
import {
  BarChart3,
  BookOpen,
  Columns3,
  LifeBuoy,
  ListChecks,
  Mail,
  MessageSquareWarning,
  Phone,
  Settings,
  Sun,
  Upload,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export type NavEintrag = {
  pfad: string
  label: string
  icon: LucideIcon
  akkord: string
  zaehler?: 'heute' | 'leads' | 'telefon' | 'email'
}
export type NavElement = NavEintrag | 'trenner'

export const NAV: NavElement[] = [
  { pfad: '/heute', label: 'Heute', icon: Sun, akkord: 'G H', zaehler: 'heute' },
  { pfad: '/auftrag', label: 'Auftrag', icon: ListChecks, akkord: 'G U' },
  { pfad: '/leads', label: 'Leads', icon: Users, akkord: 'G L', zaehler: 'leads' },
  { pfad: '/pipeline', label: 'Pipeline', icon: Columns3, akkord: 'G P' },
  { pfad: '/telefon', label: 'Telefon', icon: Phone, akkord: 'G T', zaehler: 'telefon' },
  { pfad: '/email', label: 'E-Mail', icon: Mail, akkord: 'G M', zaehler: 'email' },
  { pfad: '/kpis', label: 'KPIs', icon: BarChart3, akkord: 'G K' },
  { pfad: '/team', label: 'Team', icon: UsersRound, akkord: 'G A' },
  { pfad: '/leitfaeden', label: 'Leitfäden', icon: BookOpen, akkord: 'G F' },
  'trenner',
  { pfad: '/import', label: 'Import', icon: Upload, akkord: 'G I' },
  { pfad: '/einstellungen', label: 'Einstellungen', icon: Settings, akkord: 'G E' },
  'trenner',
  { pfad: '/hilfe', label: 'Hilfe', icon: LifeBuoy, akkord: 'G S' },
  { pfad: '/feedback', label: 'Feedback', icon: MessageSquareWarning, akkord: 'G B' },
]

/** „Mehr“ in der Tab-Leiste < 768 (ux § 7.1): Pipeline · E-Mail · Leitfäden · Schnellimport · Einstellungen */
export const MEHR_LEISTE: { pfad: string; label: string; icon: LucideIcon; bereich: string }[] = [
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
