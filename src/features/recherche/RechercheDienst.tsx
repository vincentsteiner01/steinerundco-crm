// Recherche-Dienst (29.10.2026): Lage des Diensts auf den Rechnern einer Person und die Einrichtung mit persönlichem Dienst-Schlüssel
// (crm.recherche_dienst_einrichten, Migration 19). Der erzeugte Befehl lädt public/recherche-dienst/einrichten.sh (Mac) bzw.
// einrichten.ps1 (Windows, 30.10.2026) – so richtet jede Person den Dienst selbst ein, ohne Repository und ohne
// Entwicklerzugang. Meldet ein Dienst ein angemeldetes Claude Code (Migration 20), steht darunter der Schalter „Bei
// ChatGPT-Limit mit Claude weitermachen“.
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Button, cn, Dialog, Segment, type SegmentOption, Switch } from '@/components/ui'
import { useRechercheClaudeErsatz, useRechercheDienste, useRechercheDienstEinrichten } from '@/data/recherche'
import { fmtDatumZeit } from '@/lib/format'
import { kopieren } from '@/lib/zwischenablage'
import { dienstLage, einrichtungsBefehl, type System, systemVon, WINDOWS_TITEL } from './logik'
import { WindowsSeite } from './WindowsAnleitung'

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
          {lage === 'verbunden' ? 'Weiteren Rechner einrichten' : 'Recherche-Dienst einrichten'}
        </Button>
      ) : null}
      {!fremd ? <DienstEinrichten offen={offen} onOpenChange={setOffen} verbunden={lage === 'verbunden'} /> : null}
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

const MAC_SCHRITTE = [
  'ChatGPT-App für Mac installieren und dort anmelden.',
  'In der ChatGPT-App bei Codex das Plugin „Chrome“ einschalten und in Chrome die Erweiterung „ChatGPT for Chrome“ installieren.',
  'In Codex einmal schreiben: „Öffne https://www.linkedin.com/feed/ in Chrome“ – und LinkedIn dauerhaft erlauben.',
  'Befehl erzeugen, im Programm Terminal einfügen und Enter drücken.',
] as const

const SYSTEME: SegmentOption<System>[] = [
  { key: 'mac', label: 'Mac' },
  { key: 'windows', label: 'Windows' },
]

/**
 * Einrichtungsbefehl für Mac (Schritte + Befehl) oder Windows (Schritt-für-Schritt-Anleitung mit „Warum?“ je Schritt,
 * WindowsAnleitung.tsx) – der Schlüssel entsteht erst auf Knopfdruck und erscheint nur hier.
 */
export function DienstEinrichten({
  offen,
  onOpenChange,
  verbunden,
}: {
  offen: boolean
  onOpenChange: (o: boolean) => void
  verbunden?: boolean
}) {
  const einrichten = useRechercheDienstEinrichten()
  const [system, setSystem] = useState<System>(() => systemVon(navigator.userAgent))
  const [schluessel, setSchluessel] = useState<string | null>(null)
  const [seite, setSeite] = useState(0)
  const [kopiert, setKopiert] = useState<boolean | null>(null)
  const befehl = schluessel ? einrichtungsBefehl(schluessel, window.location.origin, system) : null
  const windows = system === 'windows'
  const umschalten = (o: boolean) => {
    onOpenChange(o)
    if (!o) {
      setSchluessel(null)
      setSeite(0)
      setKopiert(null)
    }
  }
  const kopierenUndMelden = (t: string, s: System) =>
    void kopieren(t).then((r) => {
      setKopiert(r === 'ok')
      toast(
        r === 'ok'
          ? `Befehl kopiert – ${s === 'windows' ? 'in Windows PowerShell' : 'im Terminal'} einfügen.`
          : `Text markiert – ${s === 'windows' ? 'Strg+C' : '⌘C'}`,
      )
    })
  const erzeugen = () =>
    einrichten.mutate(undefined, {
      onSuccess: (k) => {
        setSchluessel(k)
        kopierenUndMelden(einrichtungsBefehl(k, window.location.origin, system), system)
      },
    })
  const erzeugenKnopf = { label: 'Einrichtungsbefehl erzeugen', busy: einrichten.isPending, onClick: erzeugen }

  const primaer = !windows
    ? befehl
      ? { label: 'Fertig', onClick: () => umschalten(false) }
      : erzeugenKnopf
    : seite === 0
      ? { label: 'Los geht’s', onClick: () => setSeite(1) }
      : seite === 1 && !befehl
        ? { ...erzeugenKnopf, label: 'Befehl erzeugen und kopieren' }
        : seite < WINDOWS_TITEL.length - 1
          ? { label: 'Weiter', onClick: () => setSeite(seite + 1) }
          : { label: 'Fertig', onClick: () => umschalten(false) }

  return (
    <Dialog
      offen={offen}
      onOpenChange={umschalten}
      className="max-h-[calc(100dvh-32px)] w-[min(580px,calc(100vw-32px))] overflow-y-auto"
      titel="Recherche-Dienst einrichten"
      text={
        windows
          ? 'Schritt für Schritt – du wirst durch alles geführt.'
          : 'Einmal je Rechner. Danach startet „Recherche starten“ ChatGPT von selbst in deinem Chrome.'
      }
      kinder={
        <>
          {!windows || seite === 0 ? (
            <Segment
              optionen={SYSTEME}
              wert={system}
              onChange={(s) => {
                setSystem(s)
                setSeite(0)
              }}
              ariaLabel="Betriebssystem"
              klein
            />
          ) : null}
          {windows ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-ink-bright text-[15px] font-semibold" data-seite={seite}>
                  Schritt {seite + 1} von {WINDOWS_TITEL.length}: {WINDOWS_TITEL[seite]}
                </h3>
                {seite > 0 ? (
                  <Button variante="quiet" onClick={() => setSeite(seite - 1)}>
                    Zurück
                  </Button>
                ) : null}
              </div>
              <WindowsSeite
                seite={seite}
                befehl={befehl}
                kopiert={kopiert}
                onKopieren={() => befehl && kopierenUndMelden(befehl, system)}
                verbunden={verbunden}
              />
            </>
          ) : (
            <>
              <ol className="text-body text-ink-2 grid list-decimal gap-1.5 pl-5" aria-label="Schritte">
                {MAC_SCHRITTE.map((t) => (
                  <li key={t}>{t}</li>
                ))}
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
                      Enthält deinen persönlichen Schlüssel – nicht weitergeben, gilt für einen Rechner.
                    </span>
                    <Button variante="quiet" icon={Copy} onClick={() => kopierenUndMelden(befehl, system)}>
                      Kopieren
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      }
      primaer={primaer}
      abbrechen={befehl || seite > 0 ? 'Schließen' : 'Abbrechen'}
    />
  )
}
