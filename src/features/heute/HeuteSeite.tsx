// Heute (BAUPLAN § 3.2, ux § 3.1, DESIGN-SYSTEM § 6 „Heute“): Seitenkopf (Voice-Zeile, Stats Fällig · Überfällig · Erledigt · Später,
// Personen-Segment), Kanalzeile, Hinweis-Karten, Batch-Chips, Sektionen in fester Reihenfolge (§ 5.4), rechte Spalte ≥ 1180
// (Tageszähler · Später heute · Tastenhinweise). `?person=` zeigt die Queue der anderen Person mit Banner (§ 1.5 Nr. 13),
// `?sektion=zurueckziehen`, `?schritt=`. Sitzungszustand (Cursor, Erledigt-Zeilen, gehaltene Positionen, Auswahl, Dialoge) liegt
// in einem zustand-Store je Seite: Effekte und Ereignisse schreiben, der Render liest.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { PFADE } from '@/app/pfade'
import { begruessung } from '@/app/shell/Begruessung'
import { useUiStore } from '@/app/uiStore'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { LadeFehler } from '@/components/ui/LadeFehler'
import { Segment } from '@/components/ui/Segment'
import { KopfStats, SeitenKopf } from '@/components/ui/SeitenKopf'
import { Skeleton } from '@/components/ui/Skeleton'
import { nachleseAktivitaet, useActivitiesZeitraum } from '@/data/activities'
import { useSnoozeStep } from '@/data/enrollments'
import { usePipelineCounts } from '@/data/leads'
import { useMe, useMembers } from '@/data/members'
import { useUndo } from '@/data/undo'
import { fmtVerhaeltnis, fmtZahl, fmtZeit, heuteBerlin } from '@/lib/format'
import { useHotkeys, useHotkeyScope } from '@/lib/keyboard'
import { SEQUENZ } from '@/lib/vorlagenKeys'
import { tagPlus, tagZuDate } from '@/lib/zeit'
import type { ActivityType, Member, QueueItem, UiSektion } from '@/types/domain'
import { AbhakListe, type AbhakDialog } from './AbhakListe'
import { BatchChips } from './BatchChips'
import { ErledigtZeile } from './ErledigtZeile'
import { listeAbgearbeitet, naechsterSchritt, personAusParam, spaeterHeute, spaeterText } from './heuteHelfer'
import { HinweisKarten } from './HinweisKarten'
import { Kanalzeile } from './Kanalzeile'
import { jetzt } from './karten'
import { HeuteKontext } from './kontext'
import { HeuteLeer } from './leer'
import { kartenArt } from './nachricht'
import { QueueKarte, type QueueAktion } from './QueueKarte'
import { ABHAK_SEKTIONEN, FAELLIG_SEKTIONEN, itemKey, SEKTIONEN } from './sektionen'
import { Sektion } from './Sektion'
import { lies, schreibe, SPEICHER } from './speicher'
import { Tageszaehler } from './Tageszaehler'
import { useEingeklappt } from './useEingeklappt'
import { useHeuteQueue, type HeuteQueue } from './useHeuteQueue'
import { useQueueAktionen, type AktionenKontext, type ErledigtEintrag } from './useQueueAktionen'
import { useQueueHotkeys, type QueueTaste } from './useQueueHotkeys'
import { useTageszaehler, type TageszaehlerDaten } from './useTageszaehler'

/** „Erledigt“ im Kopf = eigene Aktivitäten heute dieser Typen (+ abgehakte Annahmen/Anfragen der Sitzung, § 3.2). */
const ERLEDIGT_TYPEN: ActivityType[] = [
  'gespraech_eroeffnet',
  'nachricht_gesendet',
  'pitch_gesendet',
  'email_gesendet',
  'aufgabe_erledigt',
  'schritt_uebersprungen',
]
const ZEITRAUM_TYPEN: ActivityType[] = [...ERLEDIGT_TYPEN, 'schritt_verschoben']

const istAbhakItem = (i: QueueItem) =>
  i.item_kind === 'annahme_pruefen' || i.item_kind === 'neue_anfrage' || i.item_kind === 'zurueckziehen'

export function Component() {
  const me = useMe()
  const { data: members } = useMembers()
  const [params] = useSearchParams()
  const person = useMemo(
    () => (members ? personAusParam(members, params.get('person'), me?.id ?? null) : null),
    [members, params, me?.id],
  )
  if (!me || !members) {
    return (
      <>
        <SeitenKopf titel="Heute" />
        <Skeleton zeilen={4} />
      </>
    )
  }
  const anzeige = person ?? me
  return (
    <HeuteInhalt
      key={anzeige.id ?? ''}
      me={me}
      members={members}
      person={anzeige}
      fremd={!!person && person.id !== me.id}
    />
  )
}

type ErledigtMitSektion = ErledigtEintrag & {
  sektion: UiSektion
  /** Zeile war schon einmal aus der Queue verschwunden – taucht sie wieder auf (Rückgängig), fällt die Erledigt-Zeile weg */
  weg?: boolean
}

