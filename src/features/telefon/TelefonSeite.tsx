// M3 – `/telefon` (BAUPLAN § 3.4 TelefonSeite.tsx, ux § 3.5.1, DESIGN-SYSTEM § 5.13): Kopf mit Zählern, Segment Heute · Alle,
// Dropdown Liste, „Call-Block starten“ (Enter); Sektion Rückrufe (48 px) → Anrufliste (44 px) → eingeklappt „Noch nicht anrufbar“
// mit Grund und „Anrufgrund setzen“ (Bulk „Alle mit LinkedIn-Antwort → ‚LinkedIn vernetzt + Antwort‘“). Hotkeys J K ↵ R S N.
// Runde 3: Leerzustand und „Noch nicht anrufbar“ nach Grund (keine Nummer · ohne Anrufgrund · gesperrt), nächster Schritt passend.
import { ChevronDown, Phone } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { peekOeffnen } from '@/app/befehle'
import { PFADE } from '@/app/pfade'
import { NotizFeld, Spaeter } from '@/components/aktionen'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip, ZeitChip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { DropdownMenu, type MenuEintrag } from '@/components/ui/DropdownMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segment } from '@/components/ui/Segment'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { SektionsKopf } from '@/components/ui/SektionsKopf'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { Skeleton } from '@/components/ui/Skeleton'
import { sessionKey, useCallsSession } from '@/data/calls'
import { useLead } from '@/data/leads'
import { useMe } from '@/data/members'
import { useSettings } from '@/data/settings'
import { useSavedViews } from '@/data/views'
import { fmtDatumKurz, fmtZeit, heuteBerlin } from '@/lib/format'
import { useHotkeyScope, useHotkeys } from '@/lib/keyboard'
import { ANRUFGRUND_LABEL, LEER, telefonGrundLabel } from '@/texte/de'
import { anrufgrundVorbelegung, useAnrufgrundSetzen } from './anrufgrund'
import { AnrufgrundSetzen } from './AnrufgrundSetzen'
import { listeIds, type AnrufZeile, type GesperrtZeile, type RueckrufZeile } from './anrufliste'
import { BlockEnde } from './BlockEnde'
import { blockAktuellerLead, blockDauerSec, blockStarten, blockZeit, useCallBlock } from './CallBlock'
import { useCallOutcomeDefs, type LetzterAnruf } from '@/data/calls'
import { ERGEBNISSE } from './ergebnisse'
import { SLOTS_STANDARD } from './kadenz'
import { ListeEntfernen } from './ListeEntfernen'
import {
  hauptGruppe,
  leadsOhneNummerPfad,
  NICHT_AKTION,
  NICHT_ERKLAERUNG,
  NICHT_FILTER_LABEL,
  nichtFiltern,
  nichtSatz,
  nichtZaehlen,
  type NichtFilter,
  type NichtGruppe,
} from './nichtAnrufbar'
import { verpasstDauer } from './anzeige'
import { RueckrufPlanen } from './RueckrufPlanen'
import { useAnrufliste } from './useAnrufliste'
import { blockZusammenfassung } from './zusammenfassung'
import { anzeigeName } from '@/lib/mitglied'

type Segmentwert = 'heute' | 'alle'

const ROLLE_KURZ: Record<string, string> = {
  geschaeftsfuehrer: 'GF',
  inhaber: 'Inhaber',
  kundenbetreuer: 'Kundenbetreuer',
  innendienst: 'Innendienst',
  vertrieb: 'Vertrieb',
  projektleiter: 'Projektleiter',
  sonstiges: '',
  unbekannt: '',
}

function kurzErgebnis(c: LetzterAnruf): string {
  return ERGEBNISSE.find((e) => e.outcome === c.outcome)?.kurz ?? c.outcome
}

/** „mit Frau Behrens“ / „mit Zentrale“ aus dem letzten Anruf (ux § 3.5.1 „vereinbart am … mit …“). */
function mitWem(c: LetzterAnruf | null): string | null {
  if (!c) return null
  if (c.reached_name) return c.reached_name
  if (c.reached_person === 'zentrale') return 'Zentrale'
  if (c.reached_person === 'entscheider') return 'Entscheider'
  if (c.reached_person === 'assistenz') return 'Assistenz'
  return null
}

