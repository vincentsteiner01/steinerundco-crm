// Lead-Aktionen (BAUPLAN § 3.1.10b) – von M1–M4 benutzt. Props-Vertrag: AktionProps.
export type { AktionProps } from './_gemeinsam'
export { AntwortErhalten, type AntwortErhaltenProps } from './AntwortErhalten'
export { Beenden } from './Beenden'
export { Spaeter, type SpaeterProps } from './Spaeter'
export { Wiedervorlage } from './Wiedervorlage'
export { TerminEintragen, type TerminEintragenProps } from './TerminEintragen'
export { Uebergeben } from './Uebergeben'
export { Freigeben } from './Freigeben'
export { Uebernehmen } from './Uebernehmen'
export { NotizFeld, type NotizFeldProps } from './NotizFeld'
export { WiderspruchErfassen, type WiderspruchErfassenProps } from './WiderspruchErfassen'
export { ZustaendigWaehlen, FREI, type ZustaendigWaehlenProps } from './ZustaendigWaehlen'
export { REAKTION_CHIPS, vorlageFuerChip, chipBlockiert, type ReaktionChip } from './reaktionen'
export {
  beendenGruende,
  FREIGABE_GRUND,
  FREIGABE_PER_TABELLE,
  willKeineNachrichten,
  type BeendenGrund,
} from './gruende'
export { spaeterOptionen, spaeterWann, type SpaeterOption } from './spaeterOptionen'
