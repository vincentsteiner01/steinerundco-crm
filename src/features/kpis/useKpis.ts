// BAUPLAN § 3.6 `useKpis.ts`: bündelt alle Quellen des Dashboards für Zeitraum und Vorperiode je Person/Team –
// v_metric_events (Zeilen, lokal), v_funnel_monthly (nur Monat), v_daily_activity, v_antwortzeit, v_template_performance,
// v_leads_ohne_bewegung, meetings, linkedin_connections, settings.kpi_targets und die drei M0-Zeitraum-Hooks (§ 1.5 Nr. 40).
import { useMemo } from 'react'
import { useActivitiesZeitraum, type ActivityZeitraum } from '@/data/activities'
import { useCallOutcomeDefs, useCallsZeitraum } from '@/data/calls'
import { useConnectionsZeitraum } from '@/data/connections'
import { useManuelleZaehler } from '@/data/counters'
import { useEmailsZeitraum } from '@/data/emails'
import { useAntwortzeit, useDailyActivity, useFunnelMonatlich, useMetricEventZeilen } from '@/data/kpis'
import { useLeadsOhneBewegung } from '@/data/leads'
import { useMeetingsMember } from '@/data/meetings'
import { useSequencesIndex } from '@/data/sequences'
import { useSettings } from '@/data/settings'
import { useTemplatePerformance } from '@/data/templates'
import type { ActivityType, Call, CallOutcomeDef, Meeting } from '@/types/domain'
import {
  antwortzeitSchnitt,
  ausFunnelMonat,
  ausSummen,
  emailBeantwortetQuote,
  geantwortetNachSchritt,
  gespraechsdauer,
  notizVarianten,
  summiereEvents,
  tageswerte,
  widersprueche,
  type FunnelWerte,
} from './kennzahlen'
import { monatszaehlerZaehlen, type Zeitraum } from './zeitraum'

const jetztIso = (): string => new Date().toISOString()

/** Typen für „Geantwortet nach Schritt“ + Widersprüche in einer Anfrage (§ 3.6 useKpis). */
const SCHRITT_TYPEN: ActivityType[] = [
  'nachricht_erhalten',
  'email_erhalten',
  'gespraech_eroeffnet',
  'nachricht_gesendet',
  'pitch_gesendet',
  'email_gesendet',
  'widerspruch',
]

export type KpiDaten = {
  laden: boolean
  fehler: unknown
  nachladen: () => void
  werte: FunnelWerte
  vorwerte: FunnelWerte
  nurSheet: ReturnType<typeof summiereEvents>['nurSheet']
  manuell: boolean
  antwortzeit: number | null
  antwortzeitVor: number | null
  dauer: number | null
  dauerVor: number | null
  emailQuote: number | null
  emailQuoteVor: number | null
  widersprueche: number
  widerspruecheVor: number
  nachSchritt: Map<string, number>
  notizVarianten: ReturnType<typeof notizVarianten>
  aktivitaeten: ActivityZeitraum[]
  tage: ReturnType<typeof tageswerte>
  templates: NonNullable<ReturnType<typeof useTemplatePerformance>['data']>
  ohneBewegung: NonNullable<ReturnType<typeof useLeadsOhneBewegung>['data']>
  sequenzen: ReturnType<typeof useSequencesIndex>['data']
  naechsterTermin: Meeting | null
  settings: ReturnType<typeof useSettings>['data']
  /** Telefon-Auswertung (17.10.2026): Anrufe des Zeitraums + Ergebnis-Definitionen */
  anrufe: readonly Call[]
  ergebnisDefs: readonly CallOutcomeDef[]
  /** Gar keine Ereignisse/Zähler im Zeitraum (Leerzustand ux § 4.1) */
  keineDaten: boolean
}

/**
 * @param member  Member-ID oder 'team'
 * @param mitglieder  IDs für die Terminsuche (Person: eine; Team: beide)
 */
