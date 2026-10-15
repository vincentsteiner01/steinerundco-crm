// Links des Moduls (nur über PFADE, BAUPLAN § 3.1.4): Composer-URL mit `?lead=&vorlage=&schritt=&enrollment=&zurueck=`.
import { PFADE } from '@/app/pfade'
import { internesZiel } from '@/lib/url'

export type VerfassenZiel = {
  leadId: string
  vorlageId?: string | null
  enrollmentId?: string | null
  schrittId?: string | null
  /** Rücksprung (Pfad + Query der aktuellen Seite). */
  zurueck?: string | null
  erlaubnis?: boolean
  widerspruch?: boolean
}

export function verfassenUrl(z: VerfassenZiel): string {
  const p = new URLSearchParams()
  p.set('lead', z.leadId)
  if (z.vorlageId) p.set('vorlage', z.vorlageId)
  if (z.schrittId) p.set('schritt', z.schrittId)
  if (z.enrollmentId) p.set('enrollment', z.enrollmentId)
  if (z.zurueck) p.set('zurueck', z.zurueck)
  if (z.erlaubnis) p.set('erlaubnis', '1')
  if (z.widerspruch) p.set('widerspruch', '1')
  return `${PFADE.emailVerfassen}?${p.toString()}`
}

export type EmailTab = 'faellig' | 'entwuerfe' | 'gesendet'
export const EMAIL_TABS: readonly EmailTab[] = ['faellig', 'entwuerfe', 'gesendet']

export function emailTabUrl(tab: EmailTab): string {
  return `${PFADE.email}?tab=${tab}`
}

/** Rücksprungziel nur, wenn es mit `/` und nicht mit `//` beginnt (kein Open Redirect, wie § 1.5 Nr. 31). */
export function sicheresZurueck(wert: string | null | undefined): string {
  return internesZiel(wert, PFADE.email)
}

export function istEmailTab(s: string | null): s is EmailTab {
  return !!s && (EMAIL_TABS as readonly string[]).includes(s)
}

/** Aktueller Pfad + Query für `?zurueck=` (ohne Host). */
export function aktuellerPfad(): string {
  if (typeof window === 'undefined') return PFADE.email
  return `${window.location.pathname}${window.location.search}`
}
