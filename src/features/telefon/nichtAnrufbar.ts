// M3 – „Noch nicht anrufbar“ nach Grund (Runde 3, echte Daten): Der Leerzustand sagte „121 Leads warten auf einen Anrufgrund“ mit
// „Anrufgrund setzen“, obwohl 119 keine Nummer hatten und 2 gesperrt waren. Hier zählen wir nach Gruppe und wählen den nächsten
// Schritt nach dem häufigsten Grund. Reine Funktionen – TelefonSeite rendert, Tests prüfen Wortlaut und Auswahl.
import { SYSTEM_ANSICHTEN } from '@/app/ansichten'
import { PFADE } from '@/app/pfade'
import type { TelefonGrund } from '@/lib/gates'
import type { GesperrtZeile } from './anrufliste'

export type NichtGruppe = 'keine_nummer' | 'kein_anrufgrund' | 'gesperrt'
export type NichtFilter = NichtGruppe | 'alle'
export type NichtZaehlung = Record<NichtGruppe, number>

export function nichtGruppe(grund: TelefonGrund): NichtGruppe {
  if (grund === 'keine_nummer' || grund === 'kein_anrufgrund') return grund
  return 'gesperrt' // Sperrliste · Widerspruch · Firma gesperrt
}

export function nichtZaehlen(zeilen: readonly GesperrtZeile[]): NichtZaehlung {
  const z: NichtZaehlung = { keine_nummer: 0, kein_anrufgrund: 0, gesperrt: 0 }
  for (const zeile of zeilen) z[nichtGruppe(zeile.grund)]++
  return z
}

/** Häufigster Grund; bei Gleichstand zuerst, was sich am schnellsten lösen lässt (Anrufgrund vor Nummer vor Sperre). */
export function hauptGruppe(z: NichtZaehlung): NichtGruppe | null {
  const reihenfolge: NichtGruppe[] = ['kein_anrufgrund', 'keine_nummer', 'gesperrt']
  let beste: NichtGruppe | null = null
  for (const g of reihenfolge) if (z[g] > 0 && (beste === null || z[g] > z[beste])) beste = g
  return beste
}

const leads = (n: number) => (n === 1 ? '1 Lead' : `${n} Leads`)

/** „116 Leads ohne Telefonnummer · 2 gesperrt.“ – Hauptgrund zuerst, nur Gruppen mit Treffern. */
export function nichtSatz(z: NichtZaehlung): string {
  const haupt = hauptGruppe(z)
  if (!haupt) return ''
  const text: Record<NichtGruppe, (n: number, erst: boolean) => string> = {
    keine_nummer: (n, erst) => `${erst ? leads(n) : n} ohne Telefonnummer`,
    kein_anrufgrund: (n, erst) => `${erst ? leads(n) : n} ohne Anrufgrund`,
    gesperrt: (n, erst) => `${erst ? leads(n) : n} gesperrt`,
  }
  const folge = [haupt, ...(['keine_nummer', 'kein_anrufgrund', 'gesperrt'] as const).filter((g) => g !== haupt)]
  return `${folge
    .filter((g) => z[g] > 0)
    .map((g, i) => text[g](z[g], i === 0))
    .join(' · ')}.`
}

/** Erklärung unter der Zählung – warum die Liste leer ist und wann sie sich füllt. */
export const NICHT_ERKLAERUNG =
  'Die Anrufliste füllt sich, sobald ein Lead eine Telefonnummer und einen Anrufgrund hat.'

/** Primärknopf im Leerzustand je Hauptgrund. */
export const NICHT_AKTION: Record<NichtGruppe, string> = {
  keine_nummer: 'Nummern ergänzen',
  kein_anrufgrund: 'Anrufgrund setzen',
  gesperrt: 'Gesperrte ansehen',
}

/** Filter im Abschnitt „Noch nicht anrufbar“. */
export const NICHT_FILTER_LABEL: Record<NichtFilter, string> = {
  alle: 'Alle',
  keine_nummer: 'Keine Nummer',
  kein_anrufgrund: 'Ohne Anrufgrund',
  gesperrt: 'Gesperrt',
}

export function nichtFiltern(zeilen: readonly GesperrtZeile[], filter: NichtFilter): GesperrtZeile[] {
  return filter === 'alle' ? [...zeilen] : zeilen.filter((z) => nichtGruppe(z.grund) === filter)
}

/**
 * Leads-Ansicht „Ohne Telefonnummer“ (`/leads?ansicht=ohne_nummer`) – erst verlinken, wenn die System-Ansicht existiert
 * (Wunsch an M2/Integration: runde3-wuensche/telefon-email.md). Bis dahin führt der Primärknopf in die gefilterte Liste hier.
 */
export const ANSICHT_OHNE_NUMMER = 'ohne_nummer'
export function leadsOhneNummerPfad(zustaendig: 'me' | 'alle'): string | null {
  if (!SYSTEM_ANSICHTEN.some((a) => a.key === ANSICHT_OHNE_NUMMER)) return null
  const q = new URLSearchParams({ ansicht: ANSICHT_OHNE_NUMMER })
  if (zustaendig === 'me') q.set('zustaendig', 'me')
  return `${PFADE.leads}?${q.toString()}`
}
