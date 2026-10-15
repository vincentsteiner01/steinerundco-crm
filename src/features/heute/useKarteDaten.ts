// Daten einer aufgeklappten Karte: Lead-Detail (Rolle, Anrede, Firma, Gates), angemeldete Person, Vorlage (nach Rolle/Label/
// ⌘⇧E), gefüllter Text (lib/platzhalter) – und das Ergebnis im kartenStore, damit die Tasten der Seite (C/E/P) es lesen.
import { useCallback, useEffect } from 'react'
import { useLead, useLeadUpdate } from '@/data/leads'
import { useMe, useMembers } from '@/data/members'
import { useSequencesIndex } from '@/data/sequences'
import { useTemplates } from '@/data/templates'
import type { PlatzhalterKontext, PlatzhalterLead } from '@/lib/platzhalter'
import type { LeadMitBezug, Member, QueueItem, Template } from '@/types/domain'
import { useKartenStore, useKartenZustand, type KartenZustand } from './kartenStore'
import {
  fuellKontext,
  fuellLead,
  kartenArt,
  nachrichtErgebnis,
  vorlageFuerKarte,
  type AntwortInfo,
  type KartenArt,
  type NachrichtErgebnis,
} from './nachricht'
import { itemKey } from './sektionen'

export type KarteDaten = {
  key: string
  art: KartenArt
  lead: LeadMitBezug | undefined
  me: Member | undefined
  owner: Member | undefined
  salesOwner: Member | undefined
  templates: Template[] | undefined
  zustand: KartenZustand
  vorlage: Template | null
  fLead: PlatzhalterLead
  ctx: PlatzhalterKontext
  ergebnis: NachrichtErgebnis
  istOpener: boolean
  /** `[Anrede]` bei `neutral`: einmal Herr/Frau – wird am Lead gespeichert (§ 3.1.9a) */
  setzeAnrede: (anrede: 'herr' | 'frau') => void
}

export function useKarteDaten(
  item: QueueItem,
  opts: { antwort?: AntwortInfo | null; vorlageVorgabe?: Template | null } = {},
): KarteDaten {
  const key = itemKey(item)
  const { data: lead } = useLead(item.lead_id)
  const me = useMe()
  const { data: members } = useMembers()
  const { data: templates } = useTemplates()
  const { data: idx } = useSequencesIndex()
  const zustand = useKartenZustand(key)
  const setze = useKartenStore((s) => s.setze)
  const setzeWert = useKartenStore((s) => s.setzeWert)
  const leadUpdate = useLeadUpdate()

  const art = kartenArt(item)
  const istOpener = !!(item.step_id && idx?.stepsById.get(item.step_id)?.is_opener)
  const vorlage =
    opts.vorlageVorgabe && !zustand.vorlageId
      ? opts.vorlageVorgabe
      : vorlageFuerKarte(item, art, lead, templates, zustand, opts.antwort ?? null, istOpener)
  const fLead = fuellLead(item, lead)
  const ctx = fuellKontext(lead, me, zustand.werte)
  const ergebnis = nachrichtErgebnis(vorlage?.body, fLead, ctx, zustand.bearbeiten ? zustand.text : null)

  const offenKey = ergebnis.offen.join('|')
  const vorlageId = vorlage?.id ?? null
  const vorlageName = vorlage?.name ?? null
  const phase = vorlage?.phase ?? null
  const text = ergebnis.text
  useEffect(() => {
    setze(key, { ergebnis: { text, offen: offenKey ? offenKey.split('|') : [], vorlageId, vorlageName, phase } })
  }, [key, text, offenKey, vorlageId, vorlageName, phase, setze])

  const setzeAnrede = useCallback(
    (anrede: 'herr' | 'frau') => {
      setzeWert(key, 'Anrede', anrede === 'herr' ? 'Herr' : 'Frau')
      if (lead) leadUpdate.mutate({ id: lead.id, erwartetUpdatedAt: lead.updated_at, patch: { salutation: anrede } })
    },
    [key, lead, leadUpdate, setzeWert],
  )

  return {
    key,
    art,
    lead,
    me,
    owner: members?.find((m) => m.id === item.owner_id),
    salesOwner: members?.find((m) => m.id === lead?.sales_owner_id),
    templates,
    zustand,
    vorlage,
    fLead,
    ctx,
    ergebnis,
    istOpener,
    setzeAnrede,
  }
}
