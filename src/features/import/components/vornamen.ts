// Anrede-Vorschlag aus einer kurzen Vornamenliste (ux § 2.1: „Vorbelegung aus Vornamenliste als Vorschlag, nie stillschweigend“).
// Nur ein Vorschlag – die Person bestätigt je Zeile mit H / F / –.
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

export function anredeVorschlag(first_name: string | null | undefined): Salutation | null {
  if (!first_name) return null
  const v = first_name.trim().toLowerCase().split(/[\s-]/)[0] ?? ''
  if (HERR.has(v)) return 'herr'
  if (FRAU.has(v)) return 'frau'
  return null
}
