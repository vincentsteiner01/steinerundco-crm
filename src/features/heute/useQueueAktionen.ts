// Ausführung der Queue-Aktionen (BAUPLAN § 3.2 „Tastatur“/„Verhalten“): E je Sektion (complete_step · complete_task · log_outbound
// + Folgeaktion · mark_accepted · log_request · Zurückziehen), C Kopieren, X Abgelehnt/Passt nicht, D Datum, P Pitch, O Profil,
// Enter Anrufen/E-Mail. Optimistisch (Karte verschwindet sofort), Undo-Toast über die Trigger-Aktivität (E16).
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { toast } from '@/components/toast'
import { ladeTimelineSeite, nachleseAktivitaet } from '@/data/activities'
import { useConnectionAblehnen, useConnectionZurueckziehen } from '@/data/connections'
import { useCompleteStep, useEnroll } from '@/data/enrollments'
import { ladeLead, useLeadUpdate } from '@/data/leads'
import { useLogOutbound } from '@/data/outbound'
import { qk } from '@/data/queryKeys'
import { useSequencesIndex } from '@/data/sequences'
import { useSettings } from '@/data/settings'
import { useCompleteTask, useSetWiedervorlage } from '@/data/tasks'
import { useTemplates } from '@/data/templates'
import { useUndo } from '@/data/undo'
import { naechsteFaelligkeit } from '@/features/sequenzen/planer'
import { fmtDatum, fmtDatumKurz, fmtZeit } from '@/lib/format'
import { linkedinHref } from '@/lib/url'
import { SEQUENZ, VORLAGE } from '@/lib/vorlagenKeys'
import { rollToWeekday } from '@/lib/werktage'
import { tagPlus } from '@/lib/zeit'
import { kopieren } from '@/lib/zwischenablage'
import { GRUND_LABEL, TOAST } from '@/texte/de'
import type { CallOutcome, EndedReason, LeadMitBezug, NoteVariant, QueueItem, UiSektion } from '@/types/domain'
import { useLogRequest, useMarkAccepted } from '@/data/connections'
import { queueOptimistischEntfernen } from '@/data/queue'
import { SCHRITT_TYPEN } from './daten/nachlese'
import { kartenZustand, useKartenStore } from './kartenStore'
import { useHeuteKontext } from './kontext'
import { kartenArt, nachId, nachKey, type AntwortInfo } from './nachricht'
import { itemKey } from './sektionen'
import { lies, schreibe, SPEICHER } from './speicher'
import type { HeuteQueue } from './useHeuteQueue'

export type ErledigtEintrag = {
  art: 'erledigt' | 'spaeter'
  text: string
  activityId: number | null
  name: string | null
}

export type PasstNichtGrund = { key: string; kbd: string; label: string; reason: EndedReason; note: string | null }
/** „Passt nicht“ (ux § 2.1 Schritt 2, BAUPLAN § 1.5 Nr. 7): Stufe beendet mit Grund/Note, zählt in keiner KPI. */
export const PASST_NICHT: readonly PasstNichtGrund[] = [
  { key: 'url', kbd: '1', label: 'URL ungültig/404', reason: 'sonstiges', note: 'URL ungültig/404' },
  { key: 'nicht_icp', kbd: '2', label: 'Nicht ICP', reason: 'nicht_icp', note: null },
  { key: 'vernetzt', kbd: '3', label: 'Bereits vernetzt', reason: 'duplikat', note: 'bereits vernetzt' },
  { key: 'firmenseite', kbd: '4', label: 'Firmenseite', reason: 'sonstiges', note: 'Firmenseite' },
]

export type NoteVarianteWahl = { variant: NoteVariant; kbd: string; label: string }
export const NOTE_VARIANTEN: readonly NoteVarianteWahl[] = [
  { variant: 'note_v1', kbd: '1', label: 'Notiz V1 · Wissensassistent' },
  { variant: 'note_v2', kbd: '2', label: 'Notiz V2 · Zeitaufwand' },
]

