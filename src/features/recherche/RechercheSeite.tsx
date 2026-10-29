// /auftrag/recherche/:id – LinkedIn-Recherchelauf (29.10.2026, Entwicklungsauftrag Vincent). Steuerzentrale für den
// Browser-Agenten, den der Recherche-Dienst nach „Recherche starten“ selbst startet (Agent-Zustand oben, Migration 18):
// Fortschritt, Kontrollpunkt alle 10 Profile, „Profil prüfen und eintragen“, Ausgangspunkte
// aus dem CRM, die vollständigen Regeln und alle Profile des Laufs. Wie /auftrag ohne Tastenkürzel und mit beschrifteten
// Knöpfen; die Datenbank erzwingt Ziel, Dubletten, Pflichtangaben und Kontrollpunkt (Migration 17).
import { Copy, ExternalLink, Pause, Play, Search, TriangleAlert } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { toast } from '@/components/toast'
import {
  Button,
  Checkbox,
  Chip,
  cn,
  Dialog,
  FormField,
  Input,
  LadeFehler,
  SeitenKopf,
  Skeleton,
  Textarea,
  type ChipTon,
} from '@/components/ui'
import { useMe, useMeId } from '@/data/members'
import {
  recherchePruefen,
  useAnfragenWoche,
  useAusgangspunkte,
  useLauf,
  useLaufProfile,
  useRechercheAgentStarten,
  useRechercheEintragen,
  useRechercheKontrolle,
  useRechercheStarten,
  useRechercheStatus,
  type PruefErgebnis,
  type RechercheErgebnis,
  type RechercheLauf,
  type RechercheProfil,
} from '@/data/recherche'
import { fmtDatum, fmtZeit } from '@/lib/format'
import { anzeigeName } from '@/lib/mitglied'
import { kopieren } from '@/lib/zwischenablage'
import { Kachel, Kacheln } from '@/features/telefon/ansichten/Teile'
import {
  agentZustand,
  ausgangspunkteFuer,
  fehlerText,
  formularFehler,
  gesendetErlaubt,
  LEERES_FORMULAR,
  verbleibend,
  type AgentZustand,
  type Formular,
} from './logik'
import {
  ALLE_ABSCHNITTE,
  ERGEBNIS_LABEL,
  KATEGORIEN,
  KONTROLLE,
  kontrolleFaellig,
  REGELN_STAND,
  startAnweisung,
  STATUS_LABEL,
} from './regeln'

const WOCHE_WARNUNG = 80

const STATUS_TON: Record<string, ChipTon> = {
  laeuft: 'today',
  pausiert: 'later',
  abgeschlossen: 'done',
  abgebrochen: 'ended',
  fehler: 'danger',
}
const ERGEBNIS_TON: Record<string, ChipTon> = {
  gesendet: 'done',
  dublette: 'later',
  nicht_qualifiziert: 'ended',
  unklar: 'muted',
  fehler: 'danger',
}

function Abschnitt({ nr, titel, id, children }: { nr: number; titel: string; id?: string; children: ReactNode }) {
  return (
    <section className="mt-10 grid gap-3" id={id} aria-label={titel} data-recherche-abschnitt={titel}>
      <h2 className="text-h2 border-line border-b pb-2">
        {nr}. {titel}
      </h2>
      {children}
    </section>
  )
}

// ── Kontrollpunkt ──────────────────────────────────────────────────────────────────────────────────────────

const AGENT_PUNKT: Record<AgentZustand['art'], string> = {
  startet: 'bg-signal animate-pulse',
  arbeitet: 'bg-done animate-pulse',
  kein_dienst: 'bg-overdue',
  still: 'bg-overdue',
  fehler: 'bg-danger',
  beendet: 'bg-deco',
  manuell: 'bg-deco',
  angehalten: 'bg-deco',
  aus: 'bg-deco',
}

