// Reiter „Ziele“: alles, was die Seite für einen Monat braucht, aus einer Hand – Ziele/Key Results/Einträge/To-dos (useOkr),
// die Personen, die Feiertage und die Zahlen aus dem CRM (v_kpi_tage, einmal für die ganze Spanne der gezeigten Ziele).
// `aktiv = false` lädt nichts und liest nur, was schon da ist: so bleibt beim Blättern der bisherige Monat stehen, bis der
// neue geladen ist (dieselbe Regel wie auf der KPI-Seite).
import { useMemo } from 'react'
import { useKpiZeilen } from '@/data/kpis'
import { useMeId, useMembers } from '@/data/members'
import { useOkr } from '@/data/okr'
import { useSetting } from '@/data/settings'
import { teamPersonen, type TeamPerson } from '@/features/team/personen'
import { FEIERTAGE_HH } from '@/lib/werktage'
import { monatePlus, type Tag } from '@/lib/zeit'
import { kpiSpanne, zielAnsicht, type ZielAnsicht } from './ansicht'
import { monatsErster, sichtbareZiele, type OkrDaten, type OkrEintrag, type Zahlen } from './rechnen'

export type OkrQuellen = {
  monat: Tag
  heute: Tag
  /** erstes Laden – es gibt noch nichts zu zeigen */
  laden: boolean
  /** nur wenn nichts geladen ist; ein gescheitertes Neuladen lässt den Stand stehen */
  fehler: boolean
  /** alles da, was die Ansicht braucht */
  da: boolean
  nachladen: () => void
  daten: OkrDaten | undefined
  personen: TeamPerson[]
  meId: string | null
  feiertage: readonly Tag[]
  zahlen: Zahlen
}

const KEINE_EINTRAEGE: readonly OkrEintrag[] = []

export function useOkrQuellen(monat: Tag, heute: Tag, aktiv = true): OkrQuellen {
  const okr = useOkr()
  const mitglieder = useMembers()
  const meId = useMeId()
  const feiertage = useSetting('feiertage') ?? FEIERTAGE_HH
  const personen = useMemo(() => teamPersonen(mitglieder.data ?? []), [mitglieder.data])

  const spanne = useMemo(() => {
    if (!okr.data) return null
    const s = sichtbareZiele(okr.data.ziele, monat)
    return kpiSpanne([...s.gross, ...s.monat], okr.data.ergebnisse, heute)
  }, [okr.data, monat, heute])
  const kpi = useKpiZeilen('team', spanne?.von ?? monat, spanne?.bis ?? monat, aktiv && spanne !== null)

  // Die Zahlen gelten erst, wenn alle Seiten da sind (ein Jahr für zwei Personen sind mehr als 500 Zeilen)
  const zahlenDa = spanne === null || (kpi.hatDaten && !kpi.istLaden)
  const da = !!okr.data && !!mitglieder.data && zahlenDa
  const fehler =
    !da && ((!okr.data && okr.isError) || (!mitglieder.data && mitglieder.isError) || (!zahlenDa && !!kpi.fehler))

  return {
    monat,
    heute,
    laden: !da && !fehler,
    fehler,
    da,
    nachladen: () => {
      if (okr.isError) void okr.refetch()
      if (mitglieder.isError) void mitglieder.refetch()
      if (kpi.fehler) kpi.nachladen()
    },
    daten: okr.data,
    personen,
    meId,
    feiertage,
    zahlen: { kpi: spanne === null ? [] : kpi.data, eintraege: okr.data?.eintraege ?? KEINE_EINTRAEGE },
  }
}

export type OkrAnsicht = {
  /** Jahr, dann Quartal */
  gross: ZielAnsicht[]
  monatsziele: ZielAnsicht[]
  /** der Vormonat, wenn er Monatsziele hat (zum Übernehmen) – sonst `null` */
  vormonat: Tag | null
  /** heute liegt im gezeigten Monat */
  laeuft: boolean
}

/** Die Ansicht eines Monats aus den geladenen Quellen. */
export function baueAnsicht(q: OkrQuellen): OkrAnsicht {
  const daten: OkrDaten = q.daten ?? { ziele: [], ergebnisse: [], eintraege: [], todos: [] }
  const monat = monatsErster(q.monat)
  const sichtbar = sichtbareZiele(daten.ziele, monat)
  const ids = q.personen.map((p) => p.id)
  const ansicht = (z: (typeof daten.ziele)[number]) => zielAnsicht(z, daten, ids, q.zahlen, q.heute, q.feiertage)
  const davor = monatePlus(monat, -1)
  return {
    gross: sichtbar.gross.map(ansicht),
    monatsziele: sichtbar.monat.map(ansicht),
    vormonat: sichtbareZiele(daten.ziele, davor).monat.length > 0 ? davor : null,
    laeuft: monatsErster(q.heute) === monat,
  }
}
