// Das Lead-Blatt (25.11.2026): Sheet von rechts, auf dem Telefon von unten. Die Hülle öffnet es über `?lead=<id>` auf jeder
// Seite – auch für Leads von vor dem Neustart, die auf keiner Liste liegen (dann ist bei „Liste“ nichts gewählt; eine Liste
// wählen und speichern legt die Karte aufs Board). Der E-Mail-Bereich hält Erlaubnis, Widerspruch und Einzelmail erreichbar.
// Ungespeicherte Änderungen gehen nie ohne Rückfrage verloren: Esc, Klick daneben, „Schließen“, „Abbrechen“, die Zurück-Taste
// des Browsers (Android-Geste) und die zwei Wege aus dem Blatt hinaus, „Karte entfernen“ und „E-Mail schreiben“, fragen dann
// „Änderungen verwerfen?“.
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Link, useBlocker, useLocation, useNavigate, type BlockerFunction } from 'react-router'
import { WiderspruchErfassen } from '@/components/aktionen/WiderspruchErfassen'
import { toast } from '@/components/toast'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Feld } from '@/components/ui/Feld'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { seitenInhalt } from '@/components/ui/useFokusZurueck'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { useLead, useMembers } from '@/data'
import { useKarteSpeichern } from '@/data/board'
import { verfassenUrl } from '@/features/email/links'
import { ErlaubnisBadge, ErlaubnisErfassen } from '@/features/email/public'
import { anzeigeName } from '@/lib/mitglied'
import type { LeadMitBezug, Member, Salutation } from '@/types/domain'
import { blattPatch, blattWerte, pruefeBlatt, type BlattWerte } from './blatt'
import { Wahl } from './Wahl'
import { useKartenAktionen } from './kartenAktionen'
import { kartenKnoten, nameAufKarte } from './kartenKnoten'
import { BOARD_LISTEN } from './listen'
import { kartenName, sortiereMitglieder } from './logik'
import { blattImVerlauf } from './verlauf'

const ANREDEN: { key: Exclude<Salutation, 'neutral'>; label: string }[] = [
  { key: 'herr', label: 'Herr' },
  { key: 'frau', label: 'Frau' },
]
const LISTEN = BOARD_LISTEN.map((l) => ({ key: l.key, label: l.titel }))
/** Fehlercodes von PostgREST/Postgres für „diese Zeile gibt es nicht“ bzw. „das ist keine ID“. */
const GIBT_ES_NICHT = new Set(['PGRST116', '22P02'])

/**
 * Fokus nach dem Schließen, wenn es den Knopf nicht mehr gibt, der das Blatt geöffnet hat: die Karte des Leads an ihrem neuen
 * Platz (nach dem Speichern in einer anderen Liste), sonst der Seiteninhalt (Karte entfernt) – nie <body>.
 */
const karteOderInhalt = (leadId: string): HTMLElement | null => nameAufKarte(kartenKnoten(leadId)) ?? seitenInhalt()

/** Führt `weiter` aus – bei ungespeicherten Änderungen erst nach der Rückfrage „Änderungen verwerfen?“. */
type MitRueckfrage = (weiter: () => void) => void