/** Was der Agent gerade tut – plus „Agent (neu) starten“ und die Start-Anweisung für den Weg ohne Recherche-Dienst. */
function AgentPanel({ lauf, fremd, prompt }: { lauf: RechercheLauf; fremd: boolean; prompt: string }) {
  const agent = useRechercheAgentStarten()
  const [promptOffen, setPromptOffen] = useState(false)
  const z = agentZustand(lauf)
  if (z.art === 'aus' && !z.text) return null
  return (
    <section
      className="bg-sidebar mb-6 grid max-w-[880px] gap-2 rounded-md px-4 py-3.5 md:px-5"
      aria-label="Agent"
      data-agent={z.art}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('size-2 shrink-0 rounded-full', AGENT_PUNKT[z.art])} aria-hidden />
          <h2 className="text-ink-bright text-[15px] font-semibold" role="status">
            {z.titel}
          </h2>
        </div>
        {!fremd && z.starten ? (
          <Button variante="primary" icon={Play} busy={agent.isPending} onClick={() => agent.mutate(lauf.id)}>
            {z.starten === 'neu' ? 'Agent neu starten' : 'Agent starten'}
          </Button>
        ) : null}
      </div>
      {z.text ? <p className="text-small text-ink-2 max-w-[75ch] whitespace-pre-line">{z.text}</p> : null}
      {!fremd && lauf.status === 'laeuft' ? (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2 pt-0.5">
          <span className="text-small text-ink-3 mr-1">Ohne Recherche-Dienst:</span>
          <Button
            variante="quiet"
            icon={Copy}
            onClick={() =>
              void kopieren(prompt).then((r) =>
                toast(r === 'ok' ? 'Start-Anweisung kopiert – in den Agenten einfügen.' : 'Text markiert – ⌘C'),
              )
            }
          >
            Start-Anweisung kopieren
          </Button>
          <Button variante="quiet" onClick={() => setPromptOffen((o) => !o)} aria-expanded={promptOffen}>
            {promptOffen ? 'Anweisung ausblenden' : 'Anweisung ansehen'}
          </Button>
        </div>
      ) : null}
      {promptOffen ? (
        <pre className="bg-surface-hover border-line text-ink-2 rounded-sm border px-3.5 py-3 font-mono text-[12.5px] whitespace-pre-wrap">
          {prompt}
        </pre>
      ) : null}
    </section>
  )
}

function Kontrollpunkt({ lauf }: { lauf: RechercheLauf }) {
  const kontrolle = useRechercheKontrolle()
  const [haken, setHaken] = useState<boolean[]>(() => KONTROLLE.map(() => false))
  const alle = haken.every(Boolean)
  return (
    <section
      className="border-overdue bg-overdue-tint/40 mt-6 grid gap-3 rounded-md border px-4 py-3.5"
      aria-label="Kontrollpunkt"
      data-recherche-kontrollpunkt
    >
      <h2 className="text-ink-bright text-[15px] font-semibold">
        Kontrollpunkt nach {lauf.geprueft} geprüften Profilen
      </h2>
      <p className="text-small text-ink-2">
        Bevor es weitergeht: die letzten Einträge unten unter „Profile dieses Laufs“ gegen die Kriterien prüfen und
        jeden Punkt bestätigen. Passt etwas nicht, den Lauf pausieren und Vincent Bescheid geben.
      </p>
      <div className="grid gap-1.5">
        {KONTROLLE.map((k, i) => (
          <Checkbox
            key={k}
            label={k}
            checked={haken[i] ?? false}
            onChange={(e) => setHaken((h) => h.map((x, j) => (j === i ? e.target.checked : x)))}
          />
        ))}
      </div>
      <div>
        <Button
          variante="primary"
          busy={kontrolle.isPending}
          onClick={() => {
            if (!alle) return toast('Erst alle Punkte bestätigen.')
            kontrolle.mutate(lauf.id)
          }}
        >
          Kriterien geprüft – weiter
        </Button>
      </div>
    </section>
  )
}

// ── Profil prüfen und eintragen ────────────────────────────────────────────────────────────────────────────

