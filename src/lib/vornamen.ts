// Anrede aus dem Vornamen raten (25.11.2026, Board: „Lead hinzufügen“ fragt nur Vorname, Nachname und LinkedIn-Link – die Anrede
// für spätere E-Mails soll trotzdem meistens stimmen). Liste aus dem alten Schnellimport (Archiv: features/import/components/vornamen.ts).
// Nur ein Vorschlag: unbekannte Vornamen bleiben `neutral`, im Lead-Blatt lässt sich die Anrede korrigieren.
import type { Salutation } from '@/types/domain'

const HERR = new Set(
  'alexander andreas andré arne axel benjamin bernd björn carsten christian christoph christopher daniel david dennis dirk dominik eike erik fabian felix florian frank frederik georg gerd gerhard hannes hans harald heiko heinz helmut hendrik henning holger ingo jan jens joachim jochen johannes jonas jörg jürgen julian kai karl karsten kevin klaus konstantin lars leon lukas lutz malte manuel marc marcel marco marcus mario mark markus martin mathias matthias max maximilian michael mike moritz niklas nils norbert olaf ole oliver patrick paul peter philipp rainer ralf rené robert roland rolf sascha sebastian simon stefan steffen stephan sven thomas thorsten tim timo tobias tom torsten ulrich uwe volker werner wolfgang'.split(
    ' ',
  ),
)
const FRAU = new Set(
  'alexandra andrea angelika anja anke anna anne annika antje astrid barbara bettina birgit britta carina carolin christina christine claudia cornelia daniela diana doris elke eva franziska frauke gabriele gisela hannah heike helga ilona ines inga ingrid iris jana janina jasmin jennifer jessica judith julia jutta karin katharina kathrin katja katrin kerstin kirsten laura lea lena lisa maike manuela maren maria marina marion martina melanie michaela miriam monika nadine nicole nina petra pia ramona regina renate sabine sandra sarah silke simone sonja stefanie stephanie susanne svenja tanja tina ulrike ursula ute vanessa vera verena yvonne'.split(
    ' ',
  ),
)

/** `herr` / `frau`, wenn der (erste) Vorname in der Liste steht – sonst `null`. */
export function anredeVorschlag(first_name: string | null | undefined): Salutation | null {
  if (!first_name) return null
  const v = first_name.trim().toLowerCase().split(/[\s-]/)[0] ?? ''
  if (HERR.has(v)) return 'herr'
  if (FRAU.has(v)) return 'frau'
  return null
}

/** Anrede für eine neue Karte: Vorschlag aus dem Vornamen, sonst `neutral`. */
export function anredeAusVorname(first_name: string | null | undefined): Salutation {
  return anredeVorschlag(first_name) ?? 'neutral'
}
