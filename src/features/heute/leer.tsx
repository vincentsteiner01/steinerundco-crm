// Leerzustände der Heute-Seite (ux § 4.1, texte/de.ts LEER): alles erledigt · keine Daten · andere Person.
import { EmptyState } from '@/components/ui/EmptyState'
import { LEER } from '@/texte/de'

export type HeuteLeerProps =
  | { art: 'erledigt'; naechster: string | null; onLeads: () => void; onListe: () => void }
  | { art: 'keineDaten'; onSchnellimport: () => void; onSheets: () => void }
  | { art: 'anderePerson'; name: string; onZurueck: () => void }

export function HeuteLeer(p: HeuteLeerProps) {
  if (p.art === 'erledigt')
    return (
      <EmptyState
        titel={LEER.heuteErledigt.titel}
        satz={p.naechster ?? undefined}
        primaer={{ label: LEER.heuteErledigt.aktion, onClick: p.onLeads }}
        sekundaer={{ label: 'Liste einfügen', onClick: p.onListe, kbd: '⌘⇧O' }}
      />
    )
  if (p.art === 'keineDaten')
    return (
      <EmptyState
        titel={LEER.heuteKeineDaten.titel}
        satz={LEER.heuteKeineDaten.satz}
        primaer={{ label: LEER.heuteKeineDaten.aktion, onClick: p.onSchnellimport, kbd: '⌘⇧O' }}
        sekundaer={{ label: LEER.heuteKeineDaten.sekundaer, onClick: p.onSheets }}
      />
    )
  const t = LEER.heuteAnderePerson(p.name)
  return <EmptyState titel={t.titel} primaer={{ label: t.aktion, onClick: p.onZurueck }} />
}
