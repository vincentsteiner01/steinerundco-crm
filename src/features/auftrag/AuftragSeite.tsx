// /auftrag – LinkedIn-Auftrag für Browser-Agenten (ChatGPT in Chrome). Das CRM entscheidet, wer welche Nachricht bekommt;
// der Agent sendet auf LinkedIn und klickt hier „Gesendet“ – so entstehen dieselben Aktivitäten wie in „Heute“
// (complete_step, mark_accepted, log_reply), und KPIs, Team und Follow-up-Termine stimmen ohne Nachpflegen.
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Copy, RefreshCw } from 'lucide-react'
import { PFADE } from '@/app/pfade'
import { Button, SeitenKopf } from '@/components/ui'
import { toast } from '@/components/toast'
import { useMeId } from '@/data/members'
import { useQueue } from '@/data/queue'
import { useSequencesIndex } from '@/data/sequences'
import { kopieren } from '@/lib/zwischenablage'
import type { QueueItem } from '@/types/domain'
import { itemKey } from '@/features/heute/sektionen'
import { chatgptPrompt, gruppiere } from './auftrag'
import { NeueAnnahmen } from './NeueAnnahmen'
import { AnnahmeZeile, NachrichtZeile, type ZeilenStatus } from './Zeilen'

function Abschnitt({
  nr,
  titel,
  zaehler,
  hinweis,
  children,
}: {
  nr: number
  titel: string
  zaehler?: number
  hinweis?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-9 grid gap-3" data-auftrag-abschnitt={titel}>
      <div className="border-line flex items-baseline gap-3 border-b pb-2">
        <h2 className="text-h2">
          {nr}. {titel}
        </h2>
        {zaehler !== undefined ? <span className="text-ink-2 tnum font-mono text-[12px]">{zaehler}</span> : null}
      </div>
      {hinweis ? <p className="text-ink-3 text-small max-w-[72ch]">{hinweis}</p> : null}
      {children}
    </section>
  )
}

