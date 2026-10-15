// BAUPLAN § 3.3 `LeadNeuSeite.tsx` (ux § 3.2.5): LeadsSeite + Sheet (640 px, mobil Vollbild) mit LeadForm; Vorbelegung aus
// `?vorname=&nachname=&unternehmen=&url=`; ⌘Enter speichert + Peek (`/leads?lead=<id>`), ⌘⇧Enter speichert + nächster (Formular leer).
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { toast } from '@/components/toast'
import { Sheet } from '@/components/ui/Sheet'
import type { LeadInsert } from '@/types/domain'
import { LeadForm } from './LeadForm'
import { LeadsSeite } from './LeadsSeite'

export function Component() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [runde, setRunde] = useState(0)
  const vorbelegung: Partial<LeadInsert> = {
    first_name: params.get('vorname') ?? undefined,
    last_name: params.get('nachname') ?? undefined,
    company_name: params.get('unternehmen') ?? undefined,
    linkedin_url: params.get('url') ?? undefined,
  }
  return (
    <LeadsSeite
      kinder={
        <Sheet offen onOpenChange={(o) => !o && navigate(PFADE.leads)} titel="Lead anlegen" breite={640}>
          <LeadForm
            key={runde}
            vorbelegung={runde === 0 ? vorbelegung : undefined}
            onAbbrechen={() => navigate(PFADE.leads)}
            onGespeichert={(id, weiter) => {
              if (weiter) {
                toast('Lead angelegt – nächster.')
                setRunde((r) => r + 1)
              } else navigate(`${PFADE.leads}?lead=${encodeURIComponent(id)}`)
            }}
          />
        </Sheet>
      }
    />
  )
}
