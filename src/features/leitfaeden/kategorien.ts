// Leitfäden-Übersicht nach Mikes Sales Hub (23.10.2026): drei Bereiche, darin Kategorien als Abschnitte mit Karten.
// Telefon & Sales = Mikes vier Kategorien (Telefonakquise = alle Telefon-Phasen, dazu Erstgespräch, Strategiegespräch,
// Einwandbehandlung, Angebot); LinkedIn und E-Mail = ihre Phasen. Die Phase bleibt am Leitfaden (Anruf-Skript, Sequenzen).
import type { Channel, Template, TemplatePhase } from '@/types/domain'
import { labelTeile, PHASEN, phaseDef } from './phasen'

export type Bereich = 'telefon' | 'linkedin' | 'email'

export const BEREICHE_UEBERSICHT: readonly { key: Bereich; label: string; kanaele: readonly Channel[] }[] = [
  { key: 'telefon', label: 'Telefon & Sales', kanaele: ['telefon', 'sonstiges'] },
  { key: 'linkedin', label: 'LinkedIn', kanaele: ['linkedin'] },
  { key: 'email', label: 'E-Mail', kanaele: ['email'] },
]

/** `?kanal=` → Bereich (telefon/sonstiges → Telefon & Sales; ohne Angabe LinkedIn wie bisher). */
export function bereichAusParam(kanal: string | null): Bereich {
  if (kanal === 'telefon' || kanal === 'sonstiges') return 'telefon'
  if (kanal === 'email') return 'email'
  return 'linkedin'
}

export type Kategorie = {
  key: string
  label: string
  beschreibung: string
  kanal: Channel
  phasen: readonly TemplatePhase[]
}

const ohneZiffer = (label: string) => labelTeile(label).text

export function kategorienFuer(b: Bereich): Kategorie[] {
  if (b === 'telefon')
    return [
      {
        key: 'telefonakquise',
        label: 'Telefonakquise',
        beschreibung: 'Kaltakquise: Zentrale, Einstieg, Einwände, Mailbox',
        kanal: 'telefon',
        phasen: PHASEN.telefon.map((p) => p.key),
      },
      ...PHASEN.sonstiges.map((p) => ({
        key: p.key,
        label: p.label,
        beschreibung: p.beschreibung,
        kanal: 'sonstiges' as const,
        phasen: [p.key],
      })),
    ]
  const kanal: Channel = b
  return PHASEN[kanal].map((p) => ({
    key: p.key,
    label: ohneZiffer(p.label),
    beschreibung: p.beschreibung,
    kanal,
    phasen: [p.key],
  }))
}

export const gehoertZu = (t: Pick<Template, 'channel' | 'phase'>, k: Kategorie): boolean =>
  t.channel === k.kanal && k.phasen.includes(t.phase)

/** Karten einer Kategorie: aktive vor inaktiven, dann Phasen-Reihenfolge, Reihenfolge, Name. */
export function kartenVon(vorlagen: readonly Template[], k: Kategorie): Template[] {
  const rang = (p: TemplatePhase) => k.phasen.indexOf(p)
  return vorlagen
    .filter((t) => gehoertZu(t, k))
    .sort(
      (a, b) =>
        Number(b.active !== false) - Number(a.active !== false) ||
        rang(a.phase) - rang(b.phase) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.name.localeCompare(b.name, 'de'),
    )
}

/** Ziele im Editor: Kanal + Phase als ein Wert („telefon:gatekeeper“), Telefon-Phasen unter „Telefonakquise · …“. */
export type Ziel = `${Channel}:${TemplatePhase}`
export const zielWert = (kanal: Channel, phase: TemplatePhase): Ziel => `${kanal}:${phase}`
export function zielTeile(z: string): { kanal: Channel; phase: TemplatePhase } {
  const [kanal, phase] = z.split(':') as [Channel, TemplatePhase]
  return { kanal, phase }
}

export function zielOptionen(b: Bereich): { value: Ziel; label: string }[] {
  return kategorienFuer(b).flatMap((k) =>
    k.key === 'telefonakquise'
      ? k.phasen.map((p) => ({
          value: zielWert(k.kanal, p),
          label: `Telefonakquise · ${phaseDef('telefon', p).label}`,
        }))
      : k.phasen.map((p) => ({ value: zielWert(k.kanal, p), label: k.label })),
  )
}

/** Kleine Zeile über dem Titel: bei Telefonakquise die Phase („Zentrale“), sonst nichts. */
export function phaseHinweis(t: Pick<Template, 'channel' | 'phase'>): string | null {
  return t.channel === 'telefon' ? phaseDef('telefon', t.phase).label : null
}

export const BEWERTUNG_TEXT = (r: number | null | undefined): string =>
  r ? `${r} von 3 Sternen` : 'Noch nicht bewertet'
