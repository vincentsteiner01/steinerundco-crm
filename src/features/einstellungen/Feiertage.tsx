// Einstellungen → Feiertage (Neustart 25.11.2026, vorher ein Block in „Ziele“): die Liste settings.feiertage. Der Mail-Motor
// fragt sie über crm.is_holiday ab – an diesen Tagen sendet keine Kampagne. Fehlt die Zeile in settings, beginnt die Liste leer.
// Hinzufügen und Entfernen speichern sofort (25.11.2026): Mit einem eigenen „Speichern“ weiter unten ging ein hinzugefügter Tag
// beim Seitenwechsel ohne Rückfrage verloren. Die Liste folgt dem Cache von useSettingsUpdate (sofort sichtbar); scheitert das
// Speichern, rollt der Hook zurück und meldet den Fehler.
import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { Feld } from '@/components/ui/Feld'
import { Input } from '@/components/ui/Input'
import { Segment } from '@/components/ui/Segment'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/toast'
import { useSettings, useSettingsUpdate } from '@/data'
import { parseDatumEingabeTag } from '@/lib/datumEingabe'
import { fmtDatum, fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { FEIERTAGE_HH } from '@/lib/werktage'
import { Block, NichtGeladen } from './components/Formular'
import { feiertagHinzufuegen, feiertagJahre } from './logik'

function Liste({ gespeichert }: { gespeichert: readonly string[] }) {
  const id = useId()
  const update = useSettingsUpdate()
  const heute = heuteBerlin()
  const [jahr, setJahr] = useState(heute.slice(0, 4))
  const [eingabe, setEingabe] = useState('')
  const [fehler, setFehler] = useState<string | undefined>()
  const tage = [...gespeichert].sort()

  const jahre = feiertagJahre([...tage, ...FEIERTAGE_HH, heute])
  const sichtbar = tage.filter((t) => t.startsWith(jahr))
  // Nur was noch kommt: ein vergangener Feiertag hält keine Kampagne mehr auf
  const gesetzlichOffen = FEIERTAGE_HH.filter((t) => t.startsWith(jahr) && t >= heute && !tage.includes(t))

  /** Ersetzt settings.feiertage durch die ganze Liste, sortiert. */
  const schreiben = (neu: readonly string[]) =>
    update.mutate({ key: 'feiertage', value: [...neu].sort() }, { onSuccess: () => toast('Feiertage gespeichert.') })

  const hinzufuegen = () => {
    const tag = parseDatumEingabeTag(eingabe, heute)
    if (!tag) {
      setFehler('Datum wie 24.12.2026 oder 24.12.')
      return
    }
    if (tage.includes(tag)) {
      setFehler(`${fmtDatum(tag)} steht schon in der Liste`)
      return
    }
    setFehler(undefined)
    schreiben(feiertagHinzufuegen(tage, tag))
    setJahr(tag.slice(0, 4))
    setEingabe('')
  }
  const entfernen = (tag: string) => schreiben(tage.filter((t) => t !== tag))
  const gesetzlicheErgaenzen = () => schreiben([...new Set([...tage, ...gesetzlichOffen])])

  return (
    <Block titel="Feiertage" ohneKopf>
      <p className="text-body text-ink-2">An diesen Tagen sendet keine Kampagne.</p>

      <Segment
        ariaLabel="Jahr"
        // 44 px hoch wie die Felder; Segment setzt seine Höhe selbst, deshalb das Ausrufezeichen
        className="h-11! justify-self-start [&>button]:px-4"
        optionen={jahre.map((j) => ({ key: j, label: j }))}
        wert={jahr}
        onChange={setJahr}
      />

      {sichtbar.length === 0 ? (
        <p className="text-body text-ink-2">Für {jahr} ist kein Feiertag eingetragen.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={`Feiertage ${jahr}`}>
          {sichtbar.map((t) => (
            <li key={t} className="bg-surface-hover flex h-11 items-center rounded-sm pl-3.5">
              <span className={cn('text-ui tnum', t < heute ? 'text-ink-3' : 'text-ink')}>{fmtDatumKurz(t)}</span>
              <button
                type="button"
                aria-label={`${fmtDatum(t)} entfernen`}
                onClick={() => entfernen(t)}
                className="text-ink-3 hover:text-ink ease-brand inline-flex h-11 w-10 items-center justify-center rounded-sm transition-[color] duration-[var(--t-1)]"
              >
                <X size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {gesetzlichOffen.length > 0 ? (
        <div>
          <Button variante="quiet" groesse="L" className="-ml-4" onClick={gesetzlicheErgaenzen}>
            Gesetzliche Feiertage Hamburg {jahr} ergänzen
          </Button>
        </div>
      ) : null}

      <Feld label="Feiertag hinzufügen" htmlFor={`${id}-neu`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Input
              id={`${id}-neu`}
              groesse="L"
              mono
              autoComplete="off"
              placeholder="24.12.2026"
              fehler={fehler}
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              // Enter trägt den Tag ein (und speichert ihn) wie der Knopf daneben
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault()
                  hinzufuegen()
                }
              }}
            />
          </div>
          <Button groesse="L" onClick={hinzufuegen}>
            Hinzufügen
          </Button>
        </div>
      </Feld>
    </Block>
  )
}

export function Feiertage() {
  const { data: settings, isPending, refetch } = useSettings()
  if (!settings) {
    return isPending ? (
      <Skeleton zeilen={4} />
    ) : (
      <NichtGeladen text="Die Feiertage konnten nicht geladen werden." onNochmal={() => void refetch()} />
    )
  }
  return <Liste gespeichert={Array.isArray(settings.feiertage) ? settings.feiertage : []} />
}