export function LeadBlatt({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  // frisch: Das Formular entsteht aus dem nach dem Öffnen geladenen Lead, nie aus dem Cache von vorhin – sonst zeigt es nach
  // einem Zug die alte Liste, und eine Notiz der anderen Person würde ungesehen überschrieben.
  const { data: lead, isError, error, refetch, isFetchedAfterMount } = useLead(leadId, { frisch: true })
  // Kein Treffer (PGRST116) oder keine gültige ID in der Adresse (22P02): „Erneut versuchen“ hülfe hier nie
  const gibtEsNicht = isError && GIBT_ES_NICHT.has((error as { code?: string } | null)?.code ?? '')
  // Steht das Formular einmal, bleibt es stehen: Scheitert ein späteres Neuladen im Hintergrund, behält TanStack den Lead –
  // die Eingaben dürfen dann nicht hinter einer Fehlerzeile verschwinden.
  const [geladen, setGeladen] = useState(false)
  if (!geladen && lead && isFetchedAfterMount && !isError) setGeladen(true)
  // Das Formular meldet, ob etwas geändert ist; die Rückfrage merkt sich, was nach „Verwerfen“ geschehen soll
  const geaendert = useRef(false)
  const meldeGeaendert = useCallback((ja: boolean) => {
    geaendert.current = ja
  }, [])
  const [frage, setFrage] = useState<{ weiter: () => void } | null>(null)
  // ui/Dialog hat keinen Auslöser, zu dem der Fokus von selbst zurückkehrt – er fiele nach „Weiter bearbeiten“ auf <body>
  const vorFrage = useRef<HTMLElement | null>(null)

  const mitRueckfrage = useCallback<MitRueckfrage>((weiter) => {
    if (!geaendert.current) return weiter()
    vorFrage.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setFrage({ weiter })
  }, [])
  // Zurück-Taste, Android-Geste: Verlässt die Navigation dieses Blatt, solange etwas ungespeichert ist, hält der Router an
  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      ({ currentLocation, nextLocation }) =>
        geaendert.current &&
        (nextLocation.pathname !== currentLocation.pathname ||
          new URLSearchParams(nextLocation.search).get('lead') !== leadId),
      [leadId],
    ),
  )
  // Gewolltes Schließen (Speichern, bestätigtes Verwerfen) darf der Router nicht noch einmal anhalten – die Hülle schließt
  // selbst mit einem Schritt zurück (LeadOutlet)
  const zu = useCallback(() => {
    geaendert.current = false
    onClose()
  }, [onClose])
  const frageZu = () => {
    if (blocker.state === 'blocked') blocker.reset()
    setFrage(null)
    const ziel = vorFrage.current
    requestAnimationFrame(() => {
      if (ziel?.isConnected) ziel.focus()
    })
  }

  return (
    <>
      <Sheet
        offen
        // Esc, Klick daneben und das × im Kopf
        onOpenChange={(o) => {
          if (!o) mitRueckfrage(zu)
        }}
        titel={lead ? kartenName(lead) : 'Lead'}
        breite={440}
        ruhig
        fokusErsatz={() => karteOderInhalt(leadId)}
      >
        {!lead || !geladen ? (
          gibtEsNicht ? (
            <p className="text-body text-ink-2">Diesen Lead gibt es nicht mehr.</p>
          ) : isError ? (
            // Derselbe Baustein wie auf Leitfäden und Team: ein Satz, ein großer Knopf, kein Tastenhinweis
            <div role="alert" className="grid justify-items-start gap-5">
              <p className="text-body text-ink-2">Der Lead konnte nicht geladen werden.</p>
              <Button groesse="L" onClick={() => void refetch()}>
                Erneut versuchen
              </Button>
            </div>
          ) : (
            <Skeleton zeilen={5} />
          )
        ) : lead.deleted_at ? (
          <p className="text-body text-ink-2">Dieser Lead wurde gelöscht.</p>
        ) : (
          <Formular key={lead.id} lead={lead} onGeaendert={meldeGeaendert} mitRueckfrage={mitRueckfrage} onClose={zu} />
        )}
      </Sheet>
      <Dialog
        gross
        offen={frage !== null || blocker.state === 'blocked'}
        onOpenChange={(o) => !o && frageZu()}
        titel="Änderungen verwerfen?"
        primaer={{
          label: 'Verwerfen',
          onClick: () => {
            const weiter = frage?.weiter
            setFrage(null)
            geaendert.current = false
            if (blocker.state === 'blocked') blocker.proceed()
            else weiter?.()
          },
        }}
        abbrechen="Weiter bearbeiten"
      />
    </>
  )
}

type FormularProps = {
  lead: LeadMitBezug
  /** Meldet, ob das Formular ungespeicherte Änderungen hat. */
  onGeaendert: (ja: boolean) => void
  mitRueckfrage: MitRueckfrage
  /** Schließt sofort (nach dem Speichern und nach bestätigter Rückfrage). */
  onClose: () => void
}

