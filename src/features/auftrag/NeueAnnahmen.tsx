// „Neue Annahmen eintragen“: der Agent fügt die Personen ein, die auf LinkedIn neu vernetzt sind (eine pro Zeile).
// Gleiche Grammatik wie der Schnellimport; neue Personen werden angelegt, bekannte über die LinkedIn-URL erkannt,
// und alle bekommen „angenommen“ – das startet ihre Opener-Sequenz (Trigger, nur bei der ersten Annahme).
// 16.10.2026: Nach 18 von 37 Annahmen brach die Verbindung des Agenten ab; die Schleife hing ohne Zeitlimit, es kam kein
// Ergebnis. Jetzt Zeitlimit + Wiederholung je Annahme, Fortschritt sichtbar, und bei Fehlern bleibt die Liste im Feld –
// ein zweites „Eintragen“ ist sicher (Bekannte per URL erkannt, mark_accepted bucht nichts doppelt).
// 23.10.2026 (Vincent: „KPIs gehen noch nicht“): `art="anfrage"` = „Neue Anfragen eintragen“ – gesendete Einladungen von
// LinkedIn; log_request zählt jede einmal bei „Vernetzungen versendet“. Leads mit schon bestehender Verbindung werden
// übersprungen (log_request würde deren Variante überschreiben), dadurch zählt auch ein zweiter Durchgang nichts doppelt.
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Textarea } from '@/components/ui'
import { zeigeFehler } from '@/data/errors'
import { ladeVerbundeneLeads } from '@/data/connections'
import { ladeLeadSeite } from '@/data/leads'
import { qk } from '@/data/queryKeys'
import { rpc } from '@/data/rpc'
import { mitWiederholung, mitZeitlimit } from '@/data/wiederholen'
import { fmtDatum, heuteBerlin } from '@/lib/format'
import type { Json } from '@/types/database'
import { parseSchnellimport } from '@/features/import/parser/schnellimport'
import { sendbar, zeileZuRow } from '@/features/import/parser/zeile'
import { anfragenText, annahmenText, type AnfragenErgebnis, type AnnahmenErgebnis } from './auftrag'

