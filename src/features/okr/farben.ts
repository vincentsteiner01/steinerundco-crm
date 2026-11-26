// Farben der Ampel im Reiter „Ziele“: geschafft/im Plan grün, knapp gelb, hinten/verfehlt rot, offen grau.
// Eigene Datei, damit die Bausteine (Balken, Ring, Marke) nur Komponenten exportieren.
import type { Status } from './rechnen'

export const STATUS_STIL: Record<Status, { balken: string; ring: string; marke: string }> = {
  geschafft: { balken: 'bg-done', ring: 'stroke-done', marke: 'bg-done text-signal-ink' },
  im_plan: { balken: 'bg-done', ring: 'stroke-done', marke: 'bg-done-tint text-done' },
  knapp: { balken: 'bg-tag-gelb-ink', ring: 'stroke-tag-gelb-ink', marke: 'bg-tag-gelb text-tag-gelb-ink' },
  hinten: { balken: 'bg-danger', ring: 'stroke-danger', marke: 'bg-danger-tint text-danger' },
  verfehlt: { balken: 'bg-danger', ring: 'stroke-danger', marke: 'bg-danger-tint text-danger' },
  offen: { balken: 'bg-ink-4', ring: 'stroke-ink-4', marke: 'bg-tag-grau text-tag-grau-ink' },
}
