// BAUPLAN § 7.5: Klick auf eine Funnel-Ziffer → /leads mit Ereignis-Filter (features/leads/filter.ts → ereignisAusUrl,
// data/leads.ts → `!inner`-Embeds). Integration M2/M5 (K-05): Ereignisse filtern nach der Person des Ereignisses (`person`),
// nicht nach Zuständigkeit; `kanal=linkedin` entfällt (verlangte eine aktive LinkedIn-Sequenz). Kunden: Phase, Zuständigkeit.
import { PFADE } from '@/app/pfade'
import type { FunnelZeile } from './kennzahlen'

export type LeadsKontext = { von: string; bis: string; member: string | 'team' }

export function leadsUrl(filter: FunnelZeile['leads'], ctx: LeadsKontext): string | null {
  if (!filter) return null
  const p = new URLSearchParams()
  if (filter === 'kunde') {
    p.set('phase', 'kunde')
    if (ctx.member !== 'team') p.set('zustaendig', ctx.member)
    return `${PFADE.leads}?${p.toString()}`
  }
  if (filter === 'anfragen') p.set('quelle', 'anfragen')
  else if (filter === 'angenommen') p.set('quelle', 'angenommen')
  else if (filter === 'termine' || filter.startsWith('termine:')) {
    p.set('ansicht', 'termine')
    const typ = filter.slice('termine:'.length)
    if (filter !== 'termine') p.set('termin', typ)
  } else p.set('ereignis', filter.slice('ereignis:'.length))
  p.set('von', ctx.von)
  p.set('bis', ctx.bis)
  if (ctx.member !== 'team') p.set('person', ctx.member)
  return `${PFADE.leads}?${p.toString()}`
}
