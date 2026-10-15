// Feedback (Migration 6): Meldungen an Claude – Liste, Senden (Screenshot in den privaten Bucket „crm-feedback“, dann Zeile),
// Status/Notiz ändern, Screenshot über eine Signed URL (2 min) als blob:-URL laden (CSP img-src erlaubt blob:, nicht den
// Supabase-Host), Realtime-Kanal nur für crm.feedback und die „gesehen“-Merkliste für Antwort-Toasts.
// Query-Key: qk.feedback (['feedback']).
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import type { Database, Json } from '@/types/database'
import { pruefe } from './_helfer'
import { mutationFehler } from './errors'
import { qk } from './queryKeys'
import { supabase } from './supabase'

type Zeile = Database['crm']['Tables']['feedback']['Row']
export type FeedbackArt = 'fehler' | 'wunsch' | 'frage'
export type FeedbackStatus = 'neu' | 'in_arbeit' | 'erledigt' | 'abgelehnt'
export type Feedback = Omit<Zeile, 'art' | 'status'> & { art: FeedbackArt; status: FeedbackStatus }

export const FEEDBACK_ARTEN: readonly FeedbackArt[] = ['fehler', 'wunsch', 'frage']
export const FEEDBACK_STATUS: readonly FeedbackStatus[] = ['neu', 'in_arbeit', 'erledigt', 'abgelehnt']
export const FEEDBACK_BUCKET = 'crm-feedback'
export const FEEDBACK_MAX_BYTES = 5 * 1024 * 1024
export const SIGNED_URL_SEKUNDEN = 120
export const FEEDBACK_KEY = qk.feedback

type Client = typeof supabase

export async function ladeFeedback(client: Client = supabase): Promise<Feedback[]> {
  const zeilen = pruefe(
    await client.from('feedback').select('*').order('created_at', { ascending: false }).limit(500),
  ) as Zeile[]
  return zeilen as Feedback[]
}

export function useFeedbackListe(enabled = true) {
  return useQuery({ queryKey: FEEDBACK_KEY, queryFn: () => ladeFeedback(), enabled, staleTime: 30_000 })
}

/** Dateiendung zum Bildtyp (Pfad im Bucket: `<feedback-id>.<endung>`). */
export function bildEndung(typ: string): 'png' | 'jpg' | 'webp' | null {
  if (typ === 'image/png') return 'png'
  if (typ === 'image/jpeg') return 'jpg'
  if (typ === 'image/webp') return 'webp'
  return null
}

export type FeedbackNeu = {
  /** Client-seitig erzeugt, damit der Screenshot vor der Zeile hochgeladen werden kann. */
  id: string
  art: FeedbackArt
  titel: string | null
  beschreibung: string
  route: string
  url: string
  viewport: string
  user_agent: string
  app_version: string
  konsole: Json
  bild: Blob | null
}
export type FeedbackGesendet = { id: string; mitBild: boolean; bildFehler: boolean }

/**
 * Lädt zuerst den Screenshot hoch (falls vorhanden; ohne Überschreiben), dann die Zeile mit `screenshot_path`.
 * Scheitert nur der Upload, wird die Meldung trotzdem gespeichert (`bildFehler = true`) – der Text geht nie verloren.
 */
export async function sendeFeedback(n: FeedbackNeu, client: Client = supabase): Promise<FeedbackGesendet> {
  let pfad: string | null = null
  let bildFehler = false
  if (n.bild) {
    const endung = bildEndung(n.bild.type)
    if (!endung || n.bild.size > FEEDBACK_MAX_BYTES) bildFehler = true
    else {
      const ziel = `${n.id}.${endung}`
      const { error } = await client.storage
        .from(FEEDBACK_BUCKET)
        .upload(ziel, n.bild, { contentType: n.bild.type, upsert: false, cacheControl: '3600' })
      // Schon vorhanden (zweiter Versuch nach einem Fehler beim Anlegen) zählt als hochgeladen
      if (error && !/exist|duplicate/i.test(error.message)) bildFehler = true
      else pfad = ziel
    }
  }
  pruefe(
    await client
      .from('feedback')
      .insert({
        id: n.id,
        art: n.art,
        titel: n.titel?.trim() || null,
        beschreibung: n.beschreibung.trim(),
        route: n.route,
        url: n.url,
        viewport: n.viewport,
        user_agent: n.user_agent,
        app_version: n.app_version,
        konsole: n.konsole,
        screenshot_path: pfad,
      })
      .select('id')
      .single(),
  )
  return { id: n.id, mitBild: pfad !== null, bildFehler }
}

