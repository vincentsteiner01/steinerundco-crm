// src/features/leads/public.ts – Vertrag BAUPLAN § 3.1.10a (M2): LeadPanel · LeadForm · Timeline mit exakt diesen Signaturen.
import { createElement, type JSX } from 'react'
import type { LeadInsert } from '@/types/domain'
import { LeadForm as LeadFormIntern } from './LeadForm'
import { LeadPanel as LeadPanelIntern, PeekKopfAktionen as PeekKopfAktionenIntern } from './LeadPanel'
import { Timeline as TimelineIntern } from './Timeline'

/** Peek-Inhalt (Kopf, Nächster Schritt, Felder, Kanal-Karten, Timeline, Notiz, Fuß) */
export function LeadPanel(props: { leadId: string }): JSX.Element {
  return createElement(LeadPanelIntern, props)
}
/** Icon-Buttons der Peek-Kopfzeile (LinkedIn O · Anrufen ⌘⇧K · E-Mail ⌥M · Vollansicht ⌘↵) für `PeekPanel kopfRechts` (DESIGN § 5.11) */
export function PeekKopfAktionen(props: { leadId: string }): JSX.Element {
  return createElement(PeekKopfAktionenIntern, props)
}
export function LeadForm(props: {
  vorbelegung?: Partial<LeadInsert>
  onGespeichert: (id: string, weiter: boolean) => void
  onAbbrechen: () => void
}): JSX.Element {
  return createElement(LeadFormIntern, props)
}
export function Timeline(props: { leadId: string; kompakt?: boolean }): JSX.Element {
  return createElement(TimelineIntern, props)
}
