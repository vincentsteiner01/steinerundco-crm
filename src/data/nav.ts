// BAUPLAN § 3.1.5/§ 3.1.6 nav.ts: useNavZaehler() – heute = fällig + überfällig der angemeldeten Person; leads = aktive Leads;
// telefon = fällige Rückrufe + fällige Telefon-Schritte; email = fällige E-Mail-Schritte. Quelle: v_today_queue + v_pipeline_counts.
import { useAuth } from '@/features/auth/authStore'
import { usePipelineCounts } from './pipelineCounts'
import { useQueueZaehler } from './queue'

export type NavZaehler = { heute: number; heuteUeberfaellig: number; leads: number; telefon: number; email: number }

export function useNavZaehler(): NavZaehler {
  const me = useAuth((s) => s.member?.user_id ?? null)
  const { data: q } = useQueueZaehler(me)
  const { data: p } = usePipelineCounts()
  const leads = p?.reduce((acc, z) => acc + (z.stage === 'beendet' ? 0 : (z.leads ?? 0)), 0) ?? 0
  return {
    heute: q?.faellig ?? 0,
    // wie der Heute-Kopf und Team (Sektion Überfällig ohne Rückrufe/Opener) – Runde 3: eine Zählweise
    heuteUeberfaellig: q?.ueberfaelligSektion ?? 0,
    leads,
    telefon: q?.telefon ?? 0,
    email: q?.email ?? 0,
  }
}
