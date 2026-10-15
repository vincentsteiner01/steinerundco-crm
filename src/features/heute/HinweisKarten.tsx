// Hinweis-Karten (ux § 3.1.1 Nr. 6, BAUPLAN § 3.2 HinweisKarten.tsx): max. 2 – Wochenbudget erreicht · freigegebene Leads ·
// Annahmequote < 20 % · Backup > 7 T (H-17). „Ausblenden (heute)“ in localStorage. Amber-Text nur bei der Budget-Warnung.
import { useState } from 'react'
import { HinweisKarte } from '@/components/ui/HinweisKarte'
import { useLeads } from '@/data/leads'
import { useSettings } from '@/data/settings'
import { fmtAnteil } from '@/lib/format'
import type { LinkedinBudget } from '@/lib/gates'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import { lies, schreibe, SPEICHER } from './speicher'
import { BUDGET_ERREICHT_TEXT } from './Tageszaehler'

export type HinweisKartenProps = {
  heute: string
  budget: LinkedinBudget
  annahmeQuote7: number | null
  onFreigegeben: () => void
  onBackup: () => void
  onZiele: () => void
  className?: string
}

export const BACKUP_WARN_TAGE = 7
export const ANNAHME_WARN_UNTER = 0.2

type Hinweis = { key: string; text: string; aktion: { label: string; onClick: () => void }; warnung?: boolean }

export function HinweisKarten({
  heute,
  budget,
  annahmeQuote7,
  onFreigegeben,
  onBackup,
  onZiele,
  className,
}: HinweisKartenProps) {
  const { data: settings } = useSettings()
  const { data: frei } = useLeads({ zustaendig: 'frei' }, 0)
  const [ausgeblendet, setAusgeblendet] = useState<Set<string>>(() => new Set())

  const sichtbar = (key: string) => !ausgeblendet.has(key) && lies(SPEICHER.hinweis(key, heute)) !== 'aus'
  const ausblenden = (key: string) => {
    schreibe(SPEICHER.hinweis(key, heute), 'aus')
    setAusgeblendet((alt) => new Set([...alt, key]))
  }

  const hinweise: Hinweis[] = []
  if (budget.erreicht)
    hinweise.push({
      key: 'budget',
      text: BUDGET_ERREICHT_TEXT,
      aktion: { label: 'Ziele', onClick: onZiele },
      warnung: true,
    })
  const freiZahl = frei?.gesamt ?? 0
  if (freiZahl > 0) {
    const erster = frei?.zeilen[0]
    const wer = erster ? ` · ${erster.full_name ?? ''}${erster.company_name ? `, ${erster.company_name}` : ''}` : ''
    const grund = erster?.released_reason ? ` – „${erster.released_reason}“` : ''
    hinweise.push({
      key: 'frei',
      text: freiZahl === 1 ? `1 freigegebener Lead${wer}${grund}` : `${freiZahl} freigegebene Leads${wer}${grund}`,
      aktion: { label: 'Ansehen', onClick: onFreigegeben },
    })
  }
  if (annahmeQuote7 !== null && annahmeQuote7 < (settings?.linkedin.acceptance_warn_below ?? 20) / 100)
    hinweise.push({
      key: 'annahme',
      text: `Annahmequote ${fmtAnteil(annahmeQuote7)} (7 T) – Volumen drosseln, ICP prüfen`,
      aktion: { label: 'Ziele', onClick: onZiele },
    })
  const backupAm = settings?.backup?.last_at ? berlinTag(settings.backup.last_at) : null
  const backupTage = backupAm ? tageDifferenz(backupAm, heute) : null
  if (settings && (backupTage === null || backupTage >= BACKUP_WARN_TAGE))
    hinweise.push({
      key: 'backup',
      text:
        backupTage === null
          ? 'Noch kein Backup – jetzt sichern'
          : `Letztes Backup vor ${backupTage} Tagen – jetzt sichern`,
      aktion: { label: 'Backup', onClick: onBackup },
    })

  const zeigen = hinweise.filter((h) => sichtbar(h.key)).slice(0, 2)
  if (!zeigen.length) return null
  return (
    <div className={className} data-hinweise>
      {zeigen.map((h) => (
        <HinweisKarte
          key={h.key}
          text={h.text}
          aktion={h.aktion}
          warnung={h.warnung}
          onAusblenden={() => ausblenden(h.key)}
        />
      ))}
    </div>
  )
}