export function useFeedbackSenden() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (n: FeedbackNeu) => sendeFeedback(n),
    onError: mutationFehler,
    onSettled: () => void qc.invalidateQueries({ queryKey: FEEDBACK_KEY }),
  })
}

export type FeedbackAenderung = { id: string; status?: FeedbackStatus; notiz?: string | null }

export async function aendereFeedback(a: FeedbackAenderung, client: Client = supabase): Promise<Feedback> {
  const patch: Database['crm']['Tables']['feedback']['Update'] = {}
  if (a.status) patch.status = a.status
  if (a.notiz !== undefined) patch.notiz = a.notiz?.trim() || null
  return pruefe(await client.from('feedback').update(patch).eq('id', a.id).select('*').single()) as Feedback
}

/** Status/Notiz ändern – optimistisch in der Liste, bei Fehler zurück (Toast über mutationFehler). */
export function useFeedbackAendern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: FeedbackAenderung) => aendereFeedback(a),
    onMutate: async (a) => {
      await qc.cancelQueries({ queryKey: FEEDBACK_KEY })
      const vorher = qc.getQueryData<Feedback[]>(FEEDBACK_KEY)
      qc.setQueryData<Feedback[]>(FEEDBACK_KEY, (alt) =>
        alt?.map((f) =>
          f.id === a.id
            ? {
                ...f,
                ...(a.status ? { status: a.status } : {}),
                ...(a.notiz !== undefined ? { notiz: a.notiz?.trim() || null } : {}),
              }
            : f,
        ),
      )
      return { vorher }
    },
    onError: (e, _a, ctx) => {
      if (ctx?.vorher) qc.setQueryData(FEEDBACK_KEY, ctx.vorher)
      mutationFehler(e)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: FEEDBACK_KEY }),
  })
}

/** Screenshot laden: Signed URL (2 min) → fetch → blob:-URL. `null` = kein Pfad; Fehler → `fehler = true`. */
export async function ladeBild(pfad: string, client: Client = supabase): Promise<Blob> {
  const { data, error } = await client.storage.from(FEEDBACK_BUCKET).createSignedUrl(pfad, SIGNED_URL_SEKUNDEN)
  if (error || !data?.signedUrl) throw error ?? new Error('Keine Signed URL')
  const antwort = await fetch(data.signedUrl)
  if (!antwort.ok) throw new Error(`Bild nicht geladen (${antwort.status})`)
  return antwort.blob()
}