type SeiteStore = {
  cursor: string | null
  sichtbarVorher: string[]
  sektionVon: Map<string, UiSektion>
  erledigt: Map<string, ErledigtMitSektion>
  /** Schlüssel eigener Mutationen: ihre Position bleibt in der eingefrorenen Reihenfolge (Erledigt-Zeile, H-06) */
  halten: Set<string>
  verborgen: Set<string>
  auswahl: Set<string>
  dialog: AbhakDialog
  abgehakt: number
  anfragen: { gesendet: number; uebersprungen: number }
}

function neuerStore(): StoreApi<SeiteStore> {
  return createStore<SeiteStore>(() => ({
    cursor: null,
    sichtbarVorher: [],
    sektionVon: new Map(),
    erledigt: new Map(),
    halten: new Set(),
    verborgen: new Set(),
    auswahl: new Set(),
    dialog: null,
    abgehakt: 0,
    anfragen: { gesendet: 0, uebersprungen: 0 },
  }))
}

/** Antworten-Karten, die per „Später“ (+1 Tag) bis morgen ausgeblendet sind (localStorage, je Gerät). */
function antwortenVerborgen(items: readonly QueueItem[], heute: string): string[] {
  return items.filter((i) => i.lead_id && (lies(SPEICHER.antwortSpaeter(i.lead_id)) ?? '') > heute).map(itemKey)
}