function Formular({ lead, onGeaendert, mitRueckfrage, onClose }: FormularProps) {
  const id = useId()
  const navigate = useNavigate()
  const { pathname, search, state } = useLocation()
  // Der Composer kehrt per `replace` auf `zurueck` zurück. Hat eine Karte dieses Blatt geöffnet (eigener Verlaufseintrag),
  // ersetzt der Weg zum Composer diesen Eintrag – sonst bliebe er liegen und „Zurück“ öffnete das geschlossene Blatt wieder.
  const ersetzen = blattImVerlauf(state)
  const { data: alleMitglieder } = useMembers()
  const speichern = useKarteSpeichern()
  const { entferne } = useKartenAktionen()
  // Stand beim Öffnen: Vergleichsbasis für den Patch. Der E-Mail-Bereich liest dagegen immer den aktuellen Lead.
  const [basis] = useState<BlattWerte>(() => blattWerte(lead))
  const [w, setW] = useState<BlattWerte>(basis)
  const [versucht, setVersucht] = useState(false)
  const setze = <K extends keyof BlattWerte>(feld: K, wert: BlattWerte[K]) => setW((alt) => ({ ...alt, [feld]: wert }))
  const fehler = versucht ? pruefeBlatt(basis, w) : {}
  const members = sortiereMitglieder(alleMitglieder).filter((m): m is Member & { id: string } => !!m.id)

  // Geändert ist, was „Speichern“ schreiben würde (Leerzeichen am Rand zählen nicht)
  const hatAenderungen = Object.keys(blattPatch(basis, w)).length > 0
  useEffect(() => {
    onGeaendert(hatAenderungen)
    return () => onGeaendert(false)
  }, [onGeaendert, hatAenderungen])

  // Wo die Karte jetzt liegt (nicht der Stand beim Öffnen): dorthin legt „Rückgängig“ sie zurück
  const aktuelleListe = blattWerte(lead).board_liste
  // Wie crm.board_karte_anlegen: Wer widersprochen hat, kommt nicht neu aufs Board. Liegt die Karte schon dort, bleibt sie
  // verschiebbar und entfernbar.
  const listeGesperrt = lead.do_not_contact && !aktuelleListe

  const absenden = (e: FormEvent) => {
    e.preventDefault()
    setVersucht(true)
    if (speichern.isPending || Object.keys(pruefeBlatt(basis, w)).length > 0) return
    const patch = blattPatch(basis, w)
    // auch wenn erst eine Liste gewählt und dann im offenen Blatt der Widerspruch erfasst wurde
    if (listeGesperrt) delete patch.board_liste
    if (Object.keys(patch).length === 0) return onClose()
    speichern.mutate(
      { id: lead.id, patch },
      {
        onSuccess: () => {
          toast('Gespeichert.')
          onClose()
        },
      },
    )
  }

  const entfernen = () =>
    mitRueckfrage(() => {
      entferne({ id: lead.id, board_liste: aktuelleListe, board_seit: lead.board_seit })
      onClose()
    })

  const verfassen = verfassenUrl({ leadId: lead.id, zurueck: `${pathname}${search}` })
  // Der Composer ersetzt das Blatt (eigene Seite) – ungespeicherte Eingaben wären danach weg
  const zumVerfassen = (e: MouseEvent) => {
    if (!hatAenderungen || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    mitRueckfrage(() => void navigate(verfassen, { replace: ersetzen }))
  }

  return (
    <form onSubmit={absenden} noValidate className="flex min-h-full flex-col">
      <div className="grid gap-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <Feld label="Vorname" htmlFor={`${id}-vorname`}>
            <Input
              id={`${id}-vorname`}
              groesse="L"
              autoComplete="off"
              value={w.first_name}
              onChange={(e) => setze('first_name', e.target.value)}
              aria-invalid={fehler.name ? true : undefined}
            />
          </Feld>
          <Feld label="Nachname" htmlFor={`${id}-nachname`}>
            <Input
              id={`${id}-nachname`}
              groesse="L"
              autoComplete="off"
              value={w.last_name}
              onChange={(e) => setze('last_name', e.target.value)}
              aria-invalid={fehler.name ? true : undefined}
            />
          </Feld>
          {fehler.name ? (
            <p className="text-small text-danger col-span-2" role="alert">
              {fehler.name}
            </p>
          ) : null}
        </div>
        <Feld label="Anrede">
          {/* Noch einmal auf die gewählte Anrede tippen nimmt sie zurück (neutral: „Guten Tag Vorname Nachname“) */}
          <Wahl
            ariaLabel="Anrede"
            optionen={ANREDEN}
            wert={w.salutation === 'neutral' ? null : w.salutation}
            onChange={(k) => setze('salutation', k === w.salutation ? 'neutral' : k)}
          />
        </Feld>
        <Feld label="Firma" htmlFor={`${id}-firma`}>
          {/* Mit verknüpftem Unternehmen (alte Leads) schreibt die Datenbank den Firmennamen selbst – das Feld zeigt ihn nur */}
          <Input
            id={`${id}-firma`}
            groesse="L"
            autoComplete="off"
            disabled={!!lead.company_id}
            className="disabled:text-ink-2"
            value={w.company_name}
            onChange={(e) => setze('company_name', e.target.value)}
          />
        </Feld>
        <Feld label="LinkedIn-Link" htmlFor={`${id}-link`}>
          <Input
            id={`${id}-link`}
            groesse="L"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="linkedin.com/in/…"
            value={w.linkedin_url}
            onChange={(e) => setze('linkedin_url', e.target.value)}
            fehler={fehler.link}
          />
        </Feld>
        <Feld label="Zugehörigkeit">
          <Wahl
            ariaLabel="Zugehörigkeit"
            wert={w.owner_id}
            onChange={(k) => setze('owner_id', k)}
            optionen={members.map((m) => ({
              key: m.id,
              label: anzeigeName(m, m.id),
              icon: (
                <span aria-hidden className="inline-flex">
                  <Avatar member={m} groesse={22} />
                </span>
              ),
            }))}
          />
        </Feld>
        <Feld label="Liste">
          <fieldset disabled={listeGesperrt} className="min-w-0 disabled:opacity-50">
            <Wahl
              raster
              ariaLabel="Liste"
              optionen={LISTEN}
              wert={w.board_liste}
              onChange={(k) => setze('board_liste', k)}
            />
          </fieldset>
        </Feld>
        <Feld label="Notiz" htmlFor={`${id}-notiz`}>
          <Textarea
            id={`${id}-notiz`}
            // am Telefon 16 px wie die Felder darüber (iOS zoomt sonst beim Antippen)
            className="min-h-24 text-[15px] max-md:text-[16px]"
            value={w.notes}
            onChange={(e) => setze('notes', e.target.value)}
          />
        </Feld>
        <section aria-labelledby={`${id}-email`} className="border-line grid gap-2.5 border-t pt-4">
          <h3 id={`${id}-email`} className="text-small text-ink-2 font-medium">
            E-Mail
          </h3>
          <p className="text-body text-ink break-all">{lead.email ?? '–'}</p>
          <ErlaubnisBadge lead={lead} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ErlaubnisErfassen leadId={lead.id} trigger={<Button groesse="L">Erlaubnis erfassen</Button>} />
            <Link
              to={verfassen}
              replace={ersetzen}
              onClick={zumVerfassen}
              className="text-signal inline-flex h-11 items-center rounded-xs text-[15px] font-medium hover:underline"
            >
              E-Mail schreiben
            </Link>
          </div>
          {/* Leise, aber da: E-Mail › Antworten verweist bei einer Abmeldung auf „Widerspruch erfassen“ in der Lead-Karte */}
          <div>
            <WiderspruchErfassen
              schlicht
              leadId={lead.id}
              trigger={
                <Button variante="quiet" groesse="L" className="-ml-4" disabled={lead.do_not_contact}>
                  Widerspruch erfassen
                </Button>
              }
            />
          </div>
        </section>
        {aktuelleListe ? (
          <div className="border-line border-t pt-3">
            <Button variante="quiet" groesse="L" className="-ml-4" onClick={entfernen}>
              Karte entfernen
            </Button>
          </div>
        ) : null}
      </div>
      {/* Fuß bleibt beim Scrollen stehen. Das Sheet hat innen 24/20 px Abstand (px-6 py-5): -mx-6 und -mb-5 heben ihn auf,
          -bottom-5 lässt den Fuß bis an die Unterkante reichen (sonst scheint darunter ein Streifen Inhalt durch). */}
      <div className="bg-surface-raised border-line sticky -bottom-5 -mx-6 mt-auto -mb-5 flex justify-end gap-2 border-t px-6 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button groesse="L" variante="quiet" onClick={() => mitRueckfrage(onClose)}>
          Abbrechen
        </Button>
        <Button groesse="L" variante="primary" type="submit" busy={speichern.isPending}>
          Speichern
        </Button>
      </div>
    </form>
  )
}
