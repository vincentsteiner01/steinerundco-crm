// KPI-Reiter (26.11.2026): die Zahlen einer Person oder des Teams für einen Zeitraum und die gleich lange Spanne davor –
// zwei Abfragen der Sicht crm.v_kpi_tage (data/kpis), daraus Summen, die Marke „aus Sheet“ und die Tageswerte.
// Die alten Monatszähler (`period = 'monat'`) zählen nur in der Monatsansicht, im Tagesverlauf und in der Wochentabelle nie.
// In einem Monat mit Monatszähler sind die Tageswerte dieser Kennzahl deshalb unvollständig (Oktober 2026: 107 von 412
// versendeten Vernetzungen). Außerhalb der Monatsansicht gibt es für sie dann keinen Vergleich – statt „vs. davor 17“ steht „–“.
// Das gilt für jede Person, auch ohne eigenen Monatszähler (ihre Tageswerte beginnen genauso spät): für die Ansicht einer
// Person lädt eine dritte, kleine Abfrage die Monatszähler aller.
import { useKpiMonatszaehler, useKpiZeilen } from '@/data/kpis'
import type { Tag } from '@/lib/zeit'
import {
  fremdeMonatszaehler,
  mitMonatszaehler,
  nurAusMonat,
  ohneVergleich,
  summiere,
  tageswerte,
  type Kennzahl,
  type KpiZeile,
  type Summen,
  type TagesWert,
  type Vorsummen,
} from './kennzahlen'
import type { Zeitraum } from './zeitraum'

export type KpiDaten = {
  laden: boolean
  /** Laden gescheitert und nichts zu zeigen – scheitert nur ein Neuladen im Hintergrund, bleiben die Zahlen stehen */
  fehler: boolean
  /** Die Zahlen sind geladen (auch wenn gerade neu geladen wird oder das letzte Neuladen scheiterte) */
  da: boolean
  nachladen: () => void
  werte: Summen
  /** Summen der Vorperiode; `null` je Kennzahl = kein verlässlicher Vergleich (alte Monatszähler ohne Tageswerte) */
  vorwerte: Vorsummen
  /** Kennzahlen, deren Wert nur aus den alten Monatszählern stammt (Marke „aus Sheet“) */
  sheet: ReadonlySet<Kennzahl>
  /** Ein Eintrag je Kalendertag des Zeitraums, auch mit Nullen */
  tage: TagesWert[]
  /** Kennzahlen mit altem Monatszähler im Zeitraum: Tagesverlauf und Wochentabelle zeigen für sie nicht den ganzen Monat */
  monatszaehler: ReadonlySet<Kennzahl>
}

const monatsErster = (tag: Tag): Tag => `${tag.slice(0, 7)}-01`

/**
 * Ab welchem Tag geladen wird. Außerhalb der Monatsansicht ab dem Monatsersten: dort stehen die alten Monatszähler – nur so
 * ist bekannt, ob die Tageswerte der berührten Monate vollständig sind.
 */
export function ladenAb(von: Tag, zeitraum: Pick<Zeitraum, 'art'>): Tag {
  return zeitraum.art === 'monat' ? von : monatsErster(von)
}

/**
 * Geladene Zeilen (Zeitraum und Vorperiode, je ab `ladenAb`) → die Zahlen des Reiters. Reine Funktion.
 * `zaehlerAlle`: die Monatszähler aller Personen über beide Spannen – nur für die Ansicht einer Person nötig (beim Team
 * stehen sie in den Zeilen).
 */
export function auswerten(
  jetzt: readonly KpiZeile[],
  davor: readonly KpiZeile[],
  zeitraum: Pick<Zeitraum, 'art' | 'von' | 'bis' | 'vorperiode'>,
  zaehlerAlle: readonly KpiZeile[] = [],
): Pick<KpiDaten, 'werte' | 'vorwerte' | 'sheet' | 'tage' | 'monatszaehler'> {
  const mitMonat = zeitraum.art === 'monat'
  // Tage vor dem Zeitraum wurden nur wegen der Monatszähler mitgeladen
  const ab = (zeilen: readonly KpiZeile[], von: Tag) => (mitMonat ? zeilen : zeilen.filter((z) => z.tag >= von))
  const j = ab(jetzt, zeitraum.von)
  const d = ab(davor, zeitraum.vorperiode.von)
  const eigene = [...jetzt, ...davor]
  const alle = [...eigene, ...zaehlerAlle]
  // Monatsansicht: die eigenen Monatszähler zählen auf beiden Seiten mit, der Vergleich stimmt – außer eine andere Person hat
  // in einem der beiden Monate einen und die gewählte nicht. Sonst fehlen die Monatszähler in den Summen: kein Vergleich,
  // sobald in den berührten Monaten irgendwer einen hat.
  const luecken = mitMonat ? fremdeMonatszaehler(alle, eigene) : mitMonatszaehler(alle)
  return {
    werte: summiere(j, mitMonat),
    vorwerte: ohneVergleich(summiere(d, mitMonat), luecken),
    sheet: nurAusMonat(j, mitMonat),
    tage: tageswerte(j, zeitraum.von, zeitraum.bis),
    monatszaehler: mitMonatszaehler(jetzt),
  }
}

/**
 * @param member Member-ID oder `'team'` (alle Personen)
 * @param aktiv `false`: nichts laden, nur lesen, was schon geladen ist (die bisherige Ansicht, solange die neue lädt)
 */
export function useKpis(member: string | 'team', zeitraum: Zeitraum, aktiv = true): KpiDaten {
  const person = member !== 'team'
  const abDavor = ladenAb(zeitraum.vorperiode.von, zeitraum)
  const jetzt = useKpiZeilen(member, ladenAb(zeitraum.von, zeitraum), zeitraum.bis, aktiv)
  const davor = useKpiZeilen(member, abDavor, zeitraum.vorperiode.bis, aktiv)
  const zaehlerAlle = useKpiMonatszaehler(abDavor, zeitraum.bis, aktiv && person)
  // Beim Team stehen die Monatszähler aller in den Zeilen – die dritte Abfrage zählt dort nicht, auch nicht ihr Fehler
  const teile = person ? [jetzt, davor, zaehlerAlle] : [jetzt, davor]

  return {
    laden: teile.some((t) => t.istLaden),
    fehler: teile.some((t) => !!t.fehler),
    da: teile.every((t) => t.hatDaten),
    // nur das Gescheiterte neu laden
    nachladen: () => {
      for (const t of teile) if (t.fehler) t.nachladen()
    },
    ...auswerten(jetzt.data, davor.data, zeitraum, person ? zaehlerAlle.data : []),
  }
}
