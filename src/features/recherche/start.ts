// Start eines Recherchelaufs (29.10.2026) – gemeinsam für den blauen Knopf unter der Suche und die Karte auf /auftrag: öffnet den
// aktiven Lauf oder startet einen neuen mit dem ChatGPT-Auftrag aus regeln.ts.
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useMe, useMeId } from '@/data/members'
import { useMeineLaeufe, useRechercheStarten, type RechercheLauf } from '@/data/recherche'
import { anzeigeName } from '@/lib/mitglied'
import { agentAuftrag } from './regeln'

/** Aktiver Lauf der angemeldeten Person und „los“: öffnet ihn – oder startet einen neuen mit Agent-Auftrag. */
export function useRechercheOeffnen() {
  const navigate = useNavigate()
  const me = useMe()
  const meId = useMeId()
  const { data: laeufe } = useMeineLaeufe(meId)
  const starten = useRechercheStarten()
  const aktiv = laeufe?.find((l) => l.status === 'laeuft' || l.status === 'pausiert')
  const los = () =>
    aktiv
      ? navigate(PFADE.recherche(aktiv.id))
      : starten.mutate(agentAuftrag({ person: anzeigeName(me) || 'Vincent' }), {
          onSuccess: (l) => navigate(PFADE.recherche(l.id)),
        })
  return { laeufe, aktiv, los, busy: starten.isPending }
}

/** Beschriftung je Lage: starten · läuft x/30 · pausiert · Freigabe nötig */
export function knopfText(aktiv: RechercheLauf | undefined): string {
  if (!aktiv) return 'Recherche starten'
  if (aktiv.status === 'laeuft' && aktiv.agent_status === 'frage') return 'Freigabe nötig'
  if (aktiv.status === 'pausiert') return 'Recherche pausiert'
  return `Recherche läuft · ${aktiv.gesendet}/${aktiv.ziel}`
}