export function useFeedbackBild(pfad: string | null | undefined): {
  url: string | null
  laedt: boolean
  fehler: boolean
} {
  const [zustand, setZustand] = useState<{ pfad: string | null; url: string | null; fehler: boolean }>({
    pfad: null,
    url: null,
    fehler: false,
  })
  useEffect(() => {
    if (!pfad) return
    let aktiv = true
    let url: string | null = null
    ladeBild(pfad)
      .then((blob) => {
        url = URL.createObjectURL(blob)
        if (aktiv) setZustand({ pfad, url, fehler: false })
        else URL.revokeObjectURL(url)
      })
      .catch(() => {
        if (aktiv) setZustand({ pfad, url: null, fehler: true })
      })
    return () => {
      aktiv = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [pfad])
  if (!pfad) return { url: null, laedt: false, fehler: false }
  const passend = zustand.pfad === pfad
  return { url: passend ? zustand.url : null, laedt: !passend, fehler: passend && zustand.fehler }
}

// ── Antworten von Claude: „gesehen“-Merkliste (localStorage, je Gerät) ──────────────────────────────────────
export const GESEHEN_KEY = 'crm.feedback.gesehen'
type Gesehen = Record<string, string>

export function liesGesehen(): Gesehen | null {
  try {
    const roh = globalThis.localStorage?.getItem(GESEHEN_KEY)
    if (!roh) return null
    const o = JSON.parse(roh) as unknown
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Gesehen) : null
  } catch {
    return null
  }
}
function schreibeGesehen(g: Gesehen): void {
  try {
    globalThis.localStorage?.setItem(GESEHEN_KEY, JSON.stringify(g))
  } catch {
    /* ohne Storage: Antwort-Toast kommt ggf. erneut */
  }
}
/** Antwort als gesehen merken (Detail geöffnet oder Toast gezeigt). */
export function markiereGesehen(id: string, antwortAt: string): void {
  schreibeGesehen({ ...(liesGesehen() ?? {}), [id]: antwortAt })
}
/** Eigene Meldungen mit Antwort, die auf diesem Gerät noch nicht gesehen wurde. */
export function ungeseheneAntworten(liste: readonly Feedback[], me: string, g: Gesehen | null): Feedback[] {
  return liste.filter((f) => f.member_id === me && !!f.antwort && !!f.antwort_at && g?.[f.id] !== f.antwort_at)
}
/** Erster Start auf diesem Gerät: alle vorhandenen Antworten still als gesehen merken (kein Toast-Schwall). */
export function gesehenInitialisieren(liste: readonly Feedback[]): void {
  if (liesGesehen()) return
  const g: Gesehen = {}
  for (const f of liste) if (f.antwort_at) g[f.id] = f.antwort_at
  schreibeGesehen(g)
}

// ── Realtime: eigener Kanal für crm.feedback (der Haupt-Kanal crm:sync gehört M0) ─────────────────────────
export const FEEDBACK_KANAL = 'crm:feedback'

/** Neue Antwort auf eine eigene Meldung? (RLS liefert bei UPDATE kein `old` – Vergleich gegen die Merkliste.) */
export function istNeueAntwort(neu: Partial<Feedback>, me: string, g: Gesehen | null): boolean {
  return (
    !!neu.id && neu.member_id === me && !!neu.antwort && !!neu.antwort_at && (g?.[neu.id] ?? null) !== neu.antwort_at
  )
}

export function useFeedbackRealtime(me: string | null, beiAntwort: (f: Feedback) => void): void {
  const qc = useQueryClient()
  const rueckruf = useRef(beiAntwort)
  useEffect(() => {
    rueckruf.current = beiAntwort
  })
  useEffect(() => {
    if (!me) return
    const kanal = supabase
      .channel(FEEDBACK_KANAL)
      .on(
        'postgres_changes',
        { event: '*', schema: 'crm', table: 'feedback' },
        (p: RealtimePostgresChangesPayload<Record<string, unknown>>) => verarbeite(qc, p, me, rueckruf.current),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(kanal)
    }
  }, [qc, me])
}

/** Exportiert für Tests: invalidiert die Liste und meldet neue Antworten auf eigene Meldungen. */
export function verarbeite(
  qc: QueryClient,
  p: Pick<RealtimePostgresChangesPayload<Record<string, unknown>>, 'eventType' | 'new'>,
  me: string,
  beiAntwort: (f: Feedback) => void,
): void {
  void qc.invalidateQueries({ queryKey: FEEDBACK_KEY })
  if (p.eventType === 'DELETE') return
  const neu = p.new as Partial<Feedback>
  if (istNeueAntwort(neu, me, liesGesehen())) {
    markiereGesehen(neu.id as string, neu.antwort_at as string)
    beiAntwort(neu as Feedback)
  }
}
