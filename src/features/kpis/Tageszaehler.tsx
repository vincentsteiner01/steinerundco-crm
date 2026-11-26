// „Meine Vernetzungen“ (KPI-Reiter, 26.11.2026): die zwei Tageszähler, die das Board nicht selbst kennt – Vernetzungen versendet
// und angenommen, immer für die angemeldete Person. Einmal am Tag von Hand eingetragen; der Wert ist die Zahl des ganzen Tages,
// erneutes Speichern ersetzt sie. „Gestern“ ist zum Nachtragen da. Bewusst nichts weiter: keine Hinweise, keine Tasten, keine Ziele.
// Gespeichert wird nur, was geändert wurde: ein nicht angefasstes Feld überschreibt nie einen gespeicherten Wert.
// Eine ungespeicherte Eingabe gehört zu dem Kalendertag, für den sie getippt wurde – auch wenn inzwischen Mitternacht war.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Feld } from '@/components/ui/Feld'
import { Input } from '@/components/ui/Input'
import { Segment, type SegmentOption } from '@/components/ui/Segment'
import {
  useTageszaehler,
  useTageszaehlerSpeichern,
  type Tageszaehler as Stand,
  type TageszaehlerEingabe,
} from '@/data/kpis'
import { heuteBerlin } from '@/lib/format'
import { heutePruefen } from '@/lib/useHeute'
import { tagPlus, type Tag } from '@/lib/zeit'
import { feldGeaendert, feldText, KEINE_GANZE_ZAHL, zahlAusEingabe } from './tageszaehlerLogik'

type Wahl = 'heute' | 'gestern'
const TAGE: SegmentOption<Wahl>[] = [
  { key: 'heute', label: 'Heute' },
  { key: 'gestern', label: 'Gestern' },
]

const FELDER = ['versendet', 'angenommen'] as const
type Feldname = (typeof FELDER)[number]
/**
 * Was getippt und noch nicht gespeichert ist – nur die Felder, in die wirklich getippt wurde. Ein unberührtes Feld zeigt
 * weiter den gespeicherten Stand, auch wenn der erst nach dem Tippen im anderen Feld geladen ist.
 */
type Entwurf = Partial<Record<Feldname, string>>
/** Was dieser Block zuletzt selbst gespeichert hat, mit Zeitpunkt. */
type Gespeichert = { tag: Tag; um: number } & Stand

const TITEL = 'Meine Vernetzungen'

export type TageszaehlerProps = {
  meId: string
  heute: Tag
  /** Nach erfolgreichem Speichern – die Seite zeigt dann die Zahlen der angemeldeten Person. */
  onGespeichert?: () => void
}

