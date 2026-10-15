// Später-Optionen (BAUPLAN § 3.1.10b, ux § 5.3): 1 morgen · 2 +3 T · 3 nächster Montag · 4 +1 W · 5 +2 Mo (→ Wiedervorlage) · D Datum.
// Zieltage sind Kalendertage, auf den nächsten Werktag gerollt (E13; die DB rollt ebenfalls, die Anzeige soll es vorwegnehmen).
// 1/2/4 rechnen wie die DB ab max(fällig, heute) (BAUPLAN § 5.2, Beispiel A7: KF1 fällig Mo 19.10., heute Mi 14.10., „+3 T“ → Do 22.10.)
// und gehen als `p_days` an snooze_step/snooze_task; „Nächster Montag“ und `D` schicken ein festes Datum (`p_until`).
import { fmtDatumKurz } from '@/lib/format'
import { FEIERTAGE_HH, rollToWeekday } from '@/lib/werktage'
import { berlinTag, monatePlus, naechsterWochentag, tagPlus } from '@/lib/zeit'

export type SpaeterOption = {
  kbd: '1' | '2' | '3' | '4' | '5'
  label: string
  /** Zieltag (Anzeige; bei `tage` rechnet die DB denselben Tag) */
  tag: string
  /** Relativ-Option: an die DB als `p_days` (Basis max(fällig, jetzt)); fehlt bei festen Zieltagen */
  tage?: 1 | 3 | 7
  /** Option 5: nicht verschieben, sondern Wiedervorlage setzen */
  wiedervorlage: boolean
}

/** Basis der Relativ-Optionen: der spätere von Fälligkeitstag und heute (Europe/Berlin). */
export function spaeterBasis(heute: string, faelligAm?: string | null): string {
  if (!faelligAm) return heute
  const tag = berlinTag(faelligAm)
  return tag > heute ? tag : heute
}

export function spaeterOptionen(
  heute: string,
  feiertage: readonly string[] = FEIERTAGE_HH,
  faelligAm?: string | null,
): SpaeterOption[] {
  const roll = (t: string) => rollToWeekday(t, feiertage)
  const basis = spaeterBasis(heute, faelligAm)
  return [
    { kbd: '1', label: 'Morgen', tag: roll(tagPlus(basis, 1)), tage: 1, wiedervorlage: false },
    { kbd: '2', label: '+3 T', tag: roll(tagPlus(basis, 3)), tage: 3, wiedervorlage: false },
    { kbd: '3', label: 'Nächster Montag', tag: roll(naechsterWochentag(heute, 1)), wiedervorlage: false },
    { kbd: '4', label: '+1 W', tag: roll(tagPlus(basis, 7)), tage: 7, wiedervorlage: false },
    { kbd: '5', label: '+2 Mo · Wiedervorlage', tag: roll(monatePlus(heute, 2)), wiedervorlage: true },
  ]
}

/** Toast-Wortlaut „Später: morgen.“ bzw. „Später: Do 16.10.“ (DESIGN-SYSTEM § 5.21). */
export function spaeterWann(tag: string, heute: string): string {
  return tag === tagPlus(heute, 1) ? 'morgen' : fmtDatumKurz(tag)
}
