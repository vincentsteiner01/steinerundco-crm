// Einklapp-Zustand je Sektion (ux § 3.1.1 Nr. 4): localStorage 'crm.heute.sektion.<key>'; „Später“ ist standardmäßig eingeklappt.
import { useCallback, useState } from 'react'
import type { UiSektion } from '@/types/domain'
import { SEKTIONEN } from './sektionen'
import { lies, schreibe, SPEICHER } from './speicher'

const STANDARD_EINGEKLAPPT: ReadonlySet<UiSektion> = new Set(['spaeter'])

function liesAlle(): Set<UiSektion> {
  const out = new Set<UiSektion>()
  for (const s of SEKTIONEN) {
    const w = lies(SPEICHER.sektion(s))
    if (w === 'zu' || (w === null && STANDARD_EINGEKLAPPT.has(s))) out.add(s)
  }
  return out
}

export function useEingeklappt(): { eingeklappt: ReadonlySet<UiSektion>; toggle: (s: UiSektion) => void } {
  const [eingeklappt, setEingeklappt] = useState<Set<UiSektion>>(liesAlle)
  const toggle = useCallback((s: UiSektion) => {
    setEingeklappt((alt) => {
      const neu = new Set(alt)
      if (neu.has(s)) neu.delete(s)
      else neu.add(s)
      schreibe(SPEICHER.sektion(s), neu.has(s) ? 'zu' : 'auf')
      return neu
    })
  }, [])
  return { eingeklappt, toggle }
}