export function Tageszaehler({ meId, heute, onGespeichert }: TageszaehlerProps) {
  const id = useId()
  const [wahl, setWahl] = useState<Wahl>('heute')
  const [entwurf, setEntwurf] = useState<Entwurf>({})
  const [zuletzt, setZuletzt] = useState<Gespeichert | null>(null)

  // Tageswechsel ohne Klick (Mitternacht, Reiter über Nacht offen): „Heute“ und „Gestern“ meinen jetzt andere Kalendertage.
  // Eine ungespeicherte Eingabe bleibt bei ihrem Tag: stand sie unter „Heute“, ist das nun „Gestern“ – die Wahl springt mit.
  // Stand sie unter „Gestern“ (oder liegen mehrere Tage dazwischen), ist ihr Tag nicht mehr wählbar: sie wird verworfen.
  const [heuteBisher, setHeuteBisher] = useState(heute)
  if (heuteBisher !== heute) {
    setHeuteBisher(heute)
    if (Object.keys(entwurf).length > 0) {
      if (wahl === 'heute' && heuteBisher === tagPlus(heute, -1)) setWahl('gestern')
      else setEntwurf({})
    }
  }

  const tag = wahl === 'heute' ? heute : tagPlus(heute, -1)
  const zaehler = useTageszaehler(meId, tag)
  const speichern = useTageszaehlerSpeichern()
  // Die Antwort kommt später als der Klick: gemeldet wird an die Seite von jetzt, nicht an die aus dem Augenblick des Klicks –
  // sie kann inzwischen einen anderen Zeitraum oder eine andere Person zeigen.
  const nachSpeichern = useRef(onGespeichert)
  useEffect(() => {
    nachSpeichern.current = onGespeichert
  })

  // Gespeicherter Stand des Tages. Direkt nach dem Speichern gilt das eben Gespeicherte, bis die Abfrage neu geladen hat –
  // sonst stünden für einen Augenblick wieder die alten Zahlen in den Feldern. `undefined`: (noch) nicht bekannt – der Tag lädt
  // oder ließ sich nicht laden. Eintragen bleibt möglich; gespeichert wird dann nur, was getippt wurde.
  const stand: Stand | undefined =
    zuletzt !== null && zuletzt.tag === tag && zaehler.dataUpdatedAt <= zuletzt.um ? zuletzt : zaehler.data

  const text: Record<Feldname, string> = {
    versendet: entwurf.versendet ?? feldText(stand?.versendet),
    angenommen: entwurf.angenommen ?? feldText(stand?.angenommen),
  }
  const zahl: Record<Feldname, number | null> = {
    versendet: zahlAusEingabe(text.versendet),
    angenommen: zahlAusEingabe(text.angenommen),
  }
  // Geändert ist nur ein Feld, in das getippt wurde und das vom gespeicherten Stand abweicht
  const geaendert = (feld: Feldname): boolean =>
    entwurf[feld] !== undefined && feldGeaendert(text[feld], stand?.[feld] ?? null)
  const gesperrt = zahl.versendet === null || zahl.angenommen === null || !FELDER.some(geaendert) || speichern.isPending

  const tippe = (feld: Feldname, wert: string) => setEntwurf((alt) => ({ ...alt, [feld]: wert }))

  const wechsle = (w: Wahl) => {
    if (w === wahl) return
    setWahl(w)
    setEntwurf({})
  }

  const absenden = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (gesperrt) return
    // Mitternacht ist vorbei und die Seite weiß es noch nicht: nicht unter dem alten Tag speichern. Erst den neuen Tag
    // übernehmen – die Eingabe bleibt bei dem Tag, für den sie getippt wurde (siehe oben), der nächste Klick speichert.
    if (heuteBerlin() !== heute) {
      heutePruefen()
      return
    }
    const eingabe: TageszaehlerEingabe = { tag }
    for (const feld of FELDER) {
      const wert = zahl[feld]
      if (wert !== null && geaendert(feld)) eingabe[feld] = wert
    }
    // Schlägt es fehl, meldet das die Daten-Schicht (Fehler-Toast) – die Eingaben bleiben stehen
    speichern.mutate(eingabe, {
      onSuccess: () => {
        setZuletzt({
          tag,
          um: Date.now(),
          versendet: eingabe.versendet ?? stand?.versendet ?? null,
          angenommen: eingabe.angenommen ?? stand?.angenommen ?? null,
        })
        setEntwurf({})
        toast('Gespeichert.')
        nachSpeichern.current?.()
      },
    })
  }

  const feld = (name: Feldname, label: string) => (
    <Feld label={label} htmlFor={`${id}-${name}`}>
      <Input
        id={`${id}-${name}`}
        groesse="L"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={text[name]}
        onChange={(e) => tippe(name, e.target.value)}
        // nur lesen statt sperren: der Fokus bleibt im Feld, während gespeichert wird
        readOnly={speichern.isPending}
        fehler={zahl[name] === null ? KEINE_GANZE_ZAHL : undefined}
      />
    </Feld>
  )

  return (
    <section aria-label={TITEL} className="min-w-0">
      <div className="mb-3.5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-h3 text-ink">{TITEL}</h2>
        <Segment ariaLabel="Tag" optionen={TAGE} wert={wahl} onChange={wechsle} className="max-md:h-11!" />
      </div>
      {/* md:justify-start: die Knopf-Spur bleibt so breit wie der Knopf – sonst füllte „Speichern“ den ganzen Rest der Zeile */}
      <form
        noValidate
        onSubmit={absenden}
        className="grid grid-cols-[minmax(0,15rem)_minmax(0,15rem)_auto] items-start gap-3 max-md:grid-cols-1 md:justify-start"
      >
        {feld('versendet', 'Vernetzungen versendet')}
        {feld('angenommen', 'Vernetzungen angenommen')}
        <div className="grid content-start gap-1.5">
          {/* Platz in Höhe der Beschriftungen: der Knopf steht auf der Linie der Felder, auch wenn darunter ein Fehler erscheint */}
          <span aria-hidden className="text-small invisible max-md:hidden">
            &nbsp;
          </span>
          <Button
            type="submit"
            variante="primary"
            groesse="L"
            className="max-md:w-full"
            disabled={gesperrt}
            busy={speichern.isPending}
          >
            Speichern
          </Button>
        </div>
      </form>
    </section>
  )
}
