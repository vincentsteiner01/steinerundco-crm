// Leitfäden (Route /leitfaeden, Neustart 25.11.2026): Titel, ein großer Knopf „Leitfaden schreiben“, darunter die Leitfäden
// als Karten. Gezeigt wird alles, was nicht archiviert ist – außer E-Mail-Vorlagen (die gehören dem Composer). Der Kanal
// entscheidet sonst nicht: Leitfäden, die noch im alten CRM geschrieben wurden (Kanal linkedin), erscheinen genauso.
import { Copy, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useTemplates } from '@/data/templates'
import { kopieren } from '@/lib/zwischenablage'
import type { Template } from '@/types/domain'
import { LeitfadenFenster } from './LeitfadenFenster'

/** Auszug für die Karte: Zeilen zusammengezogen; auf drei Zeilen kürzt die Karte selbst (line-clamp). */
const auszug = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, 400)

function Karte({ t, onOeffnen }: { t: Template; onOeffnen: () => void }) {
  const [kopiert, setKopiert] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )
  // Kopiert wird der Text genau so, wie er im Editor steht (mit Platzhaltern)
  const kopiere = async () => {
    if ((await kopieren(t.body)) !== 'ok') {
      toast('Kopieren hat nicht geklappt. Öffne den Leitfaden und markiere den Text.')
      return
    }
    setKopiert(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setKopiert(false), 2000)
  }
  return (
    <article className="border-line bg-surface shadow-card hover:border-line-strong ease-brand relative rounded-md border p-5 transition-[border-color] duration-[var(--t-1)] max-md:p-4">
      <h2 className="text-h2 text-ink-bright [overflow-wrap:anywhere]">
        {/* Der Titel ist der Knopf, seine Fläche (::after) deckt die ganze Karte; „Text kopieren“ liegt darüber */}
        <button
          type="button"
          onClick={onOeffnen}
          className="after:outline-signal/60 cursor-pointer text-left after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2"
        >
          {t.name}
        </button>
      </h2>
      <p className="text-body text-ink-2 mt-1.5 line-clamp-3 [overflow-wrap:anywhere]">{auszug(t.body)}</p>
      <div className="mt-4">
        <Button groesse="L" icon={Copy} copied={kopiert} className="relative z-[1]" onClick={() => void kopiere()}>
          Text kopieren
        </Button>
      </div>
    </article>
  )
}

export function Component() {
  const { data: alle, isPending, isError, refetch } = useTemplates()
  const [fenster, setFenster] = useState<{ vorlage: Template | null } | null>(null)

  const leitfaeden = useMemo(
    () =>
      (alle ?? [])
        .filter((t) => t.archiviert_at == null && t.channel !== 'email')
        // neueste Änderung oben
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.name.localeCompare(b.name, 'de')),
    [alle],
  )
  const keys = useMemo(() => (alle ?? []).map((t) => t.key), [alle])

  // Erst wenn die Vorlagen geladen sind: der Schlüssel eines neuen Leitfadens wird gegen alle vorhandenen geprüft
  const schreiben = alle ? (
    <Button variante="primary" groesse="L" icon={Plus} onClick={() => setFenster({ vorlage: null })}>
      Leitfaden schreiben
    </Button>
  ) : null
  const leer = !!alle && leitfaeden.length === 0

  return (
    <div className="max-w-[760px]">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pt-7 pb-6 max-md:pt-5 max-md:pb-5">
        {/* min-h-11 = Höhe des Knopfs: der Kopf springt nicht, wenn der Knopf im Leerzustand nach unten wandert */}
        <h1 className="headline flex min-h-11 items-center">Leitfäden</h1>
        {leer ? null : schreiben}
      </header>

      {alle ? (
        leer ? (
          <div className="grid justify-items-start gap-5 py-4">
            <p className="text-body text-ink-2">Du hast noch keinen Leitfaden geschrieben.</p>
            {schreiben}
          </div>
        ) : (
          <ul className="grid gap-3">
            {leitfaeden.map((t) => (
              <li key={t.id} className="min-w-0">
                <Karte t={t} onOeffnen={() => setFenster({ vorlage: t })} />
              </li>
            ))}
          </ul>
        )
      ) : isError ? (
        <div role="alert" className="grid justify-items-start gap-5 py-4">
          <p className="text-body text-ink-2">Die Leitfäden konnten nicht geladen werden.</p>
          <Button groesse="L" onClick={() => void refetch()}>
            Erneut versuchen
          </Button>
        </div>
      ) : isPending ? (
        <Skeleton zeilen={3} />
      ) : null}

      {fenster ? (
        <LeitfadenFenster
          key={fenster.vorlage?.id ?? 'neu'}
          vorlage={fenster.vorlage}
          keys={keys}
          onClose={() => setFenster(null)}
        />
      ) : null}
    </div>
  )
}