function HeuteInhalt({
  me,
  members,
  person,
  fremd,
}: {
  me: Member
  members: Member[]
  person: Member
  fremd: boolean
}) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const heute = heuteBerlin()
  const memberId = person.id ?? null
  const setPersonAnsicht = useUiStore((s) => s.setPersonAnsicht)
  useHotkeyScope('liste')

  useEffect(() => {
    setPersonAnsicht(fremd ? memberId : null)
    return () => setPersonAnsicht(null)
  }, [fremd, memberId, setPersonAnsicht])

  const [store] = useState(neuerStore)
  const cursor = useStore(store, (s) => s.cursor)
  const erledigt = useStore(store, (s) => s.erledigt)
  const halten = useStore(store, (s) => s.halten)
  const verborgenLokal = useStore(store, (s) => s.verborgen)
  const auswahl = useStore(store, (s) => s.auswahl)
  const dialog = useStore(store, (s) => s.dialog)
  const abgehakt = useStore(store, (s) => s.abgehakt)
  const anfragenSitzung = useStore(store, (s) => s.anfragen)
  const setCursor = useCallback((k: string | null) => store.setState({ cursor: k }), [store])
  const setDialog = useCallback((d: AbhakDialog) => store.setState({ dialog: d }), [store])

  const { eingeklappt, toggle } = useEingeklappt()
  const behalten = useMemo(() => new Set([...erledigt.keys(), ...halten]), [erledigt, halten])

  const q = useHeuteQueue(memberId, {
    behalten,
    zeigeZurueckziehen: params.get('sektion') === 'zurueckziehen',
    schritt: params.get('schritt'),
    heute,
  })
  const tz = useTageszaehler(memberId, person)
  const { data: pipeline } = usePipelineCounts()
  const { data: aktivitaeten } = useActivitiesZeitraum(memberId ?? 'team', heute, heute, ZEITRAUM_TYPEN)
  const snoozeStep = useSnoozeStep()
  const { anbieten } = useUndo()
  const peekOffen = useUiStore((s) => !!s.peekLeadId)

  const verborgen = useMemo(
    () => new Set([...verborgenLokal, ...antwortenVerborgen(q.alleSektionen.antworten, heute)]),
    [verborgenLokal, q.alleSektionen.antworten, heute],
  )

  // Sektion je Schlüssel merken (auch nach dem Verschwinden: Erledigt-Zeile an derselben Position, H-06). Eine Erledigt-Zeile
  // fällt weg, wenn ihre Karte nach dem Verschwinden wieder in derselben Sektion steht (Rückgängig `Z`).
  useEffect(() => {
    const st = store.getState()
    const sektionVon = new Map(st.sektionVon)
    for (const s of SEKTIONEN) for (const i of q.alleSektionen[s]) sektionVon.set(itemKey(i), s)
    let geaendert = false
    const neu = new Map(st.erledigt)
    for (const [key, e] of st.erledigt) {
      const da = q.alleSektionen[e.sektion].some((i) => itemKey(i) === key)
      if (!da && !e.weg) {
        neu.set(key, { ...e, weg: true })
        geaendert = true
      } else if (da && e.weg) {
        neu.delete(key)
        geaendert = true
      }
    }
    store.setState(geaendert ? { sektionVon, erledigt: neu } : { sektionVon })
  }, [q.alleSektionen, store])

  const markiereEigen = q.markiereEigen
  const halte = useCallback(
    (key: string) => {
      markiereEigen(key)
      store.setState((s) => ({ halten: new Set([...s.halten, key]) }))
    },
    [markiereEigen, store],
  )
  const zeileSetzen = useCallback(
    (key: string, e: ErledigtEintrag) =>
      store.setState((s) => ({
        erledigt: new Map(s.erledigt).set(key, { ...e, sektion: s.sektionVon.get(key) ?? 'heute' }),
      })),
    [store],
  )

  const faellig = q.zaehler.faellig
  const neuSet = q.neu
  const kontext = useMemo<AktionenKontext>(
    () => ({
      heute,
      offen: () => faellig,
      schritt: q.schritt,
      markiereEigen: halte,
      onErledigt: zeileSetzen,
      onAbgehakt: (sektion, art) =>
        store.setState((s) => ({
          abgehakt: s.abgehakt + (art === 'erledigt' ? 1 : 0),
          anfragen:
            sektion === 'neue_anfragen'
              ? {
                  gesendet: s.anfragen.gesendet + (art === 'erledigt' ? 1 : 0),
                  uebersprungen: s.anfragen.uebersprungen + (art === 'uebersprungen' ? 1 : 0),
                }
              : s.anfragen,
        })),
      istNeu: (key) => neuSet.has(key),
    }),
    [heute, faellig, q.schritt, halte, zeileSetzen, store, neuSet],
  )

  // sichtbare Schlüssel in Reihenfolge (Cursor) – eingeklappte Sektionen und lokal verborgene Zeilen fallen weg
  const sichtbar = useMemo(
    () =>
      SEKTIONEN.flatMap((s) =>
        eingeklappt.has(s) ? [] : q.sektionen[s].map(itemKey).filter((k) => !verborgen.has(k)),
      ),
    [q.sektionen, eingeklappt, verborgen],
  )
  // H-01: erste Karte fokussiert; verschwindet die Cursor-Karte, rückt die nächste an derselben Stelle nach
  useEffect(() => {
    const st = store.getState()
    if (!sichtbar.length) {
      store.setState({ sichtbarVorher: sichtbar })
      return
    }
    if (!st.cursor) store.setState({ cursor: sichtbar[0] ?? null, sichtbarVorher: sichtbar })
    else if (!sichtbar.includes(st.cursor)) {
      const alt = st.sichtbarVorher.indexOf(st.cursor)
      store.setState({
        cursor: sichtbar[Math.min(Math.max(alt, 0), sichtbar.length - 1)] ?? null,
        sichtbarVorher: sichtbar,
      })
    } else store.setState({ sichtbarVorher: sichtbar })
  }, [sichtbar, store])
  // `?lead=` beim Ankommen (Peek „Jetzt vorbereiten →“, Anruf-Vorschlag „LinkedIn-DM … senden?“): zur Karte springen statt den Peek
  // über Heute zu öffnen (ux § 3.3.2, DESIGN-SYSTEM § 5.11). Nur einmal je Besuch – später setzt Heute `?lead=` selbst (Abhakzeile ↵).
  const [sprungLead] = useState(() => params.get('lead'))
  const gesprungen = useRef(false)
  useEffect(() => {
    if (gesprungen.current || !sprungLead || q.laden) return
    gesprungen.current = true
    const key = sichtbar.find((k) => q.byKey.get(k)?.lead_id === sprungLead)
    if (!key) return // nicht in der Queue: der Peek bleibt (Fallback)
    store.setState({ cursor: key })
    const p = new URLSearchParams(params)
    p.delete('lead')
    setParams(p, { replace: true })
  }, [sprungLead, q.laden, q.byKey, sichtbar, store, params, setParams])

  useEffect(() => {
    if (!cursor) return
    // Karten tragen data-key; Abhakzeilen markieren den Cursor selbst (data-cursor)
    const el =
      document.querySelector<HTMLElement>(`[data-key="${CSS.escape(cursor)}"]`) ??
      document.querySelector<HTMLElement>('[data-sektion] li[data-cursor]')
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [cursor])

  const listeEinfuegen = useCallback(() => navigate(PFADE.schnellimport(PFADE.heute)), [navigate])
  const personWechseln = useCallback(
    (id: string) => {
      const p = new URLSearchParams(params)
      const m = members.find((x) => x.id === id)
      if (!m || m.id === me.id) p.delete('person')
      else p.set('person', (m.short_name ?? m.display_name ?? 'andere').toLowerCase())
      setParams(p, { replace: true })
    },
    [me.id, members, params, setParams],
  )
  const zurueckZuMir = useCallback(() => personWechseln(me.id ?? ''), [me.id, personWechseln])

  // Befehle der Palette (features/heute/befehle.ts) erreichen die Seite über Fenster-Ereignisse
  const tzDelta = tz.delta
  const neuSortieren = q.neuSortieren
  useEffect(() => {
    const zaehler = (e: Event) => {
      const d = (e as CustomEvent<{ delta?: number; fokus?: boolean }>).detail
      if (d?.delta) tzDelta(d.delta)
      if (d?.fokus)
        document.querySelector<HTMLInputElement>('[data-tageszaehler] input[aria-label="Zähler setzen"]')?.focus()
    }
    const sortieren = () => neuSortieren()
    window.addEventListener('crm:heute:zaehler', zaehler)
    window.addEventListener('crm:heute:sortieren', sortieren)
    return () => {
      window.removeEventListener('crm:heute:zaehler', zaehler)
      window.removeEventListener('crm:heute:sortieren', sortieren)
    }
  }, [tzDelta, neuSortieren])

  /** `S` ohne Server-Snooze: Abhakzeile ans Sektionsende; Antworten-Karte bis morgen ausblenden (nur +1 Tag, § 3.2). */
  const spaeterLokal = useCallback(
    (key: string, item: QueueItem) => {
      const s = store.getState().sektionVon.get(key)
      if (s && ABHAK_SEKTIONEN.has(s)) {
        q.ansEnde(key)
        return
      }
      const morgen = tagPlus(heute, 1)
      if (item.lead_id) schreibe(SPEICHER.antwortSpaeter(item.lead_id), morgen)
      store.setState((st) => ({
        verborgen: new Set([...st.verborgen, key]),
        halten: new Set([...st.halten, key]),
        erledigt: new Map(st.erledigt).set(key, {
          art: 'spaeter',
          text: spaeterText(morgen, heute),
          activityId: null,
          name: item.lead_name,
          sektion: s ?? 'antworten',
        }),
      }))
      toast(`Später: morgen.`)
    },
    [heute, q, store],
  )

  /** Rückmeldung der Karten (Vertrag `onAktion`): Cursor setzen, eigene Mutationen markieren, Erledigt-/Später-Zeile. */
  const kartenAktion = useCallback(
    (key: string, item: QueueItem, aktion: QueueAktion) => {
      setCursor(key)
      if (item.item_kind === 'meeting') return // die Meeting-Karte schreibt ihre Zeile selbst
      const zeile = (art: ErledigtEintrag['art'], text: string) => {
        halte(key)
        zeileSetzen(key, { art, text, activityId: null, name: item.lead_name })
      }
      switch (aktion) {
        case 'spaeter':
          if (kartenArt(item) === 'antworten') spaeterLokal(key, item)
          else zeile('spaeter', 'verschoben')
          return
        case 'beenden':
          return zeile('erledigt', 'Beendet')
        case 'antwort':
          return zeile('erledigt', 'Antwort erfasst – steht jetzt unter Antworten')
        case 'wiedervorlage':
          return zeile('erledigt', 'Wiedervorlage gesetzt')
        case 'termin':
          return zeile('erledigt', 'Termin eingetragen')
        default:
          return
      }
    },
    [halte, setCursor, spaeterLokal, zeileSetzen],
  )

  // Erledigt = eigene Aktivitäten heute + Erledigt-Zeilen dieser Sitzung, deren Aktivität noch nicht zurückgelesen ist
  // (sofort +1 nach `E`, H-05) + abgehakte Annahmen/Anfragen.
  const erledigtAkt = (aktivitaeten ?? []).filter((a) => ERLEDIGT_TYPEN.includes(a.type))
  const aktIds = new Set(erledigtAkt.map((a) => a.id))
  const ausstehend = [...erledigt.values()].filter(
    (e) => e.art === 'erledigt' && e.activityId !== null && !aktIds.has(e.activityId),
  ).length
  const erledigtHeute = erledigtAkt.length + ausstehend + abgehakt
  const spaeterZahl = (aktivitaeten ?? []).filter((a) => a.type === 'schritt_verschoben').length
  const leadsGesamt = pipeline?.reduce((n, z) => n + (z.leads ?? 0), 0) ?? 0
  const linkedinAktiv =
    !fremd &&
    (tz.woche > 0 ||
      tz.getrackt > 0 ||
      q.alleSektionen.neue_anfragen.length > 0 ||
      q.alleSektionen.annahme_pruefen.length > 0 ||
      q.items.some((i) => i.channel === 'linkedin'))
  const telefonAktiv =
    tz.telefon.anrufe > 0 || q.alleSektionen.rueckrufe.length > 0 || q.items.some((i) => i.channel === 'telefon')
  const leer = [...FAELLIG_SEKTIONEN, ...ABHAK_SEKTIONEN].every(
    (s) => q.alleSektionen[s].filter((i) => !verborgen.has(itemKey(i))).length === 0,
  )
  const gefiltertLeer = SEKTIONEN.every((s) => q.sektionen[s].length === 0)

  /** ux § 4.5: „Alle verschieben auf heute“ (ab −14 T) – ein Sammel-Toast mit Rückgängig über die `schritt_verschoben`-Zeilen. */
  const langeUeberfaellig = q.alleSektionen.ueberfaellig.filter(
    (i) => i.enrollment_id && i.lead_id && (i.days_overdue ?? 0) >= 14,
  )
  const alleAufHeute = async () => {
    if (snoozeStep.isPending || !langeUeberfaellig.length) return
    const ids: number[] = []
    let n = 0
    for (const i of langeUeberfaellig) {
      if (!i.enrollment_id || !i.lead_id) continue
      halte(itemKey(i))
      try {
        await snoozeStep.mutateAsync({
          enrollmentId: i.enrollment_id,
          leadId: i.lead_id,
          until: tagZuDate(heute, '09:00').toISOString(),
        })
      } catch {
        break // Fehler-Toast aus dem Hook
      }
      n++
      const a = await nachleseAktivitaet(i.lead_id, ['schritt_verschoben'])
      if (a) ids.push(a.id)
    }
    if (!n) return
    const text = `${n} ${n === 1 ? 'Schritt' : 'Schritte'} auf heute verschoben.`
    if (ids.length) anbieten(ids, text)
    else toast(text)
  }
  useHotkeys('liste', langeUeberfaellig.length && !peekOffen ? { 'alt+h': () => void alleAufHeute() } : {}, [
    langeUeberfaellig.length,
    peekOffen,
  ])

  return (
    <HeuteKontext.Provider value={kontext}>
      <HeuteTasten
        q={q}
        cursor={cursor}
        setCursor={setCursor}
        sichtbar={sichtbar}
        sektionVon={(k) => store.getState().sektionVon.get(k)}
        auswahl={auswahl}
        setAuswahl={(s) => store.setState({ auswahl: s })}
        setDialog={setDialog}
        tz={tz}
        onSpaeterLokal={spaeterLokal}
      />
      <SeitenKopf
        titel="Heute"
        kontext={person.short_name ?? person.display_name ?? undefined}
        voice={begruessung(me.short_name ?? me.display_name ?? '')}
        rechts={
          <>
            <KopfStats
              eintraege={[
                { wert: q.zaehler.faellig, label: 'fällig', ton: 'signal' },
                { wert: q.zaehler.ueberfaellig, label: 'überfällig', ton: 'overdue' },
                { wert: erledigtHeute, label: 'erledigt' },
                { wert: spaeterZahl, label: 'später' },
              ]}
            />
            {members.length > 1 ? (
              // Mock (reference.html) zeigt „Vincent · Mike · Beide“; BAUPLAN § 3.1.4 kennt nur ?person=vincent|mike – BAUPLAN gilt.
              <Segment
                ariaLabel="Heute von"
                klein
                wert={person.id ?? ''}
                onChange={personWechseln}
                optionen={[me, ...members.filter((m) => m.id !== me.id)].map((m) => ({
                  key: m.id ?? '',
                  label: m.short_name ?? m.display_name ?? '–',
                }))}
              />
            ) : null}
          </>
        }
      />
      {fremd ? (
        <div
          role="status"
          className="border-line-strong text-ui mb-4 flex items-center gap-3 rounded-md border px-3.5 py-2.5"
        >
          <span className="flex-1">Du siehst {person.short_name ?? person.display_name}s Heute.</span>
          <Button variante="quiet" groesse="S" onClick={zurueckZuMir}>
            Zurück zu deinem ↩
          </Button>
        </div>
      ) : null}

      <div className="wide:grid-cols-[minmax(0,1fr)_300px] wide:gap-10 grid gap-6">
        <div className="min-w-0">
          <Kanalzeile
            daten={tz}
            linkedin={linkedinAktiv}
            telefon={telefonAktiv}
            onListeEinfuegen={listeEinfuegen}
            onCallBlock={() => navigate(`${PFADE.telefon}?block=start`)}
          />
          {!fremd ? (
            <HinweisKarten
              heute={heute}
              budget={tz.budget}
              annahmeQuote7={tz.annahmeQuote7}
              onFreigegeben={() => navigate(`${PFADE.leads}?ansicht=frei`)}
              onBackup={() => navigate(PFADE.einstellungen('export'))}
              onZiele={() => navigate(PFADE.einstellungen('ziele'))}
            />
          ) : null}
          <BatchChips chips={q.chips} aktiv={q.batch} onChange={q.setBatch} />

          {q.fehler && !q.laden ? (
            <LadeFehler text="Heute konnte nicht geladen werden" onNochmal={q.nachladen} />
          ) : q.laden ? (
            <Skeleton zeilen={5} />
          ) : (
            <Sektionen
              q={q}
              heute={heute}
              cursor={cursor}
              setCursor={setCursor}
              eingeklappt={eingeklappt}
              toggle={toggle}
              erledigt={erledigt}
              verborgen={verborgen}
              auswahl={auswahl}
              dialog={dialog}
              setDialog={setDialog}
              tz={tz}
              anfragenSitzung={anfragenSitzung}
              onKartenAktion={kartenAktion}
              onListeEinfuegen={listeEinfuegen}
              onAlleAufHeute={() => void alleAufHeute()}
              alleAufHeuteLaeuft={snoozeStep.isPending}
            />
          )}

          {!q.laden && !q.fehler && erledigt.size === 0 && (q.batch ? gefiltertLeer : leer) ? (
            q.batch ? (
              <p className="text-small text-ink-3 py-6">
                Kein Eintrag für diesen Filter.{' '}
                <button
                  type="button"
                  className="text-ink-2 hover:text-ink underline-offset-2 hover:underline"
                  onClick={() => q.setBatch(null)}
                >
                  Alle anzeigen <kbd className="kbd">⌥0</kbd>
                </button>
              </p>
            ) : fremd ? (
              <HeuteLeer
                art="anderePerson"
                name={person.short_name ?? person.display_name ?? 'Die andere Person'}
                onZurueck={zurueckZuMir}
              />
            ) : leadsGesamt === 0 && q.items.length === 0 ? (
              <HeuteLeer art="keineDaten" onSchnellimport={listeEinfuegen} onSheets={() => navigate(PFADE.import)} />
            ) : (
              <HeuteLeer
                art="erledigt"
                naechster={naechsterSchritt(q.items, heute)}
                onLeads={() => navigate(PFADE.leads)}
                onListe={listeEinfuegen}
              />
            )
          ) : null}
        </div>

        {/* Unter 1180 px nach der Queue wie reference.html (`.heute-grid`/`.aside`) – vorher order-first, die erste Karte lag
            auf dem iPhone unter dem Falz (Review) */}
        <aside className="max-wide:grid-cols-2 grid content-start gap-[22px] max-md:grid-cols-1">
          {!fremd ? (
            <div data-tageszaehler>
              <Tageszaehler daten={tz} onListeEinfuegen={listeEinfuegen} />
            </div>
          ) : null}
          <SpaeterHeute items={q.items} heute={heute} />
          <div className="text-ink-3 max-wide:hidden grid gap-1.5 text-[12.5px]" aria-label="Tastenhinweise">
            <TastenHinweis tasten={['J', 'K']} text="Karte wechseln, klappt auf" />
            <TastenHinweis tasten={['↵']} text="Kopieren · ⌘↵ Kopieren + Gesendet" />
            <TastenHinweis tasten={['E', 'S', 'N', 'A', 'B']} text="Gesendet · Später · Notiz · Antwort · Beenden" />
            <TastenHinweis tasten={['⌥1']} text="Batch-Chip · ⌥0 alle · ⌥R neu sortieren" />
            <TastenHinweis tasten={['Z']} text="Rückgängig (6 s)" />
            <TastenHinweis tasten={['?']} text="alle Tasten" />
          </div>
        </aside>
      </div>
    </HeuteKontext.Provider>
  )
}

