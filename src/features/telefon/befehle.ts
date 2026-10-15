// Vertrag (BAUPLAN § 3.1.8): `export const BEFEHLE: Befehl[]` – M3: „Call-Block starten“, „Rückruf planen für …“, „Anrufgrund setzen …“.
import type { NavigateFunction } from 'react-router'
import type { Befehl } from '@/app/befehle'
import { PFADE } from '@/app/pfade'
import { toast } from '@/components/toast'
import { zeigeFehler } from '@/data/errors'
import { ladeLead } from '@/data/leads'
import { queryClient } from '@/data/queryClient'
import { qk } from '@/data/queryKeys'
import { ladeSperrliste } from '@/data/sperrliste'
import { sperrlistenEintraege, telefonGate } from '@/lib/gates'
import { GATE_GRUND_LABEL } from '@/texte/de'

/**
 * „Anrufen ⌘⇧K“ aus der Palette nur mit offenem Telefon-Gate (§ 8.2 Nr. 2): ohne Anrufgrund, mit Sperrliste/Widerspruch/Firmensperre
 * kommt der Grund als Toast statt des Anruf-Screens (Review). Lead und Sperrliste aus dem Cache, sonst frisch geladen.
 */
export async function anrufenGeprueft(navigate: NavigateFunction, leadId: string): Promise<void> {
  try {
    const [lead, sperrliste] = await Promise.all([
      queryClient.fetchQuery({ queryKey: qk.leads.detail(leadId), queryFn: () => ladeLead(leadId), staleTime: 10_000 }),
      queryClient.fetchQuery({ queryKey: qk.sperrliste, queryFn: ladeSperrliste, staleTime: 30_000 }),
    ])
    const g = telefonGate(lead, sperrlistenEintraege(sperrliste, lead))
    if (g.erlaubt) navigate(PFADE.anruf(leadId))
    else toast(GATE_GRUND_LABEL[g.grund ?? 'keine_nummer'])
  } catch (e) {
    zeigeFehler(e)
  }
}

export const BEFEHLE: Befehl[] = [
  {
    id: 'telefon:callblock',
    label: 'Call-Block starten',
    gruppe: 'aktionen',
    tasten: ['G T', '↵'],
    ausfuehren: ({ navigate }) => navigate(`${PFADE.telefon}?block=start`),
  },
  {
    id: 'telefon:anrufen',
    label: 'Anrufen',
    gruppe: 'aktionen',
    tasten: ['⌘⇧K'],
    sichtbar: ({ leadId }) => !!leadId,
    ausfuehren: ({ navigate, leadId }) => {
      if (leadId) void anrufenGeprueft(navigate, leadId)
    },
  },
  {
    id: 'telefon:rueckruf',
    label: 'Rückruf planen für …',
    gruppe: 'aktionen',
    sichtbar: ({ leadId }) => !!leadId,
    ausfuehren: ({ navigate, leadId }) => {
      if (leadId) navigate(`${PFADE.telefon}?rueckruf=${encodeURIComponent(leadId)}`)
    },
  },
  {
    id: 'telefon:anrufgrund',
    label: 'Anrufgrund setzen …',
    gruppe: 'aktionen',
    // BAUPLAN nennt den Befehl in M2 und M3 – Integration: auf /telefon setzt ihn die Anrufliste (`?anrufgrund=`),
    // überall sonst der Peek (features/leads/befehle.ts). Nie beide gleichzeitig in der Palette.
    sichtbar: ({ leadId }) => !!leadId && window.location.pathname.startsWith(PFADE.telefon),
    ausfuehren: ({ navigate, leadId }) => {
      if (leadId) navigate(`${PFADE.telefon}?anrufgrund=${encodeURIComponent(leadId)}`)
    },
  },
]