export function NeueAnnahmen({
  me,
  onFertig,
  art = 'annahme',
}: {
  me: string | null
  onFertig: () => void
  art?: 'annahme' | 'anfrage'
}) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fortschritt, setFortschritt] = useState<{ fertig: number; gesamt: number } | null>(null)
  const [ergebnis, setErgebnis] = useState<AnnahmenErgebnis | null>(null)
  const [anfragen, setAnfragen] = useState<AnfragenErgebnis | null>(null)
  const anfrage = art === 'anfrage'

  const zeilen = useMemo(() => parseSchnellimport(text).zeilen.filter(sendbar), [text])
  const ohneUrl = zeilen.filter((z) => z.url_art !== 'person').length
  const ohneAnrede = zeilen.filter((z) => !z.salutation || z.salutation === 'neutral').length

  const eintragen = async () => {
    if (!zeilen.length || !me) return
    setLaeuft(true)
    setErgebnis(null)
    setAnfragen(null)
    try {
      const heute = heuteBerlin()
      // Import nicht automatisch wiederholen; bei Zeitlimit bleibt der Text stehen, ein zweiter Lauf erkennt Doppelte
      const e = await mitZeitlimit(
        rpc.importLeads({
          rows: zeilen.map((z) => zeileZuRow(z, z.salutation ?? null)) as unknown as Json,
          owner: me,
          source: 'schnellimport',
          label: `Auftragsseite · ${fmtDatum(heute)}`,
          dryRun: false,
        }),
        90_000,
      )
      const batchId = e.batch_id
      const neueIds = batchId
        ? (await mitWiederholung(() => ladeLeadSeite({ quelle: batchId }, 0, me))).zeilen.map((l) => l.id)
        : []
      const bekannteIds = e.rows
        .filter((r) => r.status === 'duplikat' && r.existing_id)
        .map((r) => r.existing_id as string)
      const uebersprungen = e.rows
        .filter((r) => r.status === 'gesperrt' || r.status === 'ungueltig' || r.status === 'archiv')
        .map(
          (r) =>
            `${r.name} (${r.status === 'gesperrt' ? 'gesperrt' : r.status === 'archiv' ? 'beendet' : 'unvollständig'})`,
        )
      const alleIds = [...neueIds, ...bekannteIds]
      const verbunden = anfrage ? await mitWiederholung(() => ladeVerbundeneLeads(alleIds, me)) : new Set<string>()
      const ids = alleIds.filter((id) => !verbunden.has(id))
      let angenommen = 0
      let fehlgeschlagen = 0
      let letzterFehler: unknown = null
      setFortschritt({ fertig: 0, gesamt: ids.length })
      for (const [i, leadId] of ids.entries()) {
        try {
          if (anfrage)
            await mitWiederholung(() => rpc.logRequest({ leadId, memberId: me, date: heute, noteVariant: 'ohne' }))
          else await mitWiederholung(() => rpc.markAccepted({ leadId, memberId: me, date: heute }))
          angenommen += 1
        } catch (err) {
          fehlgeschlagen += 1
          letzterFehler = err
        }
        setFortschritt({ fertig: i + 1, gesamt: ids.length })
      }
      // ein Toast statt einer pro Lead
      if (letzterFehler) zeigeFehler(letzterFehler)
      for (const key of [qk.leads.all, qk.queue.all, qk.kpis.all, qk.imports.all, qk.nav, qk.companies])
        void qc.invalidateQueries({ queryKey: key })
      if (anfrage)
        setAnfragen({
          neu: neueIds.length,
          bekannt: bekannteIds.length,
          eingetragen: angenommen,
          schonVerbunden: verbunden.size,
          uebersprungen,
          fehlgeschlagen,
        })
      else setErgebnis({ neu: neueIds.length, bekannt: bekannteIds.length, angenommen, uebersprungen, fehlgeschlagen })
      if (!fehlgeschlagen) setText('')
      onFertig()
    } catch (err) {
      zeigeFehler(err)
    } finally {
      setLaeuft(false)
      setFortschritt(null)
    }
  }

  return (
    <div
      className="grid max-w-[72ch] gap-2.5"
      data-auftrag-annahmen={anfrage ? undefined : ''}
      data-auftrag-anfragen={anfrage ? '' : undefined}
    >
      <label className="label" htmlFor={anfrage ? 'neue-anfragen' : 'neue-annahmen'}>
        {anfrage ? 'Neue Anfragen eintragen' : 'Neue Annahmen eintragen'} – eine Person pro Zeile
      </label>
      <Textarea
        id={anfrage ? 'neue-anfragen' : 'neue-annahmen'}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setErgebnis(null)
          setAnfragen(null)
        }}
        rows={6}
        className="font-mono text-[13px]"
        placeholder={
          'Herr Max Beispiel | Beispiel Solar GmbH | https://www.linkedin.com/in/max-beispiel\nFrau Anna Muster | Muster Energie | https://www.linkedin.com/in/anna-muster'
        }
      />
      <div className="text-ink-3 text-small flex flex-wrap gap-x-3" aria-live="polite">
        {fortschritt ? (
          <span
            className="text-ink-2 tnum font-mono"
            data-auftrag-fortschritt-annahmen={anfrage ? undefined : ''}
            data-auftrag-fortschritt-anfragen={anfrage ? '' : undefined}
          >
            Trage ein … {fortschritt.fertig}/{fortschritt.gesamt} – Seite offen lassen
          </span>
        ) : null}
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
        <p className={ergebnis.fehlgeschlagen ? 'text-overdue text-[13.5px]' : 'text-done text-[13.5px]'} role="status">
          {annahmenText(ergebnis)}
          {ergebnis.angenommen ? ' Die Opener stehen jetzt unten unter „Opener senden“.' : ''}
        </p>
      ) : null}
      {anfragen ? (
        <p className={anfragen.fehlgeschlagen ? 'text-overdue text-[13.5px]' : 'text-done text-[13.5px]'} role="status">
          {anfragenText(anfragen)}
        </p>
      ) : null}
    </div>
  )
}