export function Component() {
  const me = useMeId()
  const queue = useQueue(me)
  const { data: idx } = useSequencesIndex()
  // Stabile Liste: einmal laden, erst auf „Liste aktualisieren“ neu – sonst springen Zeilen, während der Agent klickt.
  const [stand, setStand] = useState<QueueItem[] | null>(null)
  const [status, setStatus] = useState<Record<string, ZeilenStatus>>({})
  const [promptOffen, setPromptOffen] = useState(false)

  if (stand === null && queue.data) setStand(queue.data)

  const aktualisieren = useCallback(async () => {
    const r = await queue.refetch()
    if (r.data) setStand(r.data)
  }, [queue])

  const gruppen = useMemo(
    () => gruppiere(stand ?? [], (stepId) => !!(stepId && idx?.stepsById.get(stepId)?.is_opener)),
    [stand, idx],
  )
  const alle = [...gruppen.annahmen, ...gruppen.opener, ...gruppen.followUps]
  const gesamt = alle.length
  const nrVon = (i: QueueItem) => alle.indexOf(i) + 1
  const erledigt = Object.keys(status).length
  const setzeStatus = (key: string) => (s: ZeilenStatus | undefined) =>
    setStatus((alt) => {
      const neu = { ...alt }
      if (s) neu[key] = s
      else delete neu[key]
      return neu
    })

  const prompt = chatgptPrompt()
  const promptKopieren = async () => {
    const r = await kopieren(prompt)
    toast(r === 'ok' ? 'Prompt kopiert – in die ChatGPT-Seitenleiste einfügen.' : 'Prompt markiert – ⌘C')
  }

  return (
    <div className="pb-24" data-auftrag-seite>
      <SeitenKopf
        titel="Auftrag"
        kontext="LinkedIn · für den ChatGPT-Agenten"
        rechts={
          <Button
            variante="secondary"
            groesse="M"
            icon={RefreshCw}
            busy={queue.isFetching}
            onClick={() => void aktualisieren()}
          >
            Liste aktualisieren
          </Button>
        }
      />

      <div className="mt-5 grid max-w-[72ch] gap-3">
        <p className="text-body text-ink-2">
          Diese Seite ist für den ChatGPT-Agenten in Chrome gebaut. Das CRM legt fest, wer welche Nachricht bekommt. Der
          Agent sendet auf LinkedIn und klickt hier danach „Gesendet“. So zählen KPIs, Team und Follow-up-Termine mit,
          ohne dass du etwas nachträgst.
        </p>
        <div className="text-ink-3 text-small tnum font-mono" aria-live="polite" data-auftrag-fortschritt>
          {stand === null
            ? 'Lade Aufgaben …'
            : `${gesamt} Aufgaben · ${erledigt} in diesem Durchgang erledigt · ${gruppen.antwortenOffen} Antworten offen (beantwortest du selbst)`}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variante="secondary" groesse="M" icon={Copy} onClick={() => void promptKopieren()}>
            Prompt für ChatGPT kopieren
          </Button>
          <Button variante="quiet" groesse="M" onClick={() => setPromptOffen((o) => !o)} aria-expanded={promptOffen}>
            {promptOffen ? 'Prompt ausblenden' : 'Prompt ansehen'}
          </Button>
        </div>
        {promptOffen ? (
          <pre className="bg-surface-hover border-line text-ink-2 rounded-sm border px-3.5 py-3 font-mono text-[12.5px] whitespace-pre-wrap">
            {prompt}
          </pre>
        ) : null}
      </div>

      <Abschnitt
        nr={1}
        titel="Neue Annahmen eintragen"
        hinweis="Personen, die auf LinkedIn neu vernetzt sind. Bekannte Personen erkennt das CRM an der LinkedIn-URL; neue werden angelegt. Danach erscheint ihr Opener unter „Opener senden“."
      >
        <NeueAnnahmen me={me} onFertig={() => void aktualisieren()} />
      </Abschnitt>

      {gruppen.annahmen.length ? (
        <Abschnitt
          nr={2}
          titel="Annahmen prüfen"
          zaehler={gruppen.annahmen.length}
          hinweis="Anfragen, die im CRM als gesendet stehen. Nur „Angenommen“ klicken, wenn ihr auf LinkedIn vernetzt seid."
        >
          <ol className="grid gap-3">
            {gruppen.annahmen.map((i) => (
              <AnnahmeZeile
                key={itemKey(i)}
                item={i}
                nr={nrVon(i)}
                gesamt={gesamt}
                status={status[itemKey(i)]}
                setStatus={setzeStatus(itemKey(i))}
              />
            ))}
          </ol>
        </Abschnitt>
      ) : null}

      <Abschnitt
        nr={gruppen.annahmen.length ? 3 : 2}
        titel="Opener senden"
        zaehler={gruppen.opener.length}
        hinweis="Erste Nachricht nach der Annahme. Den Text genau so senden und danach „Gesendet“ klicken."
      >
        {gruppen.opener.length ? (
          <ol className="grid gap-3">
            {gruppen.opener.map((i) => (
              <NachrichtZeile
                key={itemKey(i)}
                item={i}
                art="opener"
                nr={nrVon(i)}
                gesamt={gesamt}
                status={status[itemKey(i)]}
                setStatus={setzeStatus(itemKey(i))}
              />
            ))}
          </ol>
        ) : (
          <p className="text-ink-3 text-[13.5px]">{stand === null ? 'Lade …' : 'Keine Opener fällig.'}</p>
        )}
      </Abschnitt>

      <Abschnitt
        nr={gruppen.annahmen.length ? 4 : 3}
        titel="Follow-ups senden"
        zaehler={gruppen.followUps.length}
        hinweis="Nachfassen bei Personen ohne Antwort. Hat jemand inzwischen geantwortet, nichts senden und „Hat geantwortet“ klicken."
      >
        {gruppen.followUps.length ? (
          <ol className="grid gap-3">
            {gruppen.followUps.map((i) => (
              <NachrichtZeile
                key={itemKey(i)}
                item={i}
                art="follow_up"
                nr={nrVon(i)}
                gesamt={gesamt}
                status={status[itemKey(i)]}
                setStatus={setzeStatus(itemKey(i))}
              />
            ))}
          </ol>
        ) : (
          <p className="text-ink-3 text-[13.5px]">{stand === null ? 'Lade …' : 'Keine Follow-ups fällig.'}</p>
        )}
      </Abschnitt>

      {gruppen.antwortenOffen ? (
        <p className="text-ink-3 text-small mt-9">
          {gruppen.antwortenOffen} Antworten warten auf dich – die beantwortet der Agent nicht.{' '}
          <Link className="text-ink-2 underline underline-offset-2" to={PFADE.heute}>
            Zu Heute
          </Link>
        </p>
      ) : null}
    </div>
  )
}
