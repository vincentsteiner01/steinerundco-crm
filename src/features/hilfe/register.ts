// Tastenregister fürs Handbuch: src/app/tasten.ts (Quelle des `?`-Overlays) + Hilfe-Gruppe + globale Tasten, die GlobaleTasten
// belegt, die Registry aber (noch) nicht nennt. Doppelte Gruppen/Tasten fallen weg, sobald die Integration sie aufnimmt.
import { TASTEN as APP_TASTEN, type TastenGruppe } from '@/app/tasten'
import { TASTEN as HILFE_TASTEN } from './tasten'

export const ERGAENZUNG: TastenGruppe = {
  gruppe: 'Weitere globale Tasten',
  eintraege: [
    { tasten: ['G A'], beschreibung: 'Team' },
    { tasten: ['G S'], beschreibung: 'Hilfe' },
    { tasten: ['G B'], beschreibung: 'Feedback-Liste' },
    { tasten: ['⌥F'], beschreibung: 'Feedback geben' },
  ],
}

export function tastenRegister(app: readonly TastenGruppe[] = APP_TASTEN): TastenGruppe[] {
  const gruppen = [...app]
  for (const g of HILFE_TASTEN) if (!gruppen.some((a) => a.gruppe === g.gruppe)) gruppen.push(g)
  const belegt = new Set(gruppen.flatMap((g) => g.eintraege.flatMap((e) => e.tasten)))
  const fehlend = ERGAENZUNG.eintraege.filter((e) => !e.tasten.some((t) => belegt.has(t)))
  if (fehlend.length) gruppen.push({ ...ERGAENZUNG, eintraege: fehlend })
  return gruppen.filter((g) => g.eintraege.length > 0)
}
