// Beenden-Gründe `1–9` (BAUPLAN § 3.1.10b) → ended_reason + ended_note; Freigabe-Gründe (ux § 2.6).
import { GRUND_LABEL } from '@/texte/de'
import type { EndedReason, Settings } from '@/types/domain'

export type BeendenGrund = {
  kbd: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  key: string
  label: string
  reason: EndedReason
  /** Feste Notiz (Gründe ohne eigene Enum) */
  note?: string
  /** Notiz ist Pflicht (Sonstiges) */
  notizPflicht?: boolean
}

export function beendenGruende(labels?: Settings['ended_reason_labels'] | null): readonly BeendenGrund[] {
  const l = (r: EndedReason) => labels?.[r] ?? GRUND_LABEL[r]
  return [
    { kbd: '1', key: 'kein_bedarf', label: l('kein_bedarf'), reason: 'kein_bedarf' },
    { kbd: '2', key: 'nicht_icp', label: l('nicht_icp'), reason: 'nicht_icp' },
    { kbd: '3', key: 'nicht_qualifiziert', label: l('nicht_qualifiziert'), reason: 'nicht_qualifiziert' },
    { kbd: '4', key: 'kein_interesse', label: l('kein_interesse'), reason: 'kein_interesse' },
    { kbd: '5', key: 'hat_partner', label: 'Hat Partner', reason: 'sonstiges', note: 'Hat bereits Partner' },
    {
      kbd: '6',
      key: 'kennt_problem_nicht',
      label: 'Kennt das Problem nicht',
      reason: 'kein_bedarf',
      note: 'Kennt das Problem nicht',
    },
    { kbd: '7', key: 'eigenes_portfolio', label: 'Eigenes Portfolio', reason: 'nicht_icp', note: 'Eigenes Portfolio' },
    {
      kbd: '8',
      key: 'keine_reaktion',
      label: 'Keine Reaktion',
      reason: 'kein_interesse',
      note: 'Keine Reaktion nach Sequenz',
    },
    { kbd: '9', key: 'sonstiges', label: l('sonstiges'), reason: 'sonstiges', notizPflicht: true },
  ]
}

export type FreigabeGrundKey = 'kontakt_entfernt' | 'blockiert' | 'keine_nachrichten' | 'sonstiges'

/** Wortlaut landet in `leads.released_reason` (Text); „Übernehmen“ prüft auf `keine_nachrichten`. */
export const FREIGABE_GRUND: Record<FreigabeGrundKey, string> = {
  kontakt_entfernt: 'Kontakt entfernt',
  blockiert: 'Blockiert',
  keine_nachrichten: 'Will keine Nachrichten von mir',
  sonstiges: 'Sonstiges',
}

export const FREIGABE_PER_TABELLE = 'per Tabelle'

/** Freigabegrund „will keine Nachrichten“ → Hinweis vor erneuter Kontaktaufnahme (ux § 2.6 Schritt 2). */
export function willKeineNachrichten(releasedReason: string | null | undefined): boolean {
  return !!releasedReason && releasedReason.toLowerCase().includes('keine nachrichten')
}
