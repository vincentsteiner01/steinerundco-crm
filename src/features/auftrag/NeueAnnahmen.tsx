// „Neue Annahmen eintragen“: der Agent fügt die Personen ein, die auf LinkedIn neu vernetzt sind (eine pro Zeile).
// Gleiche Grammatik wie der Schnellimport; neue Personen werden angelegt, bekannte über die LinkedIn-URL erkannt,
// und alle bekommen „angenommen“ – das startet ihre Opener-Sequenz (Trigger, nur bei der ersten Annahme).
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Textarea } from '@/components/ui'
import { zeigeFehler } from '@/data/errors'
import { ladeLeadSeite } from '@/data/leads'
import { qk } from '@/data/queryKeys'
import { rpc } from '@/data/rpc'
import { fmtDatum, heuteBerlin } from '@/lib/format'
import type { Json } from '@/types/database'
import { parseSchnellimport } from '@/features/import/parser/schnellimport'
import { sendbar, zeileZuRow } from '@/features/import/parser/zeile'
import { annahmenText, type AnnahmenErgebnis } from './auftrag'

export function NeueAnnahmen({ me, onFertig }: { me: string | null; onFertig: () => void }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [ergebnis, setErgebnis] = useState<AnnahmenErgebnis | null>(null)

  const zeilen = useMemo(() => parseSchnellimport(text).zeilen.filter(sendbar), [text])
  const ohneUrl = zeilen.filter((z) => z.url_art !== 'person').length
  const ohneAnrede = zeilen.filter((z) => !z.salutation || z.salutation === 'neutral').length

  const eintragen = async () => {
    if (!zeilen.length || !me) return
    setLaeuft(true)
    try {
      const heute = heuteBerlin()
      const e = await rpc.importLeads({
        rows: zeilen.map((z) => zeileZuRow(z, z.salutation ?? null)) as unknown as Json,
        owner: me,
        source: 'schnellimport',
        label: `Auftragsseite · ${fmtDatum(heute)}`,
        dryRun: false,
      })
      const neueIds = e.batch_id ? (await ladeLeadSeite({ quelle: e.batch_id }, 0, me)).zeilen.map((l) => l.id) : []
      const bekannteIds = e.rows
        .filter((r) => r.status === 'duplikat' && r.existing_id)
        .map((r) => r.existing_id as string)
      const uebersprungen = e.rows
        .filter((r) => r.status === 'gesperrt' || r.status === 'ungueltig' || r.status === 'archiv')
        .map(
          (r) =>
            `${r.name} (${r.status === 'gesperrt' ? 'gesperrt' : r.status === 'archiv' ? 'beendet' : 'unvollständig'})`,
        )
      let angenommen = 0
      for (const leadId of [...neueIds, ...bekannteIds]) {
        try {
          await rpc.markAccepted({ leadId, memberId: me, date: heute })
          angenommen += 1
        } catch (err) {
          zeigeFehler(err)
        }
      }
      for (const key of [qk.leads.all, qk.queue.all, qk.kpis.all, qk.imports.all, qk.nav, qk.companies])
        void qc.invalidateQueries({ queryKey: key })
      setErgebnis({ neu: neueIds.length, bekannt: bekannteIds.length, angenommen, uebersprungen })
      setText('')
      onFertig()
    } catch (err) {
      zeigeFehler(err)
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="grid max-w-[72ch] gap-2.5" data-auftrag-annahmen>
      <label className="label" htmlFor="neue-annahmen">
        Neue Annahmen eintragen – eine Person pro Zeile
      </label>
      <Textarea
        id="neue-annahmen"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setErgebnis(null)
        }}
        rows={6}
        className="font-mono text-[13px]"
        placeholder={
          'Herr Max Beispiel | Beispiel Solar GmbH | https://www.linkedin.com/in/max-beispiel\nFrau Anna Muster | Muster Energie | https://www.linkedin.com/in/anna-muster'
        }
      />
      <div className="text-ink-3 text-small flex flex-wrap gap-x-3" aria-live="polite">
        <span>{zeilen.length} Personen erkannt</span>
        {ohneUrl ? <span className="text-overdue">{ohneUrl} ohne LinkedIn-Link</span> : null}
        {ohneAnrede ? <span>{ohneAnrede} ohne Herr/Frau – die Anrede wird später beim Opener gewählt</span> : null}
      </div>
      <div>
        <Button
          variante="primary"
          groesse="M"
          busy={laeuft}
          disabled={!zeilen.length || laeuft}
          disabledGrund={!zeilen.length ? 'Erst Personen einfügen' : undefined}
          onClick={() => void eintragen()}
        >
          Eintragen
        </Button>
      </div>
      {ergebnis ? (
        <p className="text-done text-[13.5px]" role="status">
          {annahmenText(ergebnis)} Die Opener stehen jetzt unten unter „Opener senden“.
        </p>
      ) : null}
    </div>
  )
}