function TastenHinweis({ tasten, text }: { tasten: string[]; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex gap-1">
        {tasten.map((t) => (
          <kbd key={t} className="kbd">
            {t}
          </kbd>
        ))}
      </span>
      <span>{text}</span>
    </div>
  )
}

/** Rechte Spalte „Später heute“: Rückrufe/Termine mit Uhrzeit, die noch kommen (DESIGN-SYSTEM § 6). */
function SpaeterHeute({ items, heute }: { items: readonly QueueItem[]; heute: string }) {
  const liste = spaeterHeute(items, heute, jetzt().getTime())
  if (!liste.length) return null
  return (
    <div className="border-line border-t pt-3.5">
      <span className="label mb-2 block">Später heute</span>
      <ul className="m-0 list-none p-0">
        {liste.map((i) => (
          <li
            key={itemKey(i)}
            className="border-line flex justify-between gap-2.5 border-b py-[7px] text-[13.5px] last:border-b-0"
          >
            <span className="min-w-0">
              <span className="font-medium">{i.lead_name}</span> <span className="text-ink-3">· {i.title}</span>
            </span>
            <span className="text-ink tnum flex-none font-mono text-[12.5px] font-medium">
              {i.due_at ? fmtZeit(i.due_at) : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Zeile = { art: 'item'; key: string; item: QueueItem } | { art: 'erledigt'; key: string; e: ErledigtMitSektion }

type SektionenProps = {
  q: HeuteQueue
  heute: string
  cursor: string | null
  setCursor: (k: string) => void
  eingeklappt: ReadonlySet<UiSektion>
  toggle: (s: UiSektion) => void
  erledigt: Map<string, ErledigtMitSektion>
  verborgen: ReadonlySet<string>
  auswahl: ReadonlySet<string>
  dialog: AbhakDialog
  setDialog: (d: AbhakDialog) => void
  tz: TageszaehlerDaten
  anfragenSitzung: { gesendet: number; uebersprungen: number }
  onKartenAktion: (key: string, item: QueueItem, a: QueueAktion) => void
  onListeEinfuegen: () => void
  onAlleAufHeute: () => void
  alleAufHeuteLaeuft?: boolean
}

function Sektionen({
  q,
  heute,
  cursor,
  setCursor,
  eingeklappt,
  toggle,
  erledigt,
  verborgen,
  auswahl,
  dialog,
  setDialog,
  tz,
  anfragenSitzung,
  onKartenAktion,
  onListeEinfuegen,
  onAlleAufHeute,
  alleAufHeuteLaeuft,
}: SektionenProps) {
  const navigate = useNavigate()
  return (
    <>
      {SEKTIONEN.map((s) => {
        const items = q.sektionen[s].filter((i) => !verborgen.has(itemKey(i)))
        const nachKey = new Map(items.map((i) => [itemKey(i), i]))
        const zeilen: Zeile[] = []
        for (const key of q.reihenfolge[s]) {
          const item = nachKey.get(key)
          if (item) zeilen.push({ art: 'item', key, item })
          else {
            const e = erledigt.get(key)
            if (e && e.sektion === s && !q.batch) zeilen.push({ art: 'erledigt', key, e })
          }
        }
        const fremd = q.fremdErledigt.filter((f) => f.sektion === s)
        if (!zeilen.length && !fremd.length) {
          // ux § 2.1 Abschlusszustand: „Liste abgearbeitet – 29 Anfragen gesendet, 3 übersprungen.“
          if (s === 'neue_anfragen' && anfragenSitzung.gesendet + anfragenSitzung.uebersprungen > 0 && !q.batch)
            return (
              <div
                key={s}
                role="status"
                className="border-line text-small text-ink-2 mb-6 flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-2.5"
              >
                <span className="tnum flex-1">
                  {listeAbgearbeitet(anfragenSitzung.gesendet, anfragenSitzung.uebersprungen)}
                </span>
                <Button variante="quiet" groesse="S" kbd="⌘⇧O" onClick={onListeEinfuegen}>
                  Nächste Liste einfügen
                </Button>
              </div>
            )
          return null
        }
        const abhak = ABHAK_SEKTIONEN.has(s)
        const langeUeberfaellig = s === 'ueberfaellig' && items.some((i) => (i.days_overdue ?? 0) >= 14)
        const ueberfaelligDarin = s === 'ueberfaellig' ? 0 : items.filter((i) => i.section === 'ueberfaellig').length
        return (
          <Sektion
            key={s}
            sektion={s}
            zaehler={items.length}
            ueberfaellig={ueberfaelligDarin || undefined}
            eingeklappt={eingeklappt.has(s)}
            onToggle={() => toggle(s)}
            art={abhak ? 'zeilen' : 'karten'}
            zusatz={
              s === 'annahme_pruefen' ? (
                <>
                  · offene Anfragen der letzten 7 Tage ·{' '}
                  <button
                    type="button"
                    className="text-ink-2 hover:text-ink underline-offset-2 hover:underline"
                    onClick={() => navigate(`${PFADE.leads}?ansicht=angefragt`)}
                  >
                    alle anzeigen
                  </button>
                </>
              ) : undefined
            }
            rechts={
              s === 'neue_anfragen' ? (
                <Button variante="quiet" groesse="S" kbd="⌘⇧O" onClick={onListeEinfuegen}>
                  Liste einfügen
                </Button>
              ) : langeUeberfaellig ? (
                <Button variante="quiet" groesse="S" kbd="⌥H" busy={alleAufHeuteLaeuft} onClick={onAlleAufHeute}>
                  Alle verschieben auf heute
                </Button>
              ) : undefined
            }
            unterzeile={
              s === 'neue_anfragen' ? (
                <span className={cn(tz.budget.erreicht && 'text-overdue')}>
                  Heute noch möglich: <span className="font-mono">{fmtZahl(tz.budget.moeglich)}</span> von{' '}
                  <span className="font-mono">{fmtZahl(tz.budget.tagesziel)}</span> · Woche{' '}
                  <span className={cn('font-mono', tz.budget.warnung && 'text-overdue')}>
                    {fmtVerhaeltnis(tz.woche, tz.budget.wochenbudget)}
                  </span>
                  {tz.budget.erreicht ? ' · Wochenbudget erreicht – weitere Anfragen auf eigenes Risiko' : null}
                </span>
              ) : undefined
            }
          >
            {abhak ? (
              <AbhakListe
                sektion={s as 'annahme_pruefen' | 'neue_anfragen' | 'zurueckziehen'}
                items={items}
                cursor={cursor}
                onCursor={setCursor}
                auswahl={auswahl}
                dialog={dialog}
                onDialog={setDialog}
                heute={heute}
              />
            ) : (
              zeilen.map((z) =>
                z.art === 'item' ? (
                  <div key={z.key} data-key={z.key} onClick={() => setCursor(z.key)} className="relative">
                    <QueueKarte
                      item={z.item}
                      aktiv={cursor === z.key}
                      onAktion={(a) => onKartenAktion(z.key, z.item, a)}
                    />
                  </div>
                ) : (
                  <ErledigtZeile
                    key={z.key}
                    art={z.e.art}
                    text={
                      z.e.art === 'spaeter' && z.e.text === 'verschoben'
                        ? spaeterText(q.byKey.get(z.key)?.due_date, heute)
                        : z.e.text
                    }
                    name={z.e.name}
                    activityId={z.e.activityId}
                  />
                ),
              )
            )}
            {fremd.map((f) => (
              <ErledigtZeile key={`fremd-${f.key}`} art="fremd" name={f.name} text={`von ${f.von} um ${f.zeit}`} />
            ))}
          </Sektion>
        )
      })}
    </>
  )
}

type HeuteTastenProps = {
  q: HeuteQueue
  cursor: string | null
  setCursor: (k: string | null) => void
  sichtbar: readonly string[]
  sektionVon: (key: string) => UiSektion | undefined
  auswahl: ReadonlySet<string>
  setAuswahl: (s: Set<string>) => void
  setDialog: (d: AbhakDialog) => void
  tz: TageszaehlerDaten
  onSpaeterLokal: (key: string, item: QueueItem) => void
}

/** Tastenbindung der Seite (useQueueHotkeys) – als eigene Komponente, damit sie innerhalb des Kontext-Providers läuft. */
function HeuteTasten({
  q,
  cursor,
  setCursor,
  sichtbar,
  sektionVon,
  auswahl,
  setAuswahl,
  setDialog,
  tz,
  onSpaeterLokal,
}: HeuteTastenProps) {
  const a = useQueueAktionen()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // Offener Peek (Palette, „Jetzt vorbereiten“ ohne Treffer): Heute-Tasten schweigen, sonst wirkten C/E/Ziffern auf die Karte
  // hinter dem Scrim statt auf den Lead im Peek (Review)
  const peekOffen = useUiStore((s) => !!s.peekLeadId)

  /** ⇧↓-Bereich + `E`/`Space`: alle markierten Abhakzeilen auf einmal, ein Sammel-Toast (ux § 2.2 Schritt 1). */
  const bereichAbhaken = useCallback(
    (keys: readonly string[]) => {
      const zeilen = keys.map((k) => q.byKey.get(k)).filter((i): i is QueueItem => !!i && istAbhakItem(i))
      for (const i of zeilen) void a.gesendet(i, { still: true })
      setAuswahl(new Set())
      const art = zeilen[0]?.item_kind
      const wort =
        art === 'annahme_pruefen'
          ? 'Annahmen erfasst'
          : art === 'neue_anfrage'
            ? 'Anfragen gesendet'
            : 'Anfragen zurückgezogen'
      toast(`${zeilen.length} ${wort}.`)
    },
    [a, q.byKey, setAuswahl],
  )

  const onTaste = useCallback(
    (key: string, taste: QueueTaste) => {
      const item = q.byKey.get(key)
      if (!item) return
      const art = kartenArt(item)
      const abhak = istAbhakItem(item)
      switch (taste) {
        case 'kopieren':
          if (abhak) {
            if (item.lead_id) {
              const p = new URLSearchParams(params)
              p.set('lead', item.lead_id)
              setParams(p, { replace: true })
            }
          } else if (art === 'telefon') a.anrufen(item)
          else if (art === 'email') a.emailOeffnen(item)
          else if (art !== 'meeting') void a.kopieren(item)
          return
        case 'kopieren_gesendet':
          if (abhak || art === 'meeting' || art === 'telefon') return
          void a.kopieren(item).then((ok) => {
            if (ok) void a.gesendet(item)
          })
          return
        case 'gesendet':
        case 'abhaken':
          if (taste === 'abhaken' && !abhak) return
          if (abhak && auswahl.size > 1 && auswahl.has(key)) bereichAbhaken([...auswahl])
          else void a.gesendet(item)
          return
        case 'gesendet_mit_notiz':
          if (item.item_kind === 'neue_anfrage') setDialog({ key, art: 'variante' })
          return
        case 'oeffnen':
          a.profilOeffnen(item)
          return
        case 'ablehnen':
          if (item.item_kind === 'annahme_pruefen') void a.abgelehnt(item)
          else if (item.item_kind === 'neue_anfrage') setDialog({ key, art: 'passt_nicht' })
          return
        case 'datum':
          if (item.item_kind === 'annahme_pruefen') setDialog({ key, art: 'datum' })
          return
        case 'pitch':
          if (art === 'antworten') void a.pitch(item)
          else if (
            item.item_kind === 'sequenz_schritt' &&
            item.channel === 'linkedin' &&
            q.schritt(item.step_id)?.sequenceKey === SEQUENZ.linkedin_nachfassen_im_gespraech
          )
            void a.gesendet(item, { pitch: true })
          return
        case 'notiz':
          if (abhak) setDialog({ key, art: 'notiz' })
          return
        case 'spaeter':
          if (abhak || art === 'antworten') onSpaeterLokal(key, item)
          return
        case 'bereich': {
          if (!abhak) return
          const i = sichtbar.indexOf(key)
          const next = sichtbar[i + 1]
          const neu = new Set(auswahl)
          neu.add(key)
          // Bereich nur innerhalb derselben Abhak-Sektion
          if (next && sektionVon(next) === sektionVon(key)) {
            neu.add(next)
            setCursor(next)
          }
          setAuswahl(neu)
          return
        }
        case 'email':
          if (item.lead_id)
            navigate(`${PFADE.emailVerfassen}?lead=${item.lead_id}&zurueck=${encodeURIComponent(PFADE.heute)}`)
          return
      }
    },
    [
      a,
      auswahl,
      bereichAbhaken,
      navigate,
      onSpaeterLokal,
      params,
      q,
      sektionVon,
      setAuswahl,
      setCursor,
      setDialog,
      setParams,
      sichtbar,
    ],
  )

  useQueueHotkeys({
    aktiv: !peekOffen,
    keys: sichtbar,
    cursor,
    setCursor,
    onTaste,
    onBatch: (n) => {
      const chip = q.chips[n]
      if (chip) q.setBatch(chip.filter)
    },
    onNeuSortieren: q.neuSortieren,
    onZaehler: tz.delta,
    onEscape: () => {
      if (auswahl.size) setAuswahl(new Set())
    },
  })
  return null
}
