// M3 – Lebenszyklus eines Anrufs (BAUPLAN § 3.4 useAnruf.ts): Anrufen → lokaler Entwurf { started_at, lead_id } (localStorage,
// überlebt App-Wechsel, MO-04) → Ergebnis → Folgeaktionen VOR log_call (send_info: Erlaubnis; do_not_call: Kanal-Umfang) →
// rpc.logCall → Folgeaktionen NACH log_call (send_info: email_consent_ref; gatekeeper: custom.zentrale) → Weiter.
// Konflikt ux § 2.5 („Klick Anrufen legt calls-Zeile an“) ↔ BAUPLAN § 3.4 Tabu („kein direkter Insert in calls“): BAUPLAN gilt –
// der Anruf existiert bis zum Ergebnis nur als lokaler Entwurf; „Verwerfen“ löscht den Entwurf.
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLogCall } from '@/data/calls'
import { ladeLead, useLeadUpdate } from '@/data/leads'
import { qk } from '@/data/queryKeys'
import { PFADE } from '@/app/pfade'
import { VORLAGE } from '@/lib/vorlagenKeys'
import type { Json } from '@/types/database'
import type { Call, Channel, LeadMitBezug, Task } from '@/types/domain'
import {
  logCallParameter,
  pruefeWrapUp,
  type ErgebnisDef,
  type ErgebnisTaste,
  type PflichtFeld,
  type WrapUpWerte,
} from './ergebnisse'
import {
  besetztText,
  folgeTextAusLead,
  naechsterVersuchText,
  rueckrufWiederholungText,
  WIEDERHOLUNG_OUTCOMES,
  type KadenzKontext,
} from './kadenz'
import { lokalEntfernen, lokalLesen, lokalSchreiben } from './lokal'

export const ANRUF_KEY = 'crm.anruf'
const AUTOSAVE_MS = 2000

export type AnrufEntwurf = {
  leadId: string
  startedAt: string
  notiz: string
  ergebnis: ErgebnisTaste | null
  dauerKorrekturSec: number | null
  templateId: string | null
}

export function entwurfLesen(leadId: string): AnrufEntwurf | null {
  const e = lokalLesen<AnrufEntwurf>(ANRUF_KEY)
  return e && e.leadId === leadId ? e : null
}
export function entwurfSchreiben(e: AnrufEntwurf): void {
  lokalSchreiben(ANRUF_KEY, e)
}
export function entwurfLoeschen(): void {
  lokalEntfernen(ANRUF_KEY)
}
/** Irgendein offener Entwurf (für den Hinweis in der Liste). */
export function offenerEntwurf(): AnrufEntwurf | null {
  return lokalLesen<AnrufEntwurf>(ANRUF_KEY)
}

export type AnrufOptionen = {
  lead: LeadMitBezug | undefined
  enrollmentId: string | null
  taskId: string | null
  task: Task | null
  templateId: string | null
  fromNumber: string | null
  kadenz: KadenzContext
  busyMinuten?: number
  versuch: number
}
type KadenzContext = KadenzKontext

export type AnrufVorschlag = { label: string; pfad: string }
export type AnrufErgebnis = { call: Call; text: string; vorschlag: AnrufVorschlag | null }

export type Anruf = {
  entwurf: AnrufEntwurf | null
  laeuft: boolean
  dauerSec: number
  ergebnis: ErgebnisTaste | null
  anrufen: () => void
  notizSetzen: (t: string) => void
  ergebnisSetzen: (taste: ErgebnisTaste | null) => void
  dauerKorrigieren: (sec: number | null) => void
  vorlageSetzen: (templateId: string | null) => void
  verwerfen: () => void
  /** Fehlende Pflichtfelder für das gewählte Ergebnis */
  fehlt: (def: ErgebnisDef, werte: WrapUpWerte, streng?: boolean) => PflichtFeld[]
  speichern: (def: ErgebnisDef, werte: WrapUpWerte, ohneWrapUp?: boolean) => Promise<AnrufErgebnis | null>
  istSpeichern: boolean
}

/** Vorschau-Text der Folgeaktion (ohne RPC) für die Wrap-up-Zeile. */
export function folgeText(
  def: ErgebnisDef,
  o: Pick<AnrufOptionen, 'task' | 'kadenz' | 'busyMinuten' | 'versuch'>,
  startedAt: string,
): string {
  switch (def.outcome) {
    case 'no_answer':
    case 'voicemail':
    case 'voicemail_left':
      return o.task?.kind === 'rueckruf'
        ? rueckrufWiederholungText(o.task, startedAt, o.kadenz)
        : naechsterVersuchText(o.versuch, startedAt, o.kadenz)
    case 'busy':
      return besetztText(o.busyMinuten ?? 45)
    default:
      return def.folge
  }
}

