// Einstellungen → Export & Backup (BAUPLAN § 3.9 Export.tsx, ux § 3.10 Nr. 9, E-09, E23): CSV je Tabelle über lib/csv,
// „Voll-Backup JSON“ → rpc.exportBackup → Datei steinerundco-crm-backup-<YYYY-MM-DD>.json → settings.backup = { last_at, by }.
// Backup-Karte mit `display-sm` „vor 9 Tagen“ (DESIGN-SYSTEM § 5.18); Hinweis auf das wöchentliche Server-Backup (Action).
import { Download, ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button, Skeleton, cn } from '@/components/ui'
import { toast } from '@/components/toast'
import { rpc, useMe, useMembers, useSettings, useSettingsUpdate, zeigeFehler } from '@/data'
import { downloadJson } from '@/lib/csv'
import { fmtDatum, heuteBerlin } from '@/lib/format'
import { useHotkeys } from '@/lib/keyboard'
import { berlinTag, tageDifferenz } from '@/lib/zeit'
import { Block } from './components/Formular'
import {
  ACTIONS_URL,
  BACKUP_ERINNERUNG_TAGE,
  backupAbstand,
  backupDateiname,
  EXPORT_TABELLEN,
  exportiereCsv,
  type ExportTabelle,
} from './daten/export'

export function Export() {
  const me = useMe()
  const { data: members } = useMembers()
  const { data: settings } = useSettings()
  const update = useSettingsUpdate()
  const [params, setParams] = useSearchParams()
  const [laeuft, setLaeuft] = useState<ExportTabelle | 'backup' | null>(null)
  const autoGestartet = useRef(false)

  const backup = async () => {
    if (laeuft) return
    setLaeuft('backup')
    try {
      const doc = await rpc.exportBackup()
      const tag = heuteBerlin()
      downloadJson(doc, backupDateiname(tag))
      await update.mutateAsync({
        key: 'backup',
        value: { last_at: new Date().toISOString(), by: me?.display_name ?? 'unbekannt' },
      })
      const tabellen = Object.keys(doc.tables ?? {}).length
      toast(`Backup heruntergeladen – ${tabellen} Tabellen.`)
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
      const n = await exportiereCsv(tabelle, { members: members ?? [], settings })
      toast(`CSV heruntergeladen – ${n} Zeilen.`)
    } catch (e) {
      zeigeFehler(e, () => void csv(tabelle))
    } finally {
      setLaeuft(null)
    }
  }

  // Palette-Befehl „Voll-Backup jetzt herunterladen“ kommt mit ?aktion=backup (befehle.ts)
  useEffect(() => {
    if (params.get('aktion') !== 'backup' || autoGestartet.current || !me) return
    autoGestartet.current = true
    const p = new URLSearchParams(params)
    p.delete('aktion')
    setParams(p, { replace: true })
    void backup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, me])

  useHotkeys('global', { b: () => void backup() }, [laeuft, me])

  if (!settings) return <Skeleton zeilen={4} />

  const letztes = settings.backup
  const tage = letztes ? tageDifferenz(berlinTag(letztes.last_at), heuteBerlin()) : null
  const ueberfaellig = tage === null || tage >= BACKUP_ERINNERUNG_TAGE

  return (
    <div className="grid">
      <Block
        titel="Voll-Backup JSON"
        beschreibung="Alle Tabellen in einer Datei. Wiederherstellen kommt mit dem Import-Preset „Backup“ (v1.1) – bis dahin nur Download."
      >
        <div className="rule bg-surface-raised grid gap-4 rounded-md p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <span className="label">Letztes Backup</span>
            <span className={cn('display-sm tnum font-mono', ueberfaellig ? 'text-overdue' : 'text-ink-bright')}>
              {letztes ? backupAbstand(letztes.last_at) : 'noch nie'}
            </span>
            <span className="text-small text-ink-3 tnum">
              {letztes ? `${fmtDatum(letztes.last_at)} (${letztes.by})` : 'Heute erinnert ab 7 Tagen.'}
            </span>
          </div>
          <Button variante="primary" icon={Download} kbd="B" busy={laeuft === 'backup'} onClick={() => void backup()}>
            Voll-Backup JSON
          </Button>
        </div>
        <p className="text-small text-ink-3">
          Zusätzlich sichert eine wöchentliche Action die Datenbank verschlüsselt (90 Tage Artefakt).{' '}
          <a
            href={ACTIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-2 hover:text-ink inline-flex items-center gap-1 underline underline-offset-4"
          >
            Actions-Tab öffnen
            <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
          </a>
        </p>
      </Block>

      <Block
        titel="CSV je Tabelle"
        beschreibung="UTF-8 mit BOM, Semikolon, Datum DD.MM.YYYY – öffnet direkt in Excel und Numbers."
      >
        <ul className="grid">
          {EXPORT_TABELLEN.map((t) => (
            <li key={t.key} className="hairline flex min-h-12 items-center justify-between gap-4 py-2 last:border-b-0">
              <div className="grid gap-0.5">
                <span className="text-ui text-ink">{t.label}</span>
                <span className="text-small text-ink-3">{t.hinweis}</span>
              </div>
              <Button
                variante="secondary"
                groesse="S"
                icon={Download}
                busy={laeuft === t.key}
                disabled={laeuft !== null && laeuft !== t.key}
                onClick={() => void csv(t.key)}
                aria-label={`${t.label} als CSV herunterladen`}
              >
                CSV
              </Button>
            </li>
          ))}
        </ul>
      </Block>
    </div>
  )
}
