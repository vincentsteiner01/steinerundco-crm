// Einstellungen → Export & Backup (BAUPLAN § 3.9 Export.tsx, E-09): Voll-Backup (rpc.exportBackup → Datei
// steinerundco-crm-backup-<YYYY-MM-DD>.json → settings.backup = { last_at, by }) und CSV-Downloads über lib/csv.
// Neustart 25.11.2026: nur noch Leads und Einzelmails als CSV; die Taste B und ?aktion=backup sind mit der Befehlspalette
// entfallen. Fehlt settings.backup oder lädt settings gar nicht, bleibt die Seite benutzbar – gerade dann will man sichern.
import { Download, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { toast, toastFehler } from '@/components/toast'
import { rpc, useMe, useMembers, useSettings, useSettingsUpdate, zeigeFehler } from '@/data'
import { downloadJson } from '@/lib/csv'
import { fmtDatum, heuteBerlin } from '@/lib/format'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import { Block } from './components/Formular'
import {
  ACTIONS_URL,
  BACKUP_ALT_AB_TAGE,
  backupAbstand,
  backupDateiname,
  EXPORT_TABELLEN,
  exportiereCsv,
  type ExportTabelle,
} from './daten/export'

/** Zeitpunkt des Backups – als Funktion außerhalb der Komponente (oxlint react/purity sieht `Date` sonst im Render). */
const zeitstempel = (): string => new Date().toISOString()

export function Export() {
  const me = useMe()
  const { data: members } = useMembers()
  const { data: settings, isPending } = useSettings()
  const update = useSettingsUpdate()
  const [laeuft, setLaeuft] = useState<ExportTabelle | 'backup' | null>(null)

  const backup = async () => {
    if (laeuft) return
    setLaeuft('backup')
    try {
      const doc = await rpc.exportBackup()
      // Eine leere Antwort ist kein Backup: nichts herunterladen und „Letztes Backup“ nicht auf heute stellen
      if (!doc?.tables) {
        toastFehler('Das Backup kam leer zurück.', () => void backup())
        return
      }
      downloadJson(doc, backupDateiname(heuteBerlin()))
      await update.mutateAsync({
        key: 'backup',
        value: { last_at: zeitstempel(), by: me?.display_name ?? 'unbekannt' },
      })
      toast(`Backup heruntergeladen – ${Object.keys(doc.tables).length} Tabellen.`)
    } catch (e) {
      zeigeFehler(e, () => void backup())
    } finally {
      setLaeuft(null)
    }
  }

  const csv = async (tabelle: ExportTabelle) => {
    if (laeuft) return
    setLaeuft(tabelle)
    try {
      const n = await exportiereCsv(tabelle, { members: members ?? [] })
      toast(`CSV heruntergeladen – ${n} Zeilen.`)
    } catch (e) {
      zeigeFehler(e, () => void csv(tabelle))
    } finally {
      setLaeuft(null)
    }
  }

  const letztes = settings?.backup
  const tage = letztes ? tageDifferenz(berlinTag(letztes.last_at), heuteBerlin()) : null
  const alt = !!settings && (tage === null || tage >= BACKUP_ALT_AB_TAGE)
  const abstand = letztes ? backupAbstand(letztes.last_at) : settings ? 'noch nie' : isPending ? '…' : 'unbekannt'

  return (
    <div className="grid">
      <Block
        titel="Voll-Backup"
        beschreibung="Leads, Leitfäden, Einzelmails und Einstellungen in einer Datei. Kampagnen und Postfächer sind nicht enthalten."
      >
        <div className="rule bg-surface-raised grid gap-4 rounded-md p-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1">
            <span className="text-small text-ink-2 font-medium">Letztes Backup</span>
            <span className={cn('text-display-sm tnum', alt ? 'text-overdue' : 'text-ink-bright')}>{abstand}</span>
            {letztes ? (
              <span className="text-small text-ink-3 tnum">
                {fmtDatum(letztes.last_at)} ({letztes.by})
              </span>
            ) : null}
          </div>
          <Button
            variante="primary"
            groesse="L"
            icon={Download}
            busy={laeuft === 'backup'}
            disabled={laeuft !== null && laeuft !== 'backup'}
            onClick={() => void backup()}
          >
            Backup herunterladen
          </Button>
        </div>
        <p className="text-small text-ink-3">
          Die Datenbank wird außerdem jede Woche automatisch gesichert.{' '}
          <a
            href={ACTIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-2 hover:text-ink inline-flex items-center gap-1 underline underline-offset-4"
          >
            Sicherungen auf GitHub
            <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
          </a>
        </p>
      </Block>

      <Block titel="Als Tabelle" beschreibung="CSV – öffnet direkt in Excel und Numbers.">
        <ul className="grid">
          {EXPORT_TABELLEN.map((t) => (
            <li
              key={t.key}
              className="hairline flex min-h-16 items-center justify-between gap-4 py-2.5 last:border-b-0"
            >
              <div className="grid min-w-0 gap-0.5">
                <span className="text-body text-ink">{t.label}</span>
                <span className="text-small text-ink-3">{t.hinweis}</span>
              </div>
              <Button
                groesse="L"
                icon={Download}
                busy={laeuft === t.key}
                disabled={laeuft !== null && laeuft !== t.key}
                onClick={() => void csv(t.key)}
                aria-label={`${t.label} als CSV herunterladen`}
              >
                Herunterladen
              </Button>
            </li>
          ))}
        </ul>
      </Block>
    </div>
  )
}
