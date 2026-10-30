// Recherche-Dienst (29.10.2026): Lage des Diensts auf den Macs einer Person und die Einrichtung mit persönlichem Dienst-Schlüssel
// (crm.recherche_dienst_einrichten, Migration 19). Der erzeugte Befehl lädt public/recherche-dienst/einrichten.sh – so richtet
// jede Person den Dienst selbst ein, ohne Repository und ohne Entwicklerzugang. Meldet ein Dienst ein angemeldetes Claude Code
// (Migration 20), steht darunter der Schalter „Bei ChatGPT-Limit mit Claude weitermachen“.
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Button, cn, Dialog, Switch } from '@/components/ui'
import { useRechercheClaudeErsatz, useRechercheDienste, useRechercheDienstEinrichten } from '@/data/recherche'
import { fmtDatumZeit } from '@/lib/format'
import { kopieren } from '@/lib/zwischenablage'
import { dienstLage, einrichtungsBefehl } from './logik'

const PUNKT = { verbunden: 'bg-done', getrennt: 'bg-overdue', keiner: 'bg-deco' } as const

/** Eine Zeile: Recherche-Dienst verbunden, getrennt oder nicht eingerichtet – mit „Recherche-Dienst einrichten“. */
export function DienstZeile({ memberId, fremd = false }: { memberId: string | null; fremd?: boolean }) {
  const { data } = useRechercheDienste(memberId, true)
  const [offen, setOffen] = useState(false)
  const ersatz = useRechercheClaudeErsatz()
  const lage = dienstLage(data)
  if (!lage) return null
  const neuester = data?.find((d) => d.zuletzt_gesehen)
  const mitClaude = data?.filter((d) => d.claude) ?? []
  const text =
    lage === 'verbunden'
      ? `Recherche-Dienst verbunden${neuester?.rechner ? ` · ${neuester.rechner}` : ''}`
      : lage === 'getrennt'
        ? `Recherche-Dienst getrennt · zuletzt ${fmtDatumZeit(neuester!.zuletzt_gesehen!)}${neuester?.rechner ? ` auf ${neuester.rechner}` : ''}`
        : 'Kein Recherche-Dienst eingerichtet'
  return (
    <div className="text-small text-ink-2 flex flex-wrap items-center gap-x-2 gap-y-1" data-dienst={lage}>
      <span className={cn('size-1.5 shrink-0 rounded-full', PUNKT[lage])} aria-hidden />
      <span>{text}</span>
      {!fremd ? (
        <Button variante="quiet" onClick={() => setOffen(true)}>
          {lage === 'verbunden' ? 'Weiteren Mac einrichten' : 'Recherche-Dienst einrichten'}
        </Button>
      ) : null}
      {!fremd ? <DienstEinrichten offen={offen} onOpenChange={setOffen} /> : null}
      {!fremd && mitClaude.length ? (
        <label className="flex basis-full cursor-pointer items-center gap-2">
          <Switch
            checked={mitClaude.some((d) => d.claude_ersatz)}
            onCheckedChange={(an) => ersatz.mutate(an)}
            disabled={ersatz.isPending}
            label="Bei ChatGPT-Limit mit Claude weitermachen"
          />
          <span>Bei ChatGPT-Limit mit Claude weitermachen</span>
        </label>
      ) : null}
    </div>
  )
}

/** Schritte und Einrichtungsbefehl – der Schlüssel entsteht erst auf Knopfdruck und erscheint nur hier. */
export function DienstEinrichten({ offen, onOpenChange }: { offen: boolean; onOpenChange: (o: boolean) => void }) {
  const einrichten = useRechercheDienstEinrichten()
  const [befehl, setBefehl] = useState<string | null>(null)
  const umschalten = (o: boolean) => {
    onOpenChange(o)
    if (!o) setBefehl(null)
  }
  const kopierenUndMelden = (t: string) =>
    void kopieren(t).then((r) => toast(r === 'ok' ? 'Befehl kopiert – im Terminal einfügen.' : 'Text markiert – ⌘C'))

  return (
    <Dialog
      offen={offen}
      onOpenChange={umschalten}
      className="w-[min(580px,calc(100vw-32px))]"
      titel="Recherche-Dienst einrichten"
      text="Einmal je Mac. Danach startet „Recherche starten“ ChatGPT von selbst in deinem Chrome."
      kinder={
        <>
          <ol className="text-body text-ink-2 grid list-decimal gap-1.5 pl-5" aria-label="Schritte">
            <li>ChatGPT-App für Mac installieren und dort anmelden.</li>
            <li>
              In der ChatGPT-App bei Codex das Plugin „Chrome“ einschalten und in Chrome die Erweiterung „ChatGPT for
              Chrome“ installieren.
            </li>
            <li>
              In Codex einmal schreiben: „Öffne https://www.linkedin.com/feed/ in Chrome“ – und LinkedIn dauerhaft
              erlauben.
            </li>
            <li>Befehl erzeugen, im Programm Terminal einfügen und Enter drücken.</li>
          </ol>
          <p className="text-small text-ink-3">
            Ist auf dem Mac auch die Claude-App angemeldet, macht Claude weiter, sobald ChatGPT sein Nutzungslimit
            erreicht.
          </p>
          {befehl ? (
            <div className="grid gap-1.5">
              <pre
                className="bg-surface-hover border-line text-ink rounded-sm border px-3 py-2.5 font-mono text-[12px] break-all whitespace-pre-wrap"
                data-befehl
              >
                {befehl}
              </pre>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-small text-ink-3">
                  Enthält deinen persönlichen Schlüssel – nicht weitergeben, gilt für einen Mac.
                </span>
                <Button variante="quiet" icon={Copy} onClick={() => kopierenUndMelden(befehl)}>
                  Kopieren
                </Button>
              </div>
            </div>
          ) : null}
        </>
      }
      primaer={
        befehl
          ? { label: 'Fertig', onClick: () => umschalten(false) }
          : {
              label: 'Einrichtungsbefehl erzeugen',
              busy: einrichten.isPending,
              onClick: () =>
                einrichten.mutate(undefined, {
                  onSuccess: (k) => {
                    const b = einrichtungsBefehl(k, window.location.origin)
                    setBefehl(b)
                    kopierenUndMelden(b)
                  },
                }),
            }
      }
      abbrechen={befehl ? 'Schließen' : 'Abbrechen'}
    />
  )
}