function Eintragen({ lauf, gesperrt }: { lauf: RechercheLauf; gesperrt: string | null }) {
  const eintragen = useRechercheEintragen()
  const [f, setF] = useState<Formular>(LEERES_FORMULAR)
  const [pruefung, setPruefung] = useState<{ url: string; ergebnis: PruefErgebnis } | null>(null)
  const [prueft, setPrueft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [erledigt, setErledigt] = useState<string | null>(null)
  const setze = (p: Partial<Formular>) => {
    setFehler(null)
    setErledigt(null)
    setF((x) => ({ ...x, ...p }))
  }
  const darfSenden = gesendetErlaubt(f, pruefung)

  const pruefen = async () => {
    const fe = formularFehler(f, 'pruefen')
    if (fe) return setFehler(fe)
    setPrueft(true)
    try {
      const e = await recherchePruefen({
        lauf: lauf.id,
        url: f.url,
        vorname: f.vorname,
        nachname: f.nachname,
        firma: f.firma,
      })
      setPruefung({ url: f.url, ergebnis: e })
    } catch (e) {
      setFehler(fehlerText(e))
    } finally {
      setPrueft(false)
    }
  }

  const buchen = (ergebnis: RechercheErgebnis) => {
    const fe = formularFehler(f, ergebnis)
    if (fe) return setFehler(fe)
    const grund =
      ergebnis === 'dublette' && !f.grund.trim() && pruefung && !pruefung.ergebnis.frei
        ? pruefung.ergebnis.grund
        : f.grund
    eintragen.mutate(
      { lauf: lauf.id, ...f, grund, ergebnis },
      {
        onSuccess: () => {
          const name = [f.vorname, f.nachname].filter(Boolean).join(' ') || f.url
          setErledigt(`${name}: ${ERGEBNIS_LABEL[ergebnis]} – eingetragen um ${fmtZeit(new Date())}.`)
          setF({ ...LEERES_FORMULAR, ausgangspunkt: f.ausgangspunkt })
          setPruefung(null)
        },
        onError: (e) => setFehler(fehlerText(e)),
      },
    )
  }

  const aus = !!gesperrt || eintragen.isPending
  return (
    <div className="grid max-w-[880px] gap-3.5" data-recherche-formular>
      {gesperrt ? (
        <p className="text-small text-overdue" role="status">
          {gesperrt}
        </p>
      ) : null}
      <div className="grid gap-3.5 md:grid-cols-2">
        <FormField label="LinkedIn-Profil-URL" pflicht htmlFor="r-url" className="md:col-span-2">
          <Input
            id="r-url"
            value={f.url}
            disabled={aus}
            onChange={(e) => setze({ url: e.target.value })}
            placeholder="https://www.linkedin.com/in/vorname-nachname"
          />
        </FormField>
        <FormField label="Vorname" htmlFor="r-vorname">
          <Input id="r-vorname" value={f.vorname} disabled={aus} onChange={(e) => setze({ vorname: e.target.value })} />
        </FormField>
        <FormField label="Nachname" htmlFor="r-nachname">
          <Input
            id="r-nachname"
            value={f.nachname}
            disabled={aus}
            onChange={(e) => setze({ nachname: e.target.value })}
          />
        </FormField>
        <FormField label="Firma (aktueller Arbeitgeber)" htmlFor="r-firma">
          <Input id="r-firma" value={f.firma} disabled={aus} onChange={(e) => setze({ firma: e.target.value })} />
        </FormField>
        <FormField label="Aktuelle Position" htmlFor="r-position">
          <Input
            id="r-position"
            value={f.position}
            disabled={aus}
            onChange={(e) => setze({ position: e.target.value })}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variante="secondary" icon={Search} busy={prueft} disabled={aus} onClick={() => void pruefen()}>
          Prüfen
        </Button>
        {pruefung ? (
          <span
            role="status"
            data-recherche-pruefung={pruefung.ergebnis.frei ? 'frei' : 'nicht-frei'}
            className={cn(
              'rounded-sm px-3 py-1.5 text-[13.5px]',
              pruefung.ergebnis.frei ? 'bg-done-tint text-done' : 'bg-overdue-tint text-overdue',
            )}
          >
            {pruefung.ergebnis.frei ? 'Frei – ' : 'Nicht anfragen – '}
            {pruefung.ergebnis.grund}
          </span>
        ) : (
          <span className="text-small text-ink-3">
            Vor jeder Anfrage prüfen – nur bei „Frei“ auf LinkedIn vernetzen.
          </span>
        )}
      </div>

      <div className="grid gap-3.5 md:grid-cols-2">
        {/* Umbrechende Knöpfe statt Segment: der Agent muss alle vier Kategorien sehen, auch auf schmalen Fenstern. */}
        <FormField label="Kategorie (Zielrolle)" className="md:col-span-2">
          <div role="group" aria-label="Kategorie" className="flex flex-wrap gap-1.5">
            {KATEGORIEN.map((k) => (
              <button
                key={k.key}
                type="button"
                aria-pressed={f.kategorie === k.key}
                disabled={aus}
                onClick={() => setze({ kategorie: k.key })}
                className={cn(
                  'text-small h-8 rounded-sm border px-3 disabled:opacity-50',
                  f.kategorie === k.key
                    ? 'border-signal bg-signal-tint text-signal font-medium'
                    : 'border-line-strong text-ink-2 hover:bg-surface-hover',
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </FormField>
        <FormField label="Firmen-Website (Quelle der Prüfung)" htmlFor="r-website">
          <Input
            id="r-website"
            value={f.firmaWebsite}
            disabled={aus}
            onChange={(e) => setze({ firmaWebsite: e.target.value })}
            placeholder="https://…"
          />
        </FormField>
        <FormField label="Qualifizierungsgrund / Grund" htmlFor="r-grund" className="md:col-span-2">
          <Textarea
            id="r-grund"
            rows={2}
            value={f.grund}
            disabled={aus}
            onChange={(e) => setze({ grund: e.target.value })}
            placeholder="z. B. PV + Speicher für Privathaushalte, ca. 30 MA, eigener Kundendienst; Rolle: Leiter Kundenservice"
          />
        </FormField>
        <FormField label="Ausgangspunkt (woher das Profil kam)" htmlFor="r-ausgang" className="md:col-span-2">
          <Input
            id="r-ausgang"
            value={f.ausgangspunkt}
            disabled={aus}
            onChange={(e) => setze({ ausgangspunkt: e.target.value })}
            placeholder="z. B. Ähnliche Profile von Max Muster · Mitarbeiterliste Muster Solar GmbH"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variante="primary"
          icon={Play}
          busy={eintragen.isPending}
          disabled={aus || !darfSenden}
          disabledGrund={!darfSenden ? 'Erst „Prüfen“ – nur bei „Frei“' : undefined}
          onClick={() => buchen('gesendet')}
        >
          Vernetzungsanfrage gesendet
        </Button>
        <Button variante="secondary" disabled={aus} onClick={() => buchen('dublette')}>
          Als Dublette eintragen
        </Button>
        <Button variante="secondary" disabled={aus} onClick={() => buchen('nicht_qualifiziert')}>
          Nicht qualifiziert
        </Button>
        <Button variante="quiet" disabled={aus} onClick={() => buchen('unklar')}>
          Unklar – überspringen
        </Button>
        <Button variante="quiet" disabled={aus} onClick={() => buchen('fehler')}>
          Senden fehlgeschlagen
        </Button>
      </div>
      {fehler ? (
        <p className="text-danger text-[13.5px]" role="alert" data-recherche-fehler>
          {fehler}
        </p>
      ) : null}
      {erledigt ? (
        <p className="text-done text-[13.5px]" role="status" data-recherche-erledigt>
          {erledigt}
        </p>
      ) : null}
    </div>
  )
}

// ── Seite ──────────────────────────────────────────────────────────────────────────────────────────────────

export function Component() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = useMe()
  const meId = useMeId()
  const laufQ = useLauf(id)
  const lauf = laufQ.data
  const aktiv = lauf?.status === 'laeuft' || lauf?.status === 'pausiert'
  const profile = useLaufProfile(id, aktiv)
  const { data: woche } = useAnfragenWoche(meId)
  const { data: punkte } = useAusgangspunkte()
  const status = useRechercheStatus()
  const starten = useRechercheStarten()
  const [melden, setMelden] = useState(false)
  const [meldung, setMeldung] = useState('')
  const [beenden, setBeenden] = useState(false)

  const start = useMemo(() => ausgangspunkteFuer(punkte ?? [], id ?? ''), [punkte, id])
  if (laufQ.isError)
    return <LadeFehler text="Recherchelauf konnte nicht geladen werden." onNochmal={() => void laufQ.refetch()} />
  if (laufQ.isLoading || !lauf)
    return laufQ.isLoading ? <Skeleton zeilen={8} /> : <p className="text-ui py-6">Lauf nicht gefunden.</p>

  const fremd = !!meId && lauf.member_id !== meId
  const url =
    typeof window !== 'undefined' ? `${window.location.origin}${PFADE.recherche(lauf.id)}` : PFADE.recherche(lauf.id)
  const prompt = startAnweisung(url, anzeigeName(me) || 'Vincent')
  const faellig = kontrolleFaellig(lauf)
  const gesperrt = fremd
    ? 'Dieser Lauf gehört einer anderen Person – nur ansehen.'
    : lauf.status === 'pausiert'
      ? 'Lauf pausiert – oben „Fortsetzen“.'
      : lauf.status === 'fehler'
        ? 'Lauf wegen einer Einschränkung angehalten – erst klären, dann „Fortsetzen“.'
        : !aktiv
          ? 'Lauf beendet – für weitere Anfragen einen neuen Lauf starten.'
          : faellig
            ? 'Kontrollpunkt fällig – erst oben bestätigen.'
            : verbleibend(lauf) === 0
              ? 'Ziel erreicht.'
              : null

  const neuStarten = () => starten.mutate(undefined, { onSuccess: (l) => navigate(PFADE.recherche(l.id)) })

  return (
    <div className="pb-24" data-recherche-seite data-status={lauf.status}>
      <SeitenKopf
        titel="LinkedIn-Recherche"
        kontext={`Lauf vom ${fmtDatum(lauf.started_at)} · ${REGELN_STAND}`}
        rechts={
          <>
            <Chip ton={STATUS_TON[lauf.status] ?? 'neutral'} data-recherche-status={lauf.status}>
              {STATUS_LABEL[lauf.status] ?? lauf.status}
            </Chip>
            {!fremd && lauf.status === 'laeuft' ? (
              <Button
                variante="secondary"
                icon={Pause}
                onClick={() => status.mutate({ lauf: lauf.id, status: 'pausiert' })}
              >
                Pausieren
              </Button>
            ) : null}
            {!fremd && (lauf.status === 'pausiert' || lauf.status === 'fehler') ? (
              <Button
                variante="secondary"
                icon={Play}
                onClick={() => status.mutate({ lauf: lauf.id, status: 'laeuft' })}
              >
                Fortsetzen
              </Button>
            ) : null}
            {!fremd && aktiv ? (
              <Button variante="secondary" icon={TriangleAlert} onClick={() => setMelden(true)}>
                LinkedIn-Einschränkung melden
              </Button>
            ) : null}
            {!fremd && (aktiv || lauf.status === 'fehler') ? (
              <Button variante="quiet" onClick={() => setBeenden(true)}>
                Lauf beenden
              </Button>
            ) : null}
            {!aktiv && lauf.status !== 'fehler' ? (
              <Button variante="primary" icon={Play} busy={starten.isPending} onClick={neuStarten}>
                Neuen Lauf starten
              </Button>
            ) : null}
          </>
        }
      />

      <AgentPanel lauf={lauf} fremd={fremd} prompt={prompt} />

      <Kacheln>
        <Kachel
          label="Geprüfte Profile"
          wert={lauf.geprueft}
          hinweis={`${lauf.abgelehnt} abgelehnt · ${lauf.unklar} unklar`}
        />
        <Kachel
          label="Qualifiziert"
          wert={lauf.qualifiziert}
          hinweis={lauf.fehler ? `${lauf.fehler} Senden fehlgeschlagen` : 'ICP passt'}
        />
        <Kachel label="Dubletten erkannt" wert={lauf.dubletten} hinweis="nicht erneut angefragt" />
        <Kachel
          label="Anfragen gesendet"
          wert={`${lauf.gesendet} / ${lauf.ziel}`}
          hinweis={`noch ${verbleibend(lauf)} bis zum Ziel`}
          ton={lauf.gesendet >= lauf.ziel ? 'done' : undefined}
        />
      </Kacheln>

      <div className="text-small text-ink-2 -mt-4 grid gap-1.5" data-recherche-zeile>
        <span>
          Zuletzt bearbeitet: <b className="text-ink">{lauf.aktuelles_profil ?? '–'}</b>
          {' · '}
          Anfragen der letzten 7 Tage:{' '}
          <b className={cn((woche ?? 0) >= WOCHE_WARNUNG ? 'text-overdue' : 'text-ink')}>{woche ?? '–'}</b>
          {(woche ?? 0) >= WOCHE_WARNUNG ? ' – LinkedIn begrenzt kostenlose Konten wöchentlich, lieber pausieren.' : ''}
          {lauf.batch_id ? (
            <>
              {' · '}
              <Link className="underline underline-offset-2" to={`${PFADE.leads}?quelle=${lauf.batch_id}`}>
                Leads dieses Laufs
              </Link>
            </>
          ) : null}
        </span>
        {lauf.meldung ? (
          <p
            className={cn(
              'rounded-sm px-3 py-2',
              lauf.status === 'fehler' ? 'bg-danger-tint text-danger' : 'bg-surface-hover text-ink',
            )}
            role="status"
            data-recherche-meldung
          >
            {lauf.meldung}
          </p>
        ) : null}
      </div>

      {aktiv && faellig && !fremd && lauf.status === 'laeuft' ? <Kontrollpunkt lauf={lauf} /> : null}

      <Abschnitt nr={1} titel="Profil prüfen und eintragen">
        <Eintragen lauf={lauf} gesperrt={gesperrt} />
      </Abschnitt>

      <Abschnitt nr={2} titel="Ausgangspunkte">
        <p className="text-small text-ink-3 max-w-[75ch]">
          Vernetzte Kontakte und ihre Firmen aus dem CRM, passende Positionen zuerst. Von hier aus „Weitere Profile
          ansehen“, den Reiter „Personen“ der Unternehmensseite und Netzwerkvorschläge nutzen. Jeder Lauf bekommt eine
          andere Auswahl.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <ul className="grid gap-1.5" aria-label="Startprofile">
            {start.personen.map((p) => (
              <li key={p.id} className="text-[13.5px]">
                <a
                  href={p.linkedin_url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink-bright inline-flex items-center gap-1 font-medium hover:underline"
                >
                  {p.full_name}
                  <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
                </a>
                <span className="text-ink-3"> · {[p.role_title, p.company_name].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
            {start.personen.length === 0 ? (
              <li className="text-small text-ink-3">Noch keine qualifizierten Kontakte im CRM.</li>
            ) : null}
          </ul>
          <ul className="grid gap-1.5" aria-label="Startfirmen">
            {start.firmen.map((f) => (
              <li key={f} className="text-[13.5px]">
                <a
                  href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(f)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink inline-flex items-center gap-1 hover:underline"
                >
                  {f}
                  <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Abschnitt>

      <Abschnitt nr={3} titel="Regeln" id="regeln">
        <div className="grid max-w-[880px] gap-5" data-recherche-regeln>
          {ALLE_ABSCHNITTE.map((a) => (
            <div key={a.titel} className="grid gap-1.5">
              <h3 className="text-ink-bright text-[14.5px] font-semibold">{a.titel}</h3>
              <ul className="text-ink-2 grid list-disc gap-1 pl-5 text-[13.5px] leading-relaxed">
                {a.punkte.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              {a.hinweis ? <p className="text-small text-ink-3">{a.hinweis}</p> : null}
            </div>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt nr={4} titel="Profile dieses Laufs">
        <ProfilListe profile={profile.data ?? []} />
      </Abschnitt>

      <Dialog
        offen={melden}
        onOpenChange={setMelden}
        titel="LinkedIn-Einschränkung melden"
        text="Der Lauf wird angehalten. Bereits eingetragene Anfragen bleiben erhalten; „Fortsetzen“ erst, wenn die Einschränkung geklärt ist."
        kinder={
          <FormField label="Wortlaut der LinkedIn-Meldung" htmlFor="r-meldung">
            <Textarea id="r-meldung" rows={3} value={meldung} onChange={(e) => setMeldung(e.target.value)} />
          </FormField>
        }
        primaer={{
          label: 'Lauf anhalten',
          onClick: () => {
            status.mutate(
              { lauf: lauf.id, status: 'fehler', meldung: meldung.trim() || 'LinkedIn-Einschränkung (ohne Wortlaut)' },
              { onSuccess: () => setMelden(false) },
            )
          },
          busy: status.isPending,
        }}
      />
      <Dialog
        offen={beenden}
        onOpenChange={setBeenden}
        titel="Lauf beenden?"
        text={`${lauf.gesendet} Anfragen sind eingetragen und bleiben erhalten. Danach lässt sich ein neuer Lauf starten.`}
        primaer={{
          label: 'Beenden',
          onClick: () =>
            status.mutate(
              {
                lauf: lauf.id,
                status: 'abgeschlossen',
                meldung: `Beendet bei ${lauf.gesendet} von ${lauf.ziel} Anfragen.`,
              },
              { onSuccess: () => setBeenden(false) },
            ),
          busy: status.isPending,
        }}
      />
    </div>
  )
}

function ProfilListe({ profile }: { profile: readonly RechercheProfil[] }) {
  if (!profile.length) return <p className="text-small text-ink-3">Noch kein Profil eingetragen.</p>
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[820px] border-collapse text-[13px]" aria-label="Profile dieses Laufs">
        <thead>
          <tr className="label border-line-strong border-b text-left">
            <th className="py-2 pr-3 font-medium">Zeit</th>
            <th className="py-2 pr-3 font-medium">Ergebnis</th>
            <th className="py-2 pr-3 font-medium">Person</th>
            <th className="py-2 pr-3 font-medium">Firma</th>
            <th className="py-2 pr-3 font-medium">Position</th>
            <th className="py-2 pr-3 font-medium">Kat.</th>
            <th className="py-2 font-medium">Grund</th>
          </tr>
        </thead>
        <tbody>
          {profile.map((p) => (
            <tr key={p.id} className="border-line border-b align-top" data-recherche-profil={p.ergebnis}>
              <td className="tnum text-ink-3 py-2 pr-3 font-mono text-[12px] whitespace-nowrap">
                {fmtZeit(p.created_at)}
              </td>
              <td className="py-2 pr-3">
                <Chip ton={ERGEBNIS_TON[p.ergebnis] ?? 'neutral'}>{ERGEBNIS_LABEL[p.ergebnis] ?? p.ergebnis}</Chip>
              </td>
              <td className="py-2 pr-3">
                <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="text-ink-bright hover:underline">
                  {[p.vorname, p.nachname].filter(Boolean).join(' ') || p.linkedin_url_norm || p.linkedin_url}
                </a>
              </td>
              <td className="py-2 pr-3">{p.firma ?? '–'}</td>
              <td className="py-2 pr-3">{p.position ?? '–'}</td>
              <td className="py-2 pr-3">{p.kategorie ?? '–'}</td>
              <td className="text-ink-2 max-w-[320px] py-2">{p.grund ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
