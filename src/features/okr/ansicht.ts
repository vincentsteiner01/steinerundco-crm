// Reiter „Ziele“: aus den geladenen Daten wird das, was die Seite zeigt – je Ziel seine Key Results mit Fortschritt und
// To-dos. Reine Funktionen (die Rechnerei selbst steht in rechnen.ts); geladen wird in useOkrAnsicht.ts.
import type { Tag } from '@/lib/zeit'
import {
  fortschritte,
  schlechtester,
  zielAnteil,
  type Fortschritt,
  type IstSoll,
  type OkrDaten,
  type OkrEintrag,
  type OkrErgebnis,
  type OkrTodo,
  type OkrZiel,
  type Status,
  type Zahlen,
} from './rechnen'

export type ErgebnisAnsicht = { ergebnis: OkrErgebnis; fortschritte: Fortschritt[]; todos: OkrTodo[] }
export type ZielAnsicht = {
  ziel: OkrZiel
  ergebnisse: ErgebnisAnsicht[]
  /** Fortschritt des Ziels, 0…1 */
  anteil: number
  /** die eine Ampel des Ziels: der schlechteste Stand seiner Key Results */
  status: Status
}

/** Was Karten und Zeilen auslösen können – die Seite öffnet dazu die Dialoge bzw. bucht. */
export type OkrAktionen = {
  zielBearbeiten: (ziel: OkrZiel) => void
  zielLoeschen: (ziel: OkrZiel) => void
  ergebnisNeu: (ziel: OkrZiel) => void
  ergebnisBearbeiten: (ziel: OkrZiel, ergebnis: OkrErgebnis) => void
  ergebnisLoeschen: (ergebnis: OkrErgebnis) => void
  /** `memberId = null`: die Zeile gehört dem Team */
  zaehlen: (ergebnis: OkrErgebnis, memberId: string | null, delta: 1 | -1) => void
}

export function zielAnsicht(
  ziel: OkrZiel,
  daten: OkrDaten,
  memberIds: readonly string[],
  zahlen: Zahlen,
  heute: Tag,
  feiertage: readonly Tag[],
): ZielAnsicht {
  const ergebnisse = daten.ergebnisse
    .filter((e) => e.ziel_id === ziel.id)
    .map((e): ErgebnisAnsicht => ({
      ergebnis: e,
      fortschritte: fortschritte(e, ziel, memberIds, zahlen, heute, feiertage),
      todos: daten.todos.filter((t) => t.ergebnis_id === e.id),
    }))
  const alle = ergebnisse.map((e) => e.fortschritte)
  return {
    ziel,
    ergebnisse,
    anteil: zielAnteil(alle),
    status: schlechtester(alle.flat().map((f) => f.status)),
  }
}

export type Zusammen = { ist: number; soll: number; anteil: number; tempo: number; status: Status }

/** Alle Zeilen eines Key Results als eine (große Ziele zeigen je Key Result nur einen Balken). */
export function zusammen(f: readonly Fortschritt[]): Zusammen {
  const n = f.length || 1
  return {
    ist: f.reduce((s, x) => s + x.ist, 0),
    soll: f.reduce((s, x) => s + x.soll, 0),
    anteil: f.reduce((s, x) => s + x.anteil, 0) / n,
    tempo: f.reduce((s, x) => s + x.tempo, 0) / n,
    status: schlechtester(f.map((x) => x.status)),
  }
}

export type Ausschnitt = 'heute' | 'woche'

/** Hat diese Zeile im Ausschnitt etwas zu tun? */
export const hatSoll = (x: IstSoll | null): x is IstSoll => x !== null && x.soll > 1e-9

/** Key Results, die heute bzw. diese Woche ein Soll haben – die Zeilen der Karten „Heute“ und „Diese Woche“. */
export function ausschnittZeilen(ziele: readonly ZielAnsicht[], ausschnitt: Ausschnitt): ErgebnisAnsicht[] {
  return ziele.flatMap((z) => z.ergebnisse).filter((e) => e.fortschritte.some((f) => hatSoll(f[ausschnitt])))
}

/**
 * Bei wem ein Klick bucht. Zeile einer Person: bei ihr. Team-Zeile: bei der angemeldeten Person – nur beim Zurücknehmen
 * bei der Person mit dem jüngsten Eintrag, wenn die angemeldete selbst nichts eingetragen hat (sonst täte „−“ nichts).
 */
export function zaehlPerson(
  ergebnisId: string,
  zeile: string | null,
  delta: number,
  meId: string | null,
  eintraege: readonly OkrEintrag[],
): string | null {
  if (zeile) return zeile
  if (delta > 0) return meId
  const dazu = eintraege.filter((x) => x.ergebnis_id === ergebnisId && x.wert > 0)
  if (meId && dazu.some((x) => x.member_id === meId)) return meId
  const juengster = dazu.reduce<OkrEintrag | null>((a, b) => (a && a.tag >= b.tag ? a : b), null)
  return juengster?.member_id ?? meId
}

/**
 * Zeitraum, für den die Zahlen aus dem CRM gebraucht werden: vom frühesten Beginn der gezeigten Ziele bis zu ihrem spätesten
 * Ende, höchstens bis heute. `null`: nichts zu laden (keine Ziele, alles liegt in der Zukunft oder alles wird von Hand gezählt).
 */
export function kpiSpanne(
  ziele: readonly OkrZiel[],
  ergebnisse: readonly OkrErgebnis[],
  heute: Tag,
): { von: Tag; bis: Tag } | null {
  const ids = new Set(ziele.map((z) => z.id))
  if (!ergebnisse.some((e) => ids.has(e.ziel_id) && e.quelle !== 'manuell')) return null
  const von = ziele.reduce((a, z) => (z.von < a ? z.von : a), ziele[0]?.von ?? heute)
  const ende = ziele.reduce((a, z) => (z.bis > a ? z.bis : a), ziele[0]?.bis ?? heute)
  const bis = ende < heute ? ende : heute
  return bis < von ? null : { von, bis }
}
