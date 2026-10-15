// Pipeline-Drop → Beleg (ux § 3.4, P-02): der Trigger `leads_after_update` schreibt die `stage_wechsel`-Aktivität (from/to); die
// Pipeline ergänzt `metadata.via = 'pipeline'`, damit die Timeline „Phase geändert: Eröffnet → Beantwortet (per Pipeline)“ zeigt
// (texte/de.ts TIMELINE_TEXT liest `via`). Konflikt BAUPLAN § 4.3 (direkte activities-Patches nur für eigene Notizen) ↔ ux P-02
// (Wortlaut Pflicht): entschieden für den Metadaten-Patch – RLS erlaubt Mitgliedern das Update, der Trigger kennt keinen Kanal-Parameter.
// Offen (Migration, nicht Teil der Integration): Herkunft als RPC-Parameter statt Patch. Schlägt der Patch fehl, bleibt der Beleg ohne Zusatz.
import { aktivitaetMetadataErgaenzen, nachleseAktivitaet } from '@/data/activities'
import type { Activity } from '@/types/domain'

export const VIA_PIPELINE = 'pipeline'

/** Liest die gerade entstandene `stage_wechsel`-Zeile nach und markiert sie als „per Pipeline“. Rückgabe = Zeile für den Undo-Toast. */
export async function stufenwechselAlsPipeline(leadId: string): Promise<Activity | null> {
  const a = await nachleseAktivitaet(leadId, ['stage_wechsel'])
  if (!a) return null
  try {
    return await aktivitaetMetadataErgaenzen(a, { via: VIA_PIPELINE })
  } catch {
    return a
  }
}
