// Aktion an einer Tabellenzeile (Inline-Phase → Pflichtdialog, Tasten B S W T ⌘⇧U ⌘⇧F auf der Cursor-Zeile): die M0-Aktion wird
// kontrolliert geöffnet, der Anker (Popover-Trigger) sitzt in der Name-Zelle der Zeile. Dialog-Aktionen brauchen keinen Anker.
import { Beenden, Freigeben, Spaeter, TerminEintragen, Uebergeben, Wiedervorlage } from '@/components/aktionen'
import { useLead } from '@/data/leads'
import type { Lead } from '@/types/domain'

export type ZeilenAktionArt = 'termin' | 'beenden' | 'wiedervorlage' | 'spaeter' | 'uebergeben' | 'freigeben'

export type ZeilenAktionProps = {
  lead: Pick<Lead, 'id'>
  art: ZeilenAktionArt
  terminTyp?: 'erstgespraech' | 'strategiegespraech'
  onFertig: () => void
}

export function ZeilenAktion({ lead, art, terminTyp = 'erstgespraech', onFertig }: ZeilenAktionProps) {
  const { data: voll } = useLead(art === 'spaeter' ? lead.id : null)
  const aktivesEnrollment = voll?.enrollments?.find((e) => e.status === 'aktiv')
  const offeneAufgabe = voll?.tasks?.find((t) => t.status === 'offen')
  const anker = <span className="absolute bottom-0 left-2 h-px w-px" aria-hidden data-zeilen-anker />
  const schliessen = (o: boolean) => {
    if (!o) onFertig()
  }
  switch (art) {
    case 'termin':
      return (
        <TerminEintragen
          leadId={lead.id}
          typ={terminTyp}
          offen
          onOpenChange={schliessen}
          onFertig={onFertig}
          trigger={anker}
        />
      )
    case 'beenden':
      return <Beenden leadId={lead.id} offen onOpenChange={schliessen} onFertig={onFertig} trigger={anker} />
    case 'wiedervorlage':
      return <Wiedervorlage leadId={lead.id} offen onOpenChange={schliessen} onFertig={onFertig} trigger={anker} />
    case 'spaeter':
      return (
        <Spaeter
          leadId={lead.id}
          enrollmentId={aktivesEnrollment?.id ?? null}
          taskId={offeneAufgabe?.id ?? null}
          faelligAm={aktivesEnrollment ? aktivesEnrollment.next_due_at : (offeneAufgabe?.due_at ?? null)}
          offen
          onOpenChange={schliessen}
          onFertig={onFertig}
          trigger={anker}
        />
      )
    case 'uebergeben':
      return <Uebergeben leadId={lead.id} offen onOpenChange={schliessen} onFertig={onFertig} trigger={anker} />
    case 'freigeben':
      return <Freigeben leadId={lead.id} offen onOpenChange={schliessen} onFertig={onFertig} trigger={anker} />
  }
}