export function useAnruf(leadId: string, o: AnrufOptionen): Anruf {
  // je Lead gehalten: ein Wechsel der Route liest den Entwurf des neuen Leads ohne Effekt
  const [entwurfJeLead, setEntwurfJeLead] = useState<Record<string, AnrufEntwurf | null>>({})
  const entwurf = leadId in entwurfJeLead ? (entwurfJeLead[leadId] ?? null) : entwurfLesen(leadId)
  const setEntwurfState = useCallback(
    (e: AnrufEntwurf | null) => setEntwurfJeLead((alt) => ({ ...alt, [leadId]: e })),
    [leadId],
  )
  const [jetzt, setJetzt] = useState(() => Date.now())
  const [istSpeichern, setIstSpeichern] = useState(false)
  const logCall = useLogCall()
  const leadUpdate = useLeadUpdate()
  const qc = useQueryClient()
  const autosave = useRef<number | null>(null)

  // Timer tickt, solange ein Entwurf läuft
  useEffect(() => {
    if (!entwurf) return
    const t = window.setInterval(() => setJetzt(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [entwurf])

  const setEntwurf = useCallback(
    (e: AnrufEntwurf | null, sofort = true) => {
      setEntwurfState(e)
      if (!e) {
        entwurfLoeschen()
        return
      }
      if (sofort) {
        entwurfSchreiben(e)
        return
      }
      // Notiz: Autosave alle 2 s
      if (autosave.current) window.clearTimeout(autosave.current)
      autosave.current = window.setTimeout(() => entwurfSchreiben(e), AUTOSAVE_MS)
    },
    [setEntwurfState],
  )

  const anrufen = useCallback(() => {
    if (entwurf) return
    setJetzt(Date.now())
    setEntwurf({
      leadId,
      startedAt: new Date().toISOString(),
      notiz: '',
      ergebnis: null,
      dauerKorrekturSec: null,
      templateId: o.templateId,
    })
  }, [entwurf, leadId, o.templateId, setEntwurf])

  const notizSetzen = useCallback(
    (t: string) => {
      const basis: AnrufEntwurf = entwurf ?? {
        leadId,
        startedAt: new Date().toISOString(),
        notiz: '',
        ergebnis: null,
        dauerKorrekturSec: null,
        templateId: o.templateId,
      }
      setEntwurf({ ...basis, notiz: t }, false)
    },
    [entwurf, leadId, o.templateId, setEntwurf],
  )

  const ergebnisSetzen = useCallback(
    (taste: ErgebnisTaste | null) => {
      // Schnell-Ergebnis ohne Klick auf Anrufen (Heute-Karte, DESIGN-SYSTEM § 5.8): Entwurf entsteht jetzt
      const basis: AnrufEntwurf = entwurf ?? {
        leadId,
        startedAt: new Date().toISOString(),
        notiz: '',
        ergebnis: null,
        dauerKorrekturSec: null,
        templateId: o.templateId,
      }
      setEntwurf({ ...basis, ergebnis: taste })
    },
    [entwurf, leadId, o.templateId, setEntwurf],
  )

  const dauerKorrigieren = useCallback(
    (sec: number | null) => {
      if (!entwurf) return
      setEntwurf({ ...entwurf, dauerKorrekturSec: sec })
    },
    [entwurf, setEntwurf],
  )

  const vorlageSetzen = useCallback(
    (templateId: string | null) => {
      if (!entwurf) return
      setEntwurf({ ...entwurf, templateId })
    },
    [entwurf, setEntwurf],
  )

  const verwerfen = useCallback(() => setEntwurf(null), [setEntwurf])

  const dauerSec = useMemo(() => {
    if (!entwurf) return 0
    if (entwurf.dauerKorrekturSec !== null) return entwurf.dauerKorrekturSec
    return Math.max(0, Math.floor((jetzt - new Date(entwurf.startedAt).getTime()) / 1000))
  }, [entwurf, jetzt])

  const fehlt = useCallback(
    (def: ErgebnisDef, werte: WrapUpWerte, streng = true) => pruefeWrapUp(def, werte, streng),
    [],
  )

  const speichern = useCallback(
    async (def: ErgebnisDef, werte: WrapUpWerte, ohneWrapUp = false): Promise<AnrufErgebnis | null> => {
      const e = entwurf
      const lead = o.lead
      if (!e || !lead || istSpeichern) return null
      if (pruefeWrapUp(def, werte, !ohneWrapUp).length) return null
      setIstSpeichern(true)
      // Erlaubnis vor log_call (BAUPLAN § 3.4 wörtlich) – scheitert log_call danach, wird sie zurückgenommen (Review: sonst bliebe
      // eine Erlaubnis „requested_phone“ mit Referenz `pending` ohne den Anruf, auf den sie sich bezieht)
      let erlaubnisVorher: Pick<
        LeadMitBezug,
        'email_consent_basis' | 'email_consent_at' | 'email_consent_note' | 'email_consent_ref'
      > | null = null
      let geloggt = false
      try {
        let aktuell = lead
        const zitat = werte.zitat.trim()

        // VOR log_call (BAUPLAN § 3.4): Erlaubnis bei `0`, Kanal-Umfang bei `D`
        if (def.outcome === 'send_info') {
          erlaubnisVorher = {
            email_consent_basis: lead.email_consent_basis,
            email_consent_at: lead.email_consent_at,
            email_consent_note: lead.email_consent_note,
            email_consent_ref: lead.email_consent_ref,
          }
          aktuell = (await leadUpdate.mutateAsync({
            id: lead.id,
            erwartetUpdatedAt: aktuell.updated_at,
            patch: {
              email_consent_basis: 'requested_phone',
              email_consent_at: new Date().toISOString(),
              email_consent_note: zitat,
              email_consent_ref: { call: 'pending' },
            },
          })) as LeadMitBezug
        } else if (def.outcome === 'do_not_call') {
          // nur die Kanäle – `do_not_contact` setzt log_call selbst (sonst lehnt es den ausgehenden Anruf ab)
          const kanaele: Channel[] = werte.widerspruchKanaele.length ? werte.widerspruchKanaele : ['telefon']
          aktuell = (await leadUpdate.mutateAsync({
            id: lead.id,
            erwartetUpdatedAt: aktuell.updated_at,
            patch: { do_not_contact_channels: kanaele },
          })) as LeadMitBezug
        }

        const params = logCallParameter({
          leadId,
          def,
          werte,
          startedAt: e.startedAt,
          dauerSec:
            e.dauerKorrekturSec ?? Math.max(0, Math.floor((Date.now() - new Date(e.startedAt).getTime()) / 1000)),
          notiz: e.notiz,
          enrollmentId: o.enrollmentId,
          taskId: o.taskId,
          templateId: e.templateId ?? o.templateId,
          toNumber: lead.phone_e164,
          fromNumber: o.fromNumber,
          dueTime: o.kadenz.dueTime,
        })
        const call = await logCall.mutateAsync(params)
        geloggt = true

        // NACH log_call
        if (def.outcome === 'send_info' || def.outcome === 'gatekeeper') {
          const frisch = await ladeLead(leadId)
          const custom = (
            frisch.custom && typeof frisch.custom === 'object' && !Array.isArray(frisch.custom) ? frisch.custom : {}
          ) as Record<string, Json | undefined>
          const patch =
            def.outcome === 'send_info'
              ? { email_consent_ref: { call_id: call.id } }
              : {
                  custom: {
                    ...custom,
                    zentrale: {
                      name: werte.zentraleName.trim() || null,
                      durchwahl: werte.zentraleDurchwahl.trim() || null,
                      bester_zeitpunkt: werte.zentraleZeitpunkt.trim() || null,
                    },
                  } as Json,
                }
          await leadUpdate.mutateAsync({ id: leadId, erwartetUpdatedAt: frisch.updated_at, patch })
        }

        void qc.invalidateQueries({ queryKey: ['enrollments'] })
        void qc.invalidateQueries({ queryKey: ['tasks'] })
        void qc.invalidateQueries({ queryKey: qk.leads.all })
        setEntwurf(null)

        let text = folgeText(def, o, e.startedAt)
        // Wrap-up-Text aus dem Zustand nach log_call (neuer Rückruf-Task „(Wiederholung n)“, Enrollment-Position)
        if (WIEDERHOLUNG_OUTCOMES.has(def.outcome)) {
          try {
            const frisch = await ladeLead(leadId)
            text =
              folgeTextAusLead(frisch, {
                outcome: def.outcome,
                alterTaskId: o.taskId,
                ausRueckruf: o.task?.kind === 'rueckruf',
                kadenz: o.kadenz,
              }) ?? text
          } catch {
            // Vorschau bleibt
          }
        }
        let vorschlag: AnrufVorschlag | null = null
        if (def.outcome === 'voicemail_left')
          vorschlag = {
            label: 'LinkedIn-DM Kurzfristig 1 senden?',
            pfad: `${PFADE.heute}?lead=${encodeURIComponent(leadId)}`,
          }
        if (def.outcome === 'meeting_booked')
          vorschlag = {
            label: 'Terminbestätigung per E-Mail',
            pfad: `${PFADE.emailVerfassen}?lead=${encodeURIComponent(leadId)}&vorlage=${VORLAGE.em_terminbestaetigung_erstgespraech}`,
          }
        return { call, text, vorschlag }
      } catch {
        if (erlaubnisVorher && !geloggt) {
          try {
            const frisch = await ladeLead(leadId)
            await leadUpdate.mutateAsync({ id: leadId, erwartetUpdatedAt: frisch.updated_at, patch: erlaubnisVorher })
          } catch {
            // Rücknahme gescheitert – Fehler-Toast aus dem Hook; die Erlaubnis-Historie zeigt beide Schritte
          }
        }
        return null // Fehler-Toast kommt aus den Hooks (errors.ts)
      } finally {
        setIstSpeichern(false)
      }
    },
    [entwurf, o, istSpeichern, leadUpdate, logCall, leadId, qc, setEntwurf],
  )

  return {
    entwurf,
    laeuft: !!entwurf,
    dauerSec,
    ergebnis: entwurf?.ergebnis ?? null,
    anrufen,
    notizSetzen,
    ergebnisSetzen,
    dauerKorrigieren,
    vorlageSetzen,
    verwerfen,
    fehlt,
    speichern,
    istSpeichern,
  }
}
