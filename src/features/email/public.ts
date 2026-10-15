// src/features/email/public.ts – Vertrag BAUPLAN § 3.1.10a (M4): ErlaubnisErfassen, ErlaubnisBadge. Typen eingefroren.
// Zusätzlich (§ 3.5 „Sequenzen“, Parallel-Regel M-08): `istEmailSequenzAktiv` für den Chip „pausiert wegen E-Mail-Sequenz“ (M1/M2).
import { createElement, type JSX, type ReactNode } from 'react'
import { useEnrollments } from '@/data'
import type { Enrollment, Lead } from '@/types/domain'
import { ErlaubnisBadge as Badge } from './ErlaubnisBadge'
import { ErlaubnisErfassen as Erfassen } from './ErlaubnisErfassen'

export function ErlaubnisErfassen(props: { leadId: string; trigger: ReactNode }): JSX.Element {
  return createElement(Erfassen, props)
}

export function ErlaubnisBadge(props: { lead: Lead }): JSX.Element {
  return createElement(Badge, { lead: props.lead })
}

/** Läuft eine E-Mail-Sequenz (Status `aktiv`)? Reine Funktion über die Enrollments eines Leads (Embed aus `useLead`). */
export function istEmailSequenzAktiv(
  enrollments: readonly Pick<Enrollment, 'channel' | 'status'>[] | null | undefined,
): boolean {
  return !!enrollments?.some((e) => e.channel === 'email' && e.status === 'aktiv')
}

/** Hook-Variante nach Lead-ID (lädt `useEnrollments`); v1 nur Anzeige, keine automatische Pause (§ 3.5, datenmodell § 11 Nr. 7). */
export function useIstEmailSequenzAktiv(leadId: string | null | undefined): boolean {
  const { data } = useEnrollments(leadId)
  return istEmailSequenzAktiv(data)
}