export type AktionenKontext = {
  heute: string
  /** aktuell fällige Karten (Toast „noch n fällig“) */
  offen: () => number
  schritt: HeuteQueue['schritt']
  markiereEigen: (key: string) => void
  onErledigt: (key: string, eintrag: ErledigtEintrag) => void
  /** Abhakzeile verschwunden – `erledigt` zählt in „Erledigt“, `uebersprungen` (Passt nicht, Abgelehnt) nur im Abschluss-Satz */
  onAbgehakt: (sektion: UiSektion, art: 'erledigt' | 'uebersprungen') => void
  /** Realtime-Neuzugang dieser Sitzung (Chip „neu“ 4 s, H-16) */
  istNeu: (key: string) => boolean
}

/** Satzende genau einmal: „… am Mo 19.10.“ endet schon mit Punkt (Datum), „… gesendet“ bekommt einen. */
const satz = (t: string) => (t.endsWith('.') ? t : `${t}.`)

const SCHNELL_ERGEBNIS: Record<'1' | '2' | '3' | '7', CallOutcome> = {
  '1': 'no_answer',
  '2': 'busy',
  '3': 'voicemail',
  '7': 'callback_scheduled',
}

export function useQueueAktionen() {
  const ctx = useHeuteKontext()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const { data: templates } = useTemplates()
  const { data: idx } = useSequencesIndex()
  const { anbieten } = useUndo()
  const setze = useKartenStore((s) => s.setze)
  const completeStep = useCompleteStep()
  const completeTask = useCompleteTask()
  const logOutbound = useLogOutbound()
  const enroll = useEnroll()
  const setWiedervorlage = useSetWiedervorlage()
  const markAccepted = useMarkAccepted()
  const logRequest = useLogRequest()
  const ablehnenMut = useConnectionAblehnen()
  const zurueckMut = useConnectionZurueckziehen()
  const leadUpdate = useLeadUpdate()

  const feiertage = settings?.feiertage
  const zurueck = encodeURIComponent(PFADE.heute)

  const melde = useCallback(
    (activityId: number | null, text: string, leadId: string | null, still = false) => {
      if (still) return
      if (activityId !== null && leadId) anbieten(activityId, text, leadId)
      else toast(text)
    },
    [anbieten],
  )

  const ladeLeadDetail = useCallback(
    (leadId: string) =>
      qc.fetchQuery<LeadMitBezug>({
        queryKey: qk.leads.detail(leadId),
        queryFn: () => ladeLead(leadId),
        staleTime: 5_000,
      }),
    [qc],
  )

  const entferne = useCallback(
    (item: QueueItem) => {
      ctx.markiereEigen(itemKey(item))
      return queueOptimistischEntfernen(qc, (i) => itemKey(i) === itemKey(item))
    },
    [qc, ctx],
  )
  const zurueckholen = useCallback(
    (vorher: [QueryKey, unknown][]) => {
      for (const [key, daten] of vorher) qc.setQueryData(key, daten)
    },
    [qc],
  )

  /** Gate der aufgeklappten Karte (H-20): gesperrt → Grund als Toast, Aktion fällt aus. */
  const gesperrt = useCallback((item: QueueItem): boolean => {
    const grund = kartenZustand(itemKey(item)).gesperrt
    if (grund) toast(`${grund.replace(/\.$/, '')}.`)
    return !!grund
  }, [])

  /** `C`/`Enter`: gefüllten Text kopieren – gesperrt bei offenem Platzhalter (H-03/H-04) oder Gate (H-20). */
  const kopierenAktion = useCallback(
    async (item: QueueItem): Promise<boolean> => {
      const key = itemKey(item)
      if (gesperrt(item)) return false
      const erg = kartenZustand(key).ergebnis
      if (!erg || !erg.text.trim()) return false
      if (erg.offen.length) {
        toast(`Erst ${erg.offen[0]} eintragen.`)
        return false
      }
      const r = await kopieren(erg.text)
      if (r === 'fallback') {
        toast('Text markiert – ⌘C/Teilen')
        return false
      }
      setze(key, { kopiertUm: fmtZeit(new Date()) })
      const schluessel = SPEICHER.kopiertHinweis(ctx.heute)
      const erstesMal = lies(schluessel) !== 'ja'
      schreibe(schluessel, 'ja')
      toast(erstesMal && item.channel === 'linkedin' ? TOAST.kopiertErstesMal : TOAST.kopiert)
      return true
    },
    [ctx.heute, gesperrt, setze],
  )

  /** Sequenzschritt erledigt (`E`, `P` auf Sequenz-C-Karte): complete_step('gesendet'); Toast „Erledigt – <nächster> am …“. */
  const schrittErledigt = useCallback(
    async (item: QueueItem, opts: { pitch?: boolean } = {}) => {
      if (!item.enrollment_id || !item.lead_id) return
      const key = itemKey(item)
      const erg = kartenZustand(key).ergebnis
      let templateId: string | null = erg?.vorlageId && erg.vorlageId !== item.template_id ? erg.vorlageId : null
      if (opts.pitch)
        templateId =
          erg?.phase === 'pitch' ? (erg.vorlageId ?? null) : (nachKey(templates, VORLAGE.li_pitch_a)?.id ?? null)
      const vorher = entferne(item)
      let e
      try {
        e = await completeStep.mutateAsync({
          enrollmentId: item.enrollment_id,
          leadId: item.lead_id,
          outcome: 'gesendet',
          templateId,
        })
      } catch {
        zurueckholen(vorher)
        return
      }
      const naechster = e.status === 'abgeschlossen' ? null : ctx.schritt(e.current_step_id)
      const wann = e.next_due_at ? fmtDatumKurz(e.next_due_at) : null
      const text = naechster && wann ? `${naechster.name} am ${wann}` : 'Sequenz abgeschlossen'
      const a = await nachleseAktivitaet(item.lead_id, SCHRITT_TYPEN)
      melde(
        a?.id ?? null,
        TOAST.erledigt(naechster?.name ?? 'Sequenz abgeschlossen', wann ?? '–', Math.max(0, ctx.offen() - 1)),
        item.lead_id,
      )
      ctx.onErledigt(key, { art: 'erledigt', text, activityId: a?.id ?? null, name: item.lead_name })
    },
    [completeStep, ctx, entferne, melde, templates, zurueckholen],
  )

  /** Aufgabe/Rückruf/Wiedervorlage erledigt: complete_task. */
  const aufgabeErledigt = useCallback(
    async (item: QueueItem) => {
      if (!item.task_id || !item.lead_id) return
      const key = itemKey(item)
      const vorher = entferne(item)
      try {
        await completeTask.mutateAsync({ taskId: item.task_id, leadId: item.lead_id })
      } catch {
        zurueckholen(vorher)
        return
      }
      const a = await nachleseAktivitaet(item.lead_id, ['aufgabe_erledigt'])
      const titel = item.title ?? 'Aufgabe'
      melde(a?.id ?? null, `Erledigt – ${titel} · noch ${Math.max(0, ctx.offen() - 1)} fällig.`, item.lead_id)
      ctx.onErledigt(key, { art: 'erledigt', text: titel, activityId: a?.id ?? null, name: item.lead_name })
    },
    [completeTask, ctx, entferne, melde, zurueckholen],
  )

  /** Antworten-Karte `E`: log_outbound(nachricht) + Folgeaktion nach Label (§ 1.5 Nr. 26, H-22). */
  const antwortGesendet = useCallback(
    async (item: QueueItem, antwortVorgabe: AntwortInfo | null) => {
      if (!item.lead_id) return
      const key = itemKey(item)
      const erg = kartenZustand(key).ergebnis
      let antwort = antwortVorgabe
      if (!antwort) {
        // Tastenweg ohne Karte (⌘Enter von der Seite): Label der letzten Antwort nachlesen
        const letzte = await ladeTimelineSeite(item.lead_id, null, { types: ['nachricht_erhalten'] }).catch(() => [])
        const l = letzte[0]
        antwort = l
          ? { label: (l.reply_label as AntwortInfo['label']) ?? null, note: l.note, occurredAt: l.occurred_at }
          : null
      }
      const vorher = entferne(item)
      let activityId: number
      try {
        activityId = await logOutbound.mutateAsync({
          leadId: item.lead_id,
          channel: 'linkedin',
          templateId: erg?.vorlageId ?? null,
          kind: 'nachricht',
        })
      } catch {
        zurueckholen(vorher)
        return
      }
      const label = antwort?.label ?? null
      let text: string
      try {
        if (label === 'spaeter' || label === 'hat_partner') {
          const tage =
            label === 'spaeter'
              ? (settings?.langfristig.default_days ?? 60)
              : (settings?.langfristig.hat_partner_days ?? 180)
          const due = tagPlus(ctx.heute, tage)
          await setWiedervorlage.mutateAsync({
            leadId: item.lead_id,
            due,
            templateId: nachKey(templates, VORLAGE.li_fu_lang_1)?.id ?? null,
            note: antwort?.note ?? null,
          })
          text = `Antwort gesendet · Wiedervorlage am ${fmtDatum(rollToWeekday(due, feiertage))}`
        } else {
          await enroll.mutateAsync({ leadId: item.lead_id, sequenceKey: SEQUENZ.linkedin_nachfassen_im_gespraech })
          const c = idx?.byKey.get(SEQUENZ.linkedin_nachfassen_im_gespraech)
          const delay = c?.steps[0]?.delay_days ?? 3
          text = `Antwort gesendet · Nachfassen am ${fmtDatumKurz(naechsteFaelligkeit(ctx.heute, delay, c?.weekdays_only ?? true, feiertage))}`
        }
      } catch {
        text = 'Antwort gesendet'
      }
      melde(activityId, satz(`Erledigt – ${text}`), item.lead_id)
      ctx.onErledigt(key, { art: 'erledigt', text, activityId, name: item.lead_name })
    },
    [ctx, enroll, entferne, feiertage, idx, logOutbound, melde, setWiedervorlage, settings, templates, zurueckholen],
  )

  /** Antworten-Karte `P`: log_outbound(pitch, Pitch A/B) + enroll(C, „nach Pitch“) (H-21). */
  const pitchGesendet = useCallback(
    async (item: QueueItem) => {
      if (!item.lead_id) return
      const key = itemKey(item)
      const erg = kartenZustand(key).ergebnis
      if (gesperrt(item)) return
      const pitch = erg?.phase === 'pitch' ? nachId(templates, erg.vorlageId) : nachKey(templates, VORLAGE.li_pitch_a)
      if (erg?.phase === 'pitch' && erg.offen.length) {
        toast(`Erst ${erg.offen[0]} eintragen.`)
        return
      }
      const vorher = entferne(item)
      let activityId: number
      try {
        activityId = await logOutbound.mutateAsync({
          leadId: item.lead_id,
          channel: 'linkedin',
          templateId: pitch?.id ?? null,
          kind: 'pitch',
        })
      } catch {
        zurueckholen(vorher)
        return
      }
      let text = `Pitch ${pitch?.key === VORLAGE.li_pitch_b ? 'B' : 'A'} gesendet`
      try {
        await enroll.mutateAsync({
          leadId: item.lead_id,
          sequenceKey: SEQUENZ.linkedin_nachfassen_im_gespraech,
          note: 'nach Pitch',
        })
        const c = idx?.byKey.get(SEQUENZ.linkedin_nachfassen_im_gespraech)
        const delay = c?.steps[0]?.delay_days ?? 3
        text += ` · Nachfassen am ${fmtDatumKurz(naechsteFaelligkeit(ctx.heute, delay, c?.weekdays_only ?? true, feiertage))}`
      } catch {
        // Sequenz C lief bereits oder ist gesperrt – der Pitch ist trotzdem verbucht
      }
      melde(activityId, satz(text), item.lead_id)
      ctx.onErledigt(key, { art: 'erledigt', text, activityId, name: item.lead_name })
    },
    [ctx, enroll, entferne, feiertage, gesperrt, idx, logOutbound, melde, templates, zurueckholen],
  )

  /** Annahme prüfen `E`/`Space` (H-13) – optional mit Datum (`D`); `still` = Bereich (⇧↓), Sammel-Toast macht die Seite. */
  const angenommen = useCallback(
    async (item: QueueItem, datum?: string | null, still = false) => {
      if (!item.lead_id) return
      ctx.markiereEigen(itemKey(item))
      try {
        await markAccepted.mutateAsync({ leadId: item.lead_id, date: datum ?? null })
      } catch {
        return
      }
      const a = still ? null : await nachleseAktivitaet(item.lead_id, ['vernetzung_angenommen'])
      melde(a?.id ?? null, TOAST.angenommen, item.lead_id, still)
      ctx.onAbgehakt('annahme_pruefen', 'erledigt')
    },
    [ctx, markAccepted, melde],
  )

  /** Neue Anfragen `E`/`⇧E` (H-11). */
  const anfrageGesendet = useCallback(
    async (item: QueueItem, noteVariant: NoteVariant = 'ohne', still = false) => {
      if (!item.lead_id) return
      ctx.markiereEigen(itemKey(item))
      try {
        await logRequest.mutateAsync({ leadId: item.lead_id, noteVariant })
      } catch {
        return
      }
      const a = still ? null : await nachleseAktivitaet(item.lead_id, ['vernetzung_gesendet'])
      const variante = NOTE_VARIANTEN.find((v) => v.variant === noteVariant)
      melde(
        a?.id ?? null,
        variante ? `Anfrage mit ${variante.label.split(' · ')[0]} gesendet.` : 'Anfrage gesendet.',
        item.lead_id,
        still,
      )
      ctx.onAbgehakt('neue_anfragen', 'erledigt')
    },
    [ctx, logRequest, melde],
  )

  /** Zurückziehen `E` (ux § 2.7 Schritt 5). */
  const zurueckgezogen = useCallback(
    async (item: QueueItem, still = false) => {
      if (!item.connection_id || !item.lead_id) return
      const vorher = entferne(item)
      let r
      try {
        r = await zurueckMut.mutateAsync({ id: item.connection_id, leadId: item.lead_id })
      } catch {
        zurueckholen(vorher)
        return
      }
      melde(r.activity?.id ?? null, 'Anfrage zurückgezogen.', item.lead_id, still)
      ctx.onAbgehakt('zurueckziehen', 'erledigt')
    },
    [ctx, entferne, melde, zurueckMut, zurueckholen],
  )

  /** Annahme prüfen `X`: Abgelehnt (§ 1.5 Nr. 34, H-23). */
  const abgelehnt = useCallback(
    async (item: QueueItem) => {
      if (!item.connection_id || !item.lead_id) return
      const vorher = entferne(item)
      let r
      try {
        r = await ablehnenMut.mutateAsync({ id: item.connection_id, leadId: item.lead_id })
      } catch {
        zurueckholen(vorher)
        return
      }
      melde(r.activity?.id ?? null, 'Anfrage abgelehnt.', item.lead_id)
      ctx.onAbgehakt('annahme_pruefen', 'uebersprungen')
    },
    [ablehnenMut, ctx, entferne, melde, zurueckholen],
  )

  /** Neue Anfragen `X`: Passt nicht → beendet mit Grund (§ 1.5 Nr. 7). */
  const passtNicht = useCallback(
    async (item: QueueItem, grund: PasstNichtGrund) => {
      if (!item.lead_id) return
      const vorher = entferne(item)
      try {
        const lead = await ladeLeadDetail(item.lead_id)
        await leadUpdate.mutateAsync({
          id: lead.id,
          erwartetUpdatedAt: lead.updated_at,
          patch: { stage: 'beendet', ended_reason: grund.reason, ended_note: grund.note },
        })
      } catch {
        zurueckholen(vorher)
        return
      }
      const a = await nachleseAktivitaet(item.lead_id, ['stage_wechsel'])
      melde(a?.id ?? null, `Passt nicht · ${grund.label} · ${GRUND_LABEL[grund.reason]}.`, item.lead_id)
      ctx.onAbgehakt('neue_anfragen', 'uebersprungen')
    },
    [ctx, entferne, ladeLeadDetail, leadUpdate, melde, zurueckholen],
  )

  /** `O`: Profil in neuem Tab; bei Neue Anfragen `url_verified = true` (ux § 2.1 Schritt 2). */
  const profilOeffnen = useCallback(
    (item: QueueItem) => {
      const href = linkedinHref(item.linkedin_url)
      if (!href) {
        toast('Keine LinkedIn-URL hinterlegt.')
        return
      }
      window.open(href, '_blank', 'noopener')
      if (item.item_kind === 'neue_anfrage' && item.lead_id) {
        void ladeLeadDetail(item.lead_id)
          .then((lead) =>
            lead.url_verified
              ? null
              : leadUpdate.mutateAsync({
                  id: lead.id,
                  erwartetUpdatedAt: lead.updated_at,
                  patch: { url_verified: true },
                }),
          )
          .catch(() => null)
      }
    },
    [ladeLeadDetail, leadUpdate],
  )

  const anrufen = useCallback(
    (item: QueueItem) => {
      if (!item.lead_id || gesperrt(item)) return
      navigate(`${PFADE.anruf(item.lead_id)}?zurueck=${zurueck}`)
    },
    [gesperrt, navigate, zurueck],
  )
  const schnellErgebnis = useCallback(
    (item: QueueItem, taste: keyof typeof SCHNELL_ERGEBNIS) => {
      // Gate wie „Anrufen“ (§ 8.2 Nr. 2): ohne Anrufgrund, mit Sperrliste/Widerspruch kein Weg in den Anruf-Screen (Review)
      if (!item.lead_id || gesperrt(item)) return
      navigate(`${PFADE.anruf(item.lead_id)}?ergebnis=${SCHNELL_ERGEBNIS[taste]}&zurueck=${zurueck}`)
    },
    [gesperrt, navigate, zurueck],
  )
  const emailOeffnen = useCallback(
    (item: QueueItem) => {
      if (!item.lead_id || gesperrt(item)) return
      const p = new URLSearchParams({ lead: item.lead_id, zurueck: PFADE.heute })
      if (item.step_id) p.set('schritt', item.step_id)
      if (item.enrollment_id) p.set('enrollment', item.enrollment_id)
      navigate(`${PFADE.emailVerfassen}?${p.toString()}`)
    },
    [gesperrt, navigate],
  )

  /**
   * `E` je Sektion/Kartenart (BAUPLAN § 3.2 „Tastatur“). Telefon-Karten haben kein `E`: das Ergebnis entsteht nur im
   * Anruf-Screen (Tabu § 3.2, ux § 3.1.2 Varianten). Gesperrte Karten (Gate) lösen nichts aus.
   */
  const gesendet = useCallback(
    (
      item: QueueItem,
      opts: { antwort?: AntwortInfo | null; noteVariant?: NoteVariant; pitch?: boolean; still?: boolean } = {},
    ) => {
      const art = kartenArt(item)
      if (art === 'telefon' || art === 'meeting') return Promise.resolve()
      if (gesperrt(item)) return Promise.resolve()
      switch (item.item_kind) {
        case 'antworten':
          return antwortGesendet(item, opts.antwort ?? null)
        case 'annahme_pruefen':
          return angenommen(item, null, opts.still)
        case 'neue_anfrage':
          return anfrageGesendet(item, opts.noteVariant ?? 'ohne', opts.still)
        case 'zurueckziehen':
          return zurueckgezogen(item, opts.still)
        case 'sequenz_schritt':
          return schrittErledigt(item, { pitch: opts.pitch })
        case 'rueckruf':
        case 'wiedervorlage':
        case 'aufgabe':
          return aufgabeErledigt(item)
        default:
          return Promise.resolve()
      }
    },
    [anfrageGesendet, angenommen, antwortGesendet, aufgabeErledigt, gesperrt, schrittErledigt, zurueckgezogen],
  )

  return {
    kopieren: kopierenAktion,
    gesendet,
    pitch: pitchGesendet,
    angenommen,
    abgelehnt,
    passtNicht,
    profilOeffnen,
    anrufen,
    schnellErgebnis,
    emailOeffnen,
    kartenArt,
  }
}

export type QueueAktionen = ReturnType<typeof useQueueAktionen>