function rueckrufTitel(z: RueckrufZeile, mit: string | null): string {
  return [z.lead.full_name, z.lead.company_name, mit ? `mit ${mit}` : null, z.task.note].filter(Boolean).join(' · ')
}

function anrufPfad(leadId: string, taskId?: string | null): string {
  const q = new URLSearchParams({ zurueck: PFADE.telefon })
  if (taskId) q.set('task', taskId)
  return `${PFADE.anruf(leadId)}?${q.toString()}`
}

export function Component() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const me = useMe()
  const { data: settings } = useSettings()
  const { data: defs } = useCallOutcomeDefs()
  const views = useSavedViews('telefon')
  const block = useCallBlock()
  const listeKey = params.get('liste') ?? 'standard'
  const [segment, setSegment] = useState<Segmentwert>('heute')
  const [cursor, setCursor] = useState<string | null>(null)
  const [nichtOffen, setNichtOffen] = useState(false)
  const [nichtFilter, setNichtFilter] = useState<NichtFilter>('alle')
  const [kommendOffen, setKommendOffen] = useState(true)
  const [notizOffen, setNotizOffen] = useState<string | null>(null)
  const [entfernenOffen, setEntfernenOffen] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const blockStartVersucht = useRef(false)
  useHotkeyScope('liste')

  const gewaehlteAnsicht = views.data?.find((v) => v.id === listeKey) ?? null
  const zustaendig: 'me' | 'alle' =
    listeKey === 'alle' ||
    (gewaehlteAnsicht && (gewaehlteAnsicht.filters as { zustaendig?: unknown } | null)?.zustaendig === 'alle')
      ? 'alle'
      : 'me'
  const { liste, istLaden, jetzt, fehler, nachladen } = useAnrufliste({ zustaendig, alle: segment === 'alle' })
  const { setzen: anrufgrundSetzen, isPending: bulkLaeuft } = useAnrufgrundSetzen()

  const zeilen = useMemo(() => [...liste.rueckrufe, ...liste.anrufliste], [liste])
  const ids = useMemo(() => zeilen.map((z) => z.lead.id), [zeilen])
  const cursorId = cursor && ids.includes(cursor) ? cursor : (ids[0] ?? null)
  // Cold Calling (16.10.2026): Leads ohne Anrufgrund stehen jetzt in der Anrufliste – der Sammel-Beleg für alle mit
  // LinkedIn-Antwort hängt deshalb an der Anrufliste, nicht mehr an „Noch nicht anrufbar“.
  const bulkKandidaten = useMemo(
    () =>
      liste.anrufliste.filter(
        (z) => !z.lead.call_basis && anrufgrundVorbelegung(z.lead) === 'linkedin_vernetzt_antwort',
      ),
    [liste.anrufliste],
  )

  // Leerzustand nach Grund (Runde 2/3: 119 „Keine Nummer“ + 2 „Firma gesperrt“ hießen „121 warten auf einen Anrufgrund“)
  const nichtZaehlung = useMemo(() => nichtZaehlen(liste.nichtAnrufbar), [liste.nichtAnrufbar])
  const nichtHaupt = hauptGruppe(nichtZaehlung)
  // Filter mit 0 Treffern (Daten haben sich geändert) fällt auf „Alle“ zurück
  const nichtFilterWirksam: NichtFilter =
    nichtFilter !== 'alle' && nichtZaehlung[nichtFilter] === 0 ? 'alle' : nichtFilter
  const nichtSichtbar = useMemo(
    () => nichtFiltern(liste.nichtAnrufbar, nichtFilterWirksam),
    [liste.nichtAnrufbar, nichtFilterWirksam],
  )
  const nichtZeigen = (g: NichtGruppe) => {
    setNichtFilter(g)
    setNichtOffen(true)
    window.requestAnimationFrame?.(() =>
      document.getElementById('nicht-anrufbar')?.scrollIntoView?.({ block: 'start' }),
    )
  }
  const leadsOhneNummer = leadsOhneNummerPfad(zustaendig)

  // Block-Timer in der Hinweiszeile
  useEffect(() => {
    if (!block) return
    const t = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [block])
  void tick

  const starten = () => {
    const alle = listeIds(liste)
    const erster = alle[0]
    if (!erster) return
    const s = blockStarten(alle)
    navigate(`${PFADE.anruf(erster)}?block=${s.id}&zurueck=${encodeURIComponent(PFADE.telefon)}`)
  }

  // `?block=start` (Palette-Befehl): Block starten, sobald die Liste da ist
  useEffect(() => {
    if (params.get('block') !== 'start' || istLaden || blockStartVersucht.current) return
    blockStartVersucht.current = true
    const next = new URLSearchParams(params)
    next.delete('block')
    setParams(next, { replace: true })
    if (!block && ids.length) starten()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, istLaden, ids.length, block])

  const bewegen = (delta: number) => {
    if (!ids.length) return
    const i = cursorId ? ids.indexOf(cursorId) : -1
    const n = Math.min(ids.length - 1, Math.max(0, i + delta))
    const ziel = ids[n]
    if (ziel) {
      setCursor(ziel)
      document.querySelector(`[data-lead-zeile="${ziel}"]`)?.scrollIntoView?.({ block: 'nearest' })
    }
  }
  const oeffnen = (leadId: string) => {
    const z = zeilen.find((x) => x.lead.id === leadId)
    navigate(anrufPfad(leadId, z?.art === 'rueckruf' ? z.task.id : null))
  }

  useHotkeys(
    'liste',
    {
      j: () => bewegen(1),
      arrowdown: () => bewegen(1),
      k: () => bewegen(-1),
      arrowup: () => bewegen(-1),
      enter: () => {
        if (block) {
          const l = blockAktuellerLead(block)
          if (l) navigate(`${PFADE.anruf(l)}?block=${block.id}`)
        } else if (cursorId && cursor) oeffnen(cursorId)
        else starten()
      },
      r: () => {
        if (!cursorId) return
        const z = zeilen.find((x) => x.lead.id === cursorId)
        if (!z || z.art === 'rueckruf') return
        setEntfernenOffen(cursorId)
      },
      n: () => {
        if (cursorId) setNotizOffen((o) => (o === cursorId ? null : cursorId))
      },
    },
    [ids, cursorId, cursor, block, zeilen],
  )

  const bulk = async () => {
    let n = 0
    for (const z of bulkKandidaten) {
      try {
        await anrufgrundSetzen(z.lead, 'linkedin_vernetzt_antwort', null, null)
        n++
      } catch {
        break
      }
    }
    if (n) toast(`Anrufgrund gesetzt für ${n} Leads: ${ANRUFGRUND_LABEL.linkedin_vernetzt_antwort}.`)
  }

  const listenEintraege: (MenuEintrag | 'trenner')[] = [
    { label: 'Anrufliste Standard', onSelect: () => setParams({ liste: 'standard' }) },
    { label: 'Alle Zuständigen', onSelect: () => setParams({ liste: 'alle' }) },
    ...(views.data?.length
      ? ['trenner' as const, ...views.data.map((v) => ({ label: v.name, onSelect: () => setParams({ liste: v.id }) }))]
      : []),
  ]
  const listenLabel = listeKey === 'alle' ? 'Alle Zuständigen' : (gewaehlteAnsicht?.name ?? 'Anrufliste Standard')
  const slots = settings?.telefon.slots ?? SLOTS_STANDARD
  const maxVersuche = settings?.telefon.max_attempts ?? 5
  const rueckrufFuer = params.get('rueckruf')
  const anrufgrundFuer = params.get('anrufgrund')
  const blockEnde = params.get('block') === 'ende'
  const { data: sessionCalls } = useCallsSession(block && me?.id ? sessionKey(me.id, block.start) : null)
  const session = blockZusammenfassung(sessionCalls ?? [], defs)

  return (
    <>
      <SeitenKopf
        titel="Anrufliste"
        kontext={anzeigeName(me) || undefined}
        rechts={
          <>
            <KopfStats
              eintraege={[
                { wert: liste.zaehler.rueckrufe, label: 'Rückrufe', ton: 'signal' },
                { wert: liste.zaehler.liste, label: 'in der Liste' },
                { wert: liste.zaehler.versuche, label: 'Versuche fällig', ton: 'overdue' },
              ]}
            />
            <Segment<Segmentwert>
              ariaLabel="Zeitraum"
              optionen={[
                { key: 'heute', label: 'Heute' },
                {
                  key: 'alle',
                  label: 'Alle',
                  zaehler: segment === 'alle' ? liste.kommend.length + liste.zaehler.liste : undefined,
                },
              ]}
              wert={segment}
              onChange={setSegment}
            />
            <DropdownMenu
              titel="Liste"
              trigger={
                <Button variante="secondary" aria-label={`Liste: ${listenLabel}`}>
                  {listenLabel}
                  <ChevronDown size={16} strokeWidth={1.75} aria-hidden className="text-ink-3" />
                </Button>
              }
              eintraege={listenEintraege}
            />
            {block ? (
              <Button
                variante="primary"
                kbd="↵"
                data-tour="call-block"
                onClick={() => {
                  const l = blockAktuellerLead(block)
                  if (l) navigate(`${PFADE.anruf(l)}?block=${block.id}`)
                }}
              >
                Call-Block fortsetzen
              </Button>
            ) : (
              <Button
                variante="primary"
                kbd="↵"
                disabled={!ids.length}
                disabledGrund="Niemand anzurufen"
                data-tour="call-block"
                onClick={starten}
              >
                Call-Block starten
              </Button>
            )}
          </>
        }
      />

      {block ? (
        <div
          role="status"
          className="border-line-strong text-ui mb-4 flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-2.5"
        >
          <span className="flex-1">
            Call-Block läuft seit {fmtZeit(block.start)} ·{' '}
            <span className="tnum font-mono">{blockZeit(blockDauerSec(block))}</span> · {block.listeIds.length} Leads
          </span>
          <span className="text-small text-ink-3 tnum font-mono" data-testid="block-zaehler">
            Dials <b className="text-ink font-medium">{session.dials}</b> · Erreicht{' '}
            <b className="text-ink font-medium">{session.erreicht}</b> · Entscheider{' '}
            <b className="text-ink font-medium">{session.entscheider}</b> · Termine{' '}
            <b className="text-ink font-medium">{session.termine}</b>
          </span>
          <Button variante="quiet" groesse="S" onClick={() => setParams({ block: 'ende' })}>
            Block beenden
          </Button>
        </div>
      ) : null}

      {rueckrufFuer ? <ParamAktion leadId={rueckrufFuer} art="rueckruf" onSchliessen={() => setParams({})} /> : null}
      {anrufgrundFuer ? (
        <ParamAktion leadId={anrufgrundFuer} art="anrufgrund" onSchliessen={() => setParams({})} />
      ) : null}

      {fehler && !zeilen.length ? (
        <LadeFehler text="Die Anrufliste konnte nicht geladen werden" onNochmal={nachladen} />
      ) : istLaden && !zeilen.length ? (
        <Skeleton zeilen={5} />
      ) : zeilen.length === 0 ? (
        <EmptyState
          titel={LEER.telefonListe.titel}
          satz={
            nichtHaupt ? (
              <>
                <span className="text-ink tnum">{nichtSatz(nichtZaehlung)}</span> {NICHT_ERKLAERUNG}
              </>
            ) : undefined
          }
          primaer={nichtHaupt ? { label: NICHT_AKTION[nichtHaupt], onClick: () => nichtZeigen(nichtHaupt) } : undefined}
          sekundaer={
            nichtHaupt === 'keine_nummer' && leadsOhneNummer
              ? { label: 'In Leads öffnen', onClick: () => navigate(leadsOhneNummer) }
              : undefined
          }
        />
      ) : (
        <>
          {liste.rueckrufe.length ? (
            <section aria-labelledby="sek-rueckrufe">
              <SektionsKopf
                id="sek-rueckrufe"
                label="Rückrufe"
                zaehler={liste.rueckrufe.length}
                eingeklappt={false}
                onToggle={() => {}}
              />
              <ul role="listbox" aria-label="Rückrufe" className="mb-6">
                {liste.rueckrufe.map((z) => (
                  <RueckrufRow
                    key={z.task.id}
                    zeile={z}
                    jetztMs={jetzt.getTime()}
                    cursor={cursorId === z.lead.id}
                    maxVersuche={maxVersuche}
                    notizOffen={notizOffen === z.lead.id}
                    onNotiz={(o) => setNotizOffen(o ? z.lead.id : null)}
                    onCursor={() => setCursor(z.lead.id)}
                    onAnrufen={() => navigate(anrufPfad(z.lead.id, z.task.id))}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="sek-anrufliste">
            <SektionsKopf
              id="sek-anrufliste"
              label="Anrufliste"
              zaehler={liste.anrufliste.length}
              eingeklappt={false}
              onToggle={() => {}}
              rechts={
                <span className="flex items-center gap-3">
                  {bulkKandidaten.length ? (
                    <Button variante="quiet" groesse="S" busy={bulkLaeuft} onClick={() => void bulk()}>
                      <span className="max-md:hidden">Anrufgrund festhalten: alle mit LinkedIn-Antwort</span>
                      <span className="md:hidden">Anrufgrund für LinkedIn-Antworten</span> ({bulkKandidaten.length})
                    </Button>
                  ) : null}
                  <span className="text-small text-ink-3 whitespace-nowrap max-lg:hidden">
                    Rückrufe → Versuche 2–{maxVersuche} → Versuch 1
                  </span>
                </span>
              }
            />
            {liste.anrufliste.length ? (
              <ul role="listbox" aria-label="Anrufliste">
                {liste.anrufliste.map((z) => (
                  <AnrufRow
                    key={z.lead.id}
                    zeile={z}
                    cursor={cursorId === z.lead.id}
                    maxVersuche={maxVersuche}
                    slots={slots}
                    notizOffen={notizOffen === z.lead.id}
                    onNotiz={(o) => setNotizOffen(o ? z.lead.id : null)}
                    onCursor={() => setCursor(z.lead.id)}
                    onAnrufen={() => navigate(anrufPfad(z.lead.id))}
                    entfernenOffen={entfernenOffen === z.lead.id}
                    onEntfernen={(o) => setEntfernenOffen(o ? z.lead.id : null)}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-small text-ink-3 py-3">Keine Versuche fällig.</p>
            )}
          </section>
        </>
      )}

      {segment === 'alle' && liste.kommend.length ? (
        <section aria-labelledby="sek-kommend" className="mt-4">
          <SektionsKopf
            id="sek-kommend"
            label="Kommend"
            zaehler={liste.kommend.length}
            eingeklappt={!kommendOffen}
            onToggle={() => setKommendOffen((o) => !o)}
          />
          {kommendOffen ? (
            <ul role="listbox" aria-label="Kommend">
              {liste.kommend.map((z) => (
                <AnrufRow
                  key={z.lead.id}
                  zeile={z}
                  cursor={false}
                  maxVersuche={maxVersuche}
                  slots={slots}
                  notizOffen={false}
                  onNotiz={() => {}}
                  onCursor={() => {}}
                  onAnrufen={() => navigate(anrufPfad(z.lead.id))}
                />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section
        id="nicht-anrufbar"
        aria-labelledby="sek-nicht"
        className="mt-4 scroll-mt-[calc(var(--head-h,0px)+16px)]"
      >
        <SektionsKopf
          id="sek-nicht"
          label="Noch nicht anrufbar"
          zaehler={liste.nichtAnrufbar.length}
          eingeklappt={!nichtOffen}
          onToggle={() => setNichtOffen((o) => !o)}
        />
        {nichtOffen ? (
          liste.nichtAnrufbar.length ? (
            <>
              <Segment<NichtFilter>
                klein
                className="mb-2"
                ariaLabel="Grund"
                optionen={(['alle', 'keine_nummer', 'kein_anrufgrund', 'gesperrt'] as const)
                  .filter((k) => k === 'alle' || nichtZaehlung[k] > 0)
                  .map((k) => ({
                    key: k,
                    label: NICHT_FILTER_LABEL[k],
                    zaehler: k === 'alle' ? liste.nichtAnrufbar.length : nichtZaehlung[k],
                  }))}
                wert={nichtFilterWirksam}
                onChange={setNichtFilter}
              />
              <ul role="list" aria-label="Noch nicht anrufbar">
                {nichtSichtbar.map((z) => (
                  <GesperrtRow
                    key={z.lead.id}
                    zeile={z}
                    // Gefiltert auf „Keine Nummer“/„Ohne Anrufgrund“ wiederholt der Chip nur den Filter – Zeile bleibt einzeilig
                    zeigeGrund={nichtFilterWirksam === 'alle' || nichtFilterWirksam === 'gesperrt'}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="text-small text-ink-3 py-3">Alle Leads mit Nummer sind anrufbar.</p>
          )
        ) : null}
      </section>

      {blockEnde && block ? (
        <BlockEnde session={block} me={me?.id ?? null} defs={defs} onSchliessen={() => setParams({})} />
      ) : null}
      {blockEnde && !block && !istLaden ? <LeererBlock onSchliessen={() => setParams({})} /> : null}
    </>
  )
}

function LeererBlock({ onSchliessen }: { onSchliessen: () => void }) {
  useEffect(() => {
    onSchliessen()
  }, [onSchliessen])
  return null
}

/** Palette-Befehle „Rückruf planen für …“ / „Anrufgrund setzen …“ landen hier (`?rueckruf=` / `?anrufgrund=`). */
function ParamAktion({
  leadId,
  art,
  onSchliessen,
}: {
  leadId: string
  art: 'rueckruf' | 'anrufgrund'
  onSchliessen: () => void
}) {
  const { data: lead } = useLead(leadId)
  if (!lead) return null
  return (
    <div
      className="border-line-strong text-ui mb-4 flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-2.5"
      role="note"
    >
      <span className="flex-1">
        {art === 'rueckruf' ? 'Rückruf planen für' : 'Anrufgrund setzen für'}{' '}
        <b className="font-medium">{lead.full_name}</b>
        {lead.company_name ? <span className="text-ink-3"> · {lead.company_name}</span> : null}
      </span>
      {art === 'rueckruf' ? (
        <RueckrufPlanen
          leadId={leadId}
          offen
          onOpenChange={(o) => !o && onSchliessen()}
          onFertig={onSchliessen}
          trigger={
            <Button variante="secondary" groesse="S">
              Rückruf planen
            </Button>
          }
        />
      ) : (
        <AnrufgrundSetzen
          lead={lead}
          offen
          onOpenChange={(o) => !o && onSchliessen()}
          onFertig={onSchliessen}
          trigger={
            <Button variante="secondary" groesse="S">
              Anrufgrund setzen
            </Button>
          }
        />
      )}
    </div>
  )
}

type RowGemeinsam = {
  cursor: boolean
  maxVersuche: number
  notizOffen: boolean
  onNotiz: (o: boolean) => void
  onCursor: () => void
  onAnrufen: () => void
}

// Mobil (ux § 7.5): Zeile wird Karte, „Anrufen“ groß und volle Breite. Der Button öffnet den Anruf-Screen (dort Timer +
// Ergebnis-Pflicht); gewählt wird am eigenen Telefon, es gibt kein `tel:` (16.10.2026).
const ZEILE = 'text-table flex items-center gap-3 px-3 max-md:h-auto max-md:flex-wrap max-md:gap-y-2 max-md:py-3'
const AKTIONEN = 'flex flex-none items-center gap-1.5 max-md:w-full'
/** Name-Block: wächst, schrumpft nie unter 8,5rem (sonst Breite 0 bei 1024 px, Sichtprüfung), auf Mobil eigene Zeile. */
const NAME_BLOCK = 'truncate-1 min-w-[8.5rem] flex-1 max-md:min-w-[60%]'
const ANRUFEN_MOBIL = 'max-md:h-12 max-md:flex-1 max-md:text-[15px]'

function LeadName({ leadId, name }: { leadId: string; name: string | null }) {
  return (
    <button
      type="button"
      className="hover:text-ink-bright inline font-medium"
      title="Im Peek öffnen"
      onClick={(e) => {
        e.stopPropagation()
        peekOeffnen(leadId)
      }}
    >
      {name ?? '–'}
    </button>
  )
}

function RueckrufRow({
  zeile: z,
  jetztMs,
  cursor,
  maxVersuche,
  notizOffen,
  onNotiz,
  onCursor,
  onAnrufen,
}: RowGemeinsam & { zeile: RueckrufZeile; jetztMs: number }) {
  const verpasstSec = z.verpasst ? Math.max(0, Math.floor((jetztMs - new Date(z.dueAt).getTime()) / 1000)) : 0
  const mit = mitWem(z.letzterAnruf)
  return (
    <li
      role="option"
      aria-selected={cursor}
      data-cursor={cursor || undefined}
      data-lead-zeile={z.lead.id}
      onClick={onCursor}
      className={cn('border-line border-b', cursor && 'cursor-bar')}
    >
      <div className={cn(ZEILE, 'h-12')}>
        <span className="text-ink tnum w-14 flex-none font-mono text-[15px] font-medium">{fmtZeit(z.dueAt)}</span>
        <span className={NAME_BLOCK} title={rueckrufTitel(z, mit)}>
          <LeadName leadId={z.lead.id} name={z.lead.full_name} />
          <span className="text-small text-ink-3">
            {z.lead.company_name ? ` · ${z.lead.company_name}` : ''} · vereinbart {fmtDatumKurz(z.task.created_at)}
            {mit ? ` mit ${mit}` : ''}
            {z.task.note ? ` · ${z.task.note}` : ''}
          </span>
        </span>
        {z.verpasst ? (
          <Chip ton="overdue" className="tnum font-mono">
            verpasst · {verpasstDauer(verpasstSec)}
          </Chip>
        ) : null}
        {z.wiederholung > 0 ? <Chip ton="muted">Wiederholung {z.wiederholung}</Chip> : null}
        <span className="text-ink-3 tnum text-small flex-none font-mono whitespace-nowrap max-xl:hidden max-md:inline">
          Versuch {z.versuch}/{maxVersuche}
        </span>
        <span className={AKTIONEN} onClick={(e) => e.stopPropagation()}>
          <Spaeter leadId={z.lead.id} taskId={z.task.id} aktiv={cursor} faelligAm={z.task.due_at} />
          <Button variante="quiet" groesse="S" kbd="N" aria-pressed={notizOffen} onClick={() => onNotiz(!notizOffen)}>
            Notiz
          </Button>
          <Button variante="primary" groesse="S" icon={Phone} kbd="↵" className={ANRUFEN_MOBIL} onClick={onAnrufen}>
            Anrufen
          </Button>
        </span>
      </div>
      {notizOffen ? (
        <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
          <NotizFeld leadId={z.lead.id} kanal="telefon" trigger={null} offen onOpenChange={onNotiz} />
        </div>
      ) : null}
    </li>
  )
}

function AnrufRow({
  zeile: z,
  cursor,
  maxVersuche,
  slots,
  notizOffen,
  onNotiz,
  onCursor,
  onAnrufen,
  entfernenOffen,
  onEntfernen,
}: RowGemeinsam & {
  zeile: AnrufZeile
  slots: Record<'A' | 'B' | 'C' | 'D', string>
  entfernenOffen?: boolean
  onEntfernen?: (o: boolean) => void
}) {
  const rolle = z.lead.role_title || ROLLE_KURZ[z.lead.role ?? 'unbekannt'] || ''
  const letzter = z.letzterAnruf
  return (
    <li
      role="option"
      aria-selected={cursor}
      data-cursor={cursor || undefined}
      data-lead-zeile={z.lead.id}
      onClick={onCursor}
      className={cn('border-line border-b', cursor && 'cursor-bar')}
    >
      <div className={cn(ZEILE, 'h-11')}>
        <span className={NAME_BLOCK} title={[z.lead.full_name, z.lead.company_name, rolle].filter(Boolean).join(' · ')}>
          <LeadName leadId={z.lead.id} name={z.lead.full_name} />
          <span className="text-small text-ink-3">
            {z.lead.company_name ? ` · ${z.lead.company_name}` : ''}
            {rolle ? ` · ${rolle}` : ''}
          </span>
        </span>
        {z.faelligAt && z.ueberfaelligTage > 0 ? (
          <ZeitChip datum={z.faelligAt} heute={heuteBerlin()} className="flex-none" />
        ) : null}
        {/* Meta in Prioritäten: Versuch immer, Slot ab 1280 px, „zuletzt“ ab 1440 px – nie umbrechen */}
        <span className="text-ink-3 tnum text-small flex-none font-mono whitespace-nowrap">
          Versuch {z.versuch}/{maxVersuche}
          <span className="max-xl:hidden">
            {' · '}Slot {z.slot} {slots[z.slot]}
          </span>
          {letzter ? <span className="max-2xl:hidden"> · zuletzt {fmtDatumKurz(letzter.started_at)}</span> : null}
        </span>
        {letzter ? (
          <Chip ton="muted" data-testid="letztes-ergebnis" className="flex-none">
            {kurzErgebnis(letzter)}
          </Chip>
        ) : null}
        {z.lead.call_basis ? (
          <Chip className="flex-none max-xl:hidden" title={ANRUFGRUND_LABEL[z.lead.call_basis]}>
            {ANRUFGRUND_LABEL[z.lead.call_basis]}
          </Chip>
        ) : null}
        <span className={AKTIONEN} onClick={(e) => e.stopPropagation()}>
          {cursor && onEntfernen ? (
            <ListeEntfernen leadId={z.lead.id} offen={!!entfernenOffen} onOpenChange={onEntfernen} />
          ) : null}
          <Spaeter
            leadId={z.lead.id}
            enrollmentId={z.enrollment?.id ?? null}
            aktiv={cursor}
            faelligAm={z.enrollment?.next_due_at ?? null}
          />
          <Button variante="quiet" groesse="S" kbd="N" aria-pressed={notizOffen} onClick={() => onNotiz(!notizOffen)}>
            Notiz
          </Button>
          <Button
            variante={cursor ? 'primary' : 'secondary'}
            groesse="S"
            icon={Phone}
            kbd={cursor ? '↵' : undefined}
            className={ANRUFEN_MOBIL}
            onClick={onAnrufen}
          >
            Anrufen
          </Button>
        </span>
      </div>
      {notizOffen ? (
        <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
          <NotizFeld leadId={z.lead.id} kanal="telefon" trigger={null} offen onOpenChange={onNotiz} />
        </div>
      ) : null}
    </li>
  )
}

function GesperrtRow({ zeile: z, zeigeGrund = true }: { zeile: GesperrtZeile; zeigeGrund?: boolean }) {
  return (
    <li
      className="border-line text-table flex h-11 items-center gap-3 border-b px-3 max-md:h-auto max-md:flex-wrap max-md:gap-y-2 max-md:py-3"
      data-grund={z.grund}
    >
      <span
        className="truncate-1 min-w-[8.5rem] flex-1"
        title={[z.lead.full_name, z.lead.company_name].filter(Boolean).join(' · ')}
      >
        <LeadName leadId={z.lead.id} name={z.lead.full_name} />
        <span className="text-small text-ink-3">{z.lead.company_name ? ` · ${z.lead.company_name}` : ''}</span>
      </span>
      {zeigeGrund ? (
        <Chip
          ton={z.grund === 'kein_anrufgrund' || z.grund === 'keine_nummer' ? 'muted' : 'danger'}
          className="flex-none"
        >
          {telefonGrundLabel(z.grund)}
        </Chip>
      ) : null}
      <span className="ml-auto flex flex-none items-center gap-1.5">
        {z.grund === 'kein_anrufgrund' ? <AnrufgrundSetzen lead={z.lead} /> : null}
        {z.grund === 'keine_nummer' ? (
          // Peek mit Telefon-Karte: dort Nummer eintragen (Quelle + Datum, BAUPLAN § 8.2 Nr. 4) – danach Anrufgrund
          <Button
            variante="quiet"
            groesse="S"
            title="Im Peek öffnen und die Nummer in der Telefon-Karte eintragen"
            onClick={() => peekOeffnen(z.lead.id)}
          >
            Nummer ergänzen
          </Button>
        ) : null}
      </span>
    </li>
  )
}