export function useKpis(member: string | 'team', mitglieder: readonly string[], z: Zeitraum): KpiDaten {
  const { von, bis, vorperiode: v } = z
  const monat = monatszaehlerZaehlen(z)

  const zeilen = useMetricEventZeilen(member, von, bis)
  const zeilenVor = useMetricEventZeilen(member, v.von, v.bis)
  const funnelMonat = useFunnelMonatlich(member, z.monthKey)
  const vorMonthKey = z.monthKey ? v.von.slice(0, 7) : null
  const funnelVormonat = useFunnelMonatlich(member, vorMonthKey)
  const manuell = useManuelleZaehler(member, von, bis)
  const antwortzeit = useAntwortzeit(member, von, bis)
  const antwortzeitVor = useAntwortzeit(member, v.von, v.bis)
  const daily = useDailyActivity(member, von, bis)
  const calls = useCallsZeitraum(member, von, bis)
  const callsVor = useCallsZeitraum(member, v.von, v.bis)
  const defs = useCallOutcomeDefs()
  const emails = useEmailsZeitraum(member, von, bis)
  const emailsVor = useEmailsZeitraum(member, v.von, v.bis)
  const acts = useActivitiesZeitraum(member, von, bis, SCHRITT_TYPEN)
  const actsVor = useActivitiesZeitraum(member, v.von, v.bis, SCHRITT_TYPEN)
  const connections = useConnectionsZeitraum(member, von, bis)
  const templates = useTemplatePerformance()
  const ohneBewegung = useLeadsOhneBewegung()
  const sequenzen = useSequencesIndex()
  const settings = useSettings()
  // Termine: feste Hook-Reihenfolge, je Mitglied ein Aufruf (Team = beide, Person = nur sie)
  const meetingsA = useMeetingsMember(mitglieder[0] ?? null)
  const meetingsB = useMeetingsMember(mitglieder[1] ?? null)

  const summen = useMemo(() => summiereEvents(zeilen.data, monat), [zeilen.data, monat])
  const summenVor = useMemo(() => summiereEvents(zeilenVor.data, monat), [zeilenVor.data, monat])

  const werte = useMemo(
    () => (z.monthKey ? ausFunnelMonat(funnelMonat.data) : ausSummen(summen.summen)),
    [z.monthKey, funnelMonat.data, summen.summen],
  )
  const vorwerte = useMemo(
    () => (z.monthKey ? ausFunnelMonat(funnelVormonat.data) : ausSummen(summenVor.summen)),
    [z.monthKey, funnelVormonat.data, summenVor.summen],
  )

  const defsListe = useMemo(() => defs.data ?? [], [defs.data])
  const dauer = useMemo(() => gespraechsdauer(calls.data, defsListe), [calls.data, defsListe])
  const dauerVor = useMemo(() => gespraechsdauer(callsVor.data, defsListe), [callsVor.data, defsListe])
  const nachSchritt = useMemo(() => geantwortetNachSchritt(acts.data), [acts.data])
  const varianten = useMemo(() => notizVarianten(connections.data, acts.data), [connections.data, acts.data])
  const tage = useMemo(() => tageswerte(daily.data ?? [], von, bis), [daily.data, von, bis])

  const naechsterTermin = useMemo(() => {
    const alle = [...(meetingsA.data ?? []), ...(meetingsB.data ?? [])].filter((m) => m.status === 'geplant')
    alle.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    const jetzt = jetztIso()
    return alle.find((m) => m.scheduled_at >= jetzt) ?? alle[0] ?? null
  }, [meetingsA.data, meetingsB.data])

  const laden =
    zeilen.istLaden ||
    zeilenVor.istLaden ||
    (!!z.monthKey && (funnelMonat.isPending || funnelVormonat.isPending)) ||
    daily.isPending ||
    settings.isPending
  const fehler =
    zeilen.fehler ??
    zeilenVor.fehler ??
    funnelMonat.error ??
    funnelVormonat.error ??
    daily.error ??
    antwortzeit.error ??
    calls.fehler ??
    emails.fehler ??
    acts.fehler ??
    templates.error ??
    ohneBewegung.error ??
    settings.error ??
    null

  const nachladen = () => {
    zeilen.nachladen()
    zeilenVor.nachladen()
    void funnelMonat.refetch()
    void funnelVormonat.refetch()
    void daily.refetch()
    void antwortzeit.refetch()
    void templates.refetch()
    void ohneBewegung.refetch()
    void settings.refetch()
  }

  const keineDaten = !laden && zeilen.data.length === 0 && !funnelMonat.data

  return {
    laden,
    fehler,
    nachladen,
    werte,
    vorwerte,
    nurSheet: summen.nurSheet,
    manuell: (manuell.data?.length ?? 0) > 0,
    antwortzeit: antwortzeitSchnitt(antwortzeit.data ?? []),
    antwortzeitVor: antwortzeitSchnitt(antwortzeitVor.data ?? []),
    dauer,
    dauerVor,
    emailQuote: emailBeantwortetQuote(emails.data),
    emailQuoteVor: emailBeantwortetQuote(emailsVor.data),
    widersprueche: widersprueche(acts.data),
    widerspruecheVor: widersprueche(actsVor.data),
    nachSchritt,
    notizVarianten: varianten,
    aktivitaeten: acts.data,
    tage,
    templates: templates.data ?? [],
    ohneBewegung: ohneBewegung.data ?? [],
    sequenzen: sequenzen.data,
    naechsterTermin,
    settings: settings.data,
    anrufe: calls.data,
    ergebnisDefs: defsListe,
    keineDaten,
  }
}
