// Tageszähler und Kanalzahlen (BAUPLAN § 3.2 „Tageszähler“, ux § 2.1 Schritt 3, H-11/H-12):
// Wert = v_daily_activity.vernetzungen_versendet heute (getrackt + manuell) · „n davon mit Profil erfasst“ = Anfragen heute ·
// Woche = Σ heute−6 … heute · Heute noch möglich = max(0, min(daily_target − heute, weekly_budget − woche)) (lib/gates).
import { useCallback } from 'react'
import { useCallsHeute } from '@/data/calls'
import { useCounters, useCounterSetzen, useTageswertSetzen } from '@/data/counters'
import { useSettings } from '@/data/settings'
import { heuteBerlin } from '@/lib/format'
import { linkedinBudget, type LinkedinBudget } from '@/lib/gates'
import { tagPlus } from '@/lib/zeit'
import type { CallOutcome, DailyActivity, Member } from '@/types/domain'
import { useAnfragenHeute } from './daten/anfragen'

export type TageszaehlerDaten = {
  heute: string
  /** Vernetzungen versendet heute (getrackt + manuell) */
  wert: number
  /** Anfragen mit Profil (linkedin_connections heute) */
  getrackt: number
  manuell: number
  gestern: number
  woche: number
  monat: number
  /** Σ angenommen ÷ Σ versendet der letzten 7 Tage, `null` ohne Anfragen */
  annahmeQuote7: number | null
  budget: LinkedinBudget
  telefon: { anrufe: number; erreicht: number; entscheider: number; termine: number }
  laden: boolean
  setzen: (wert: number) => void
  delta: (n: number) => void
}

const NICHT_ERREICHT: ReadonlySet<CallOutcome> = new Set([
  'no_answer',
  'busy',
  'voicemail',
  'voicemail_left',
  'wrong_number',
])

const n = (v: number | null | undefined) => v ?? 0

export function useTageszaehler(memberId: string | null | undefined, me: Member | null | undefined): TageszaehlerDaten {
  const heute = heuteBerlin()
  const wocheVon = tagPlus(heute, -6)
  const monatVon = `${heute.slice(0, 8)}01`
  const von = wocheVon < monatVon ? wocheVon : monatVon
  const { data: zeilen, isPending } = useCounters(memberId, von, heute)
  const { data: anfragen } = useAnfragenHeute(memberId)
  const { data: calls } = useCallsHeute(memberId)
  const { data: settings } = useSettings()
  const setzenMut = useCounterSetzen()

  const tage: DailyActivity[] = zeilen ?? []
  const heuteZeile = tage.find((z) => z.day === heute)
  const wert = n(heuteZeile?.vernetzungen_versendet)
  const gestern = n(tage.find((z) => z.day === tagPlus(heute, -1))?.vernetzungen_versendet)
  const wocheZeilen = tage.filter((z) => z.day !== null && z.day >= wocheVon)
  const woche = wocheZeilen.reduce((s, z) => s + n(z.vernetzungen_versendet), 0)
  const angenommen7 = wocheZeilen.reduce((s, z) => s + n(z.vernetzungen_angenommen), 0)
  const monat = tage
    .filter((z) => z.day !== null && z.day >= monatVon)
    .reduce((s, z) => s + n(z.vernetzungen_versendet), 0)
  const getrackt = anfragen?.length ?? 0
  const budget = linkedinBudget(settings, me, woche, wert)

  const telefon = {
    anrufe: calls?.length ?? 0,
    erreicht: calls?.filter((c) => c.outcome && !NICHT_ERREICHT.has(c.outcome)).length ?? 0,
    entscheider: calls?.filter((c) => c.reached_person === 'entscheider').length ?? 0,
    termine: calls?.filter((c) => c.outcome === 'meeting_booked').length ?? 0,
  }

  /**
   * Direkteingabe (ux § 2.1 Schritt 3, H-11): der manuelle Anteil wird Eingabe − getrackt (nie < 0) – 40 bei 12 getrackten
   * ergibt manuell 28. `set_counter` schreibt nur den manuellen Zähler (die View addiert die getrackten Ereignisse); deshalb
   * geht die Eingabe als Delta auf den aktuellen Tageswert hinaus: manuell_neu = manuell_alt + (Ziel − Tageswert) = Ziel − getrackt.
   * Das Delta hält auch die optimistische Anzeige der M0-Mutation richtig (sie addiert auf die View-Zeile).
   */
  const tageswert = useTageswertSetzen()
  const tageswertSetzen = tageswert.ausfuehren
  const setzen = useCallback(
    (v: number) => {
      if (!memberId) return
      tageswertSetzen({ metric: 'vernetzungen_versendet', ziel: v, aktuell: wert, getrackt, date: heute, memberId })
    },
    [memberId, heute, tageswertSetzen, getrackt, wert],
  )
  const delta = useCallback(
    (d: number) => {
      if (!memberId) return
      setzenMut.mutate({ metric: 'vernetzungen_versendet', value: d, date: heute, memberId, delta: true })
    },
    [memberId, heute, setzenMut],
  )

  return {
    heute,
    wert,
    getrackt,
    manuell: Math.max(0, wert - getrackt),
    gestern,
    woche,
    monat,
    annahmeQuote7: woche > 0 ? angenommen7 / woche : null,
    budget,
    telefon,
    laden: isPending && !!memberId,
    setzen,
    delta,
  }
}
