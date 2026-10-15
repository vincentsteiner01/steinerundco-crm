// Feedback-Steuerung (in AppShell nachgeladen): ⌥F und das Fenster-Ereignis „crm:feedback“ öffnen den Dialog. Runde 2 (echte
// Daten): kein schwebender Knopf mehr – er lag über Zeit-Chips, KPI-Deltas und Kartentext. Der Einstieg sitzt jetzt in der
// Navigation (Sidebar „Feedback geben ⌥F“, Icon-Rail, Phone-Topbar; alle `data-tour="feedback"`), ⌥F und die Palette bleiben.
// Der Screenshot wird VOR dem Dialog aufgenommen; der Dialog trägt `data-feedback-ignorieren` und erscheint nie im Bild. Hier
// hängt auch der Realtime-Kanal für crm.feedback: Liste live, Toast „Claude hat geantwortet“ für eigene Meldungen (auch beim
// Start, wenn eine Antwort ungesehen ist).
import { createElement, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { PFADE } from '@/app/pfade'
import { sonnerToast, TOAST_MS } from '@/components/toast'
import {
  gesehenInitialisieren,
  liesGesehen,
  markiereGesehen,
  ungeseheneAntworten,
  useFeedbackListe,
  useFeedbackRealtime,
  type Feedback,
} from '@/data/feedback'
import { useAuth } from '@/features/auth/authStore'
import { nimmAuf } from './aufnahme'
import { sammleKontext, type FeedbackKontext } from './kontext'
import { FEEDBACK_EVENT, kurzTitel, TEXT } from './texte'

const FeedbackDialog = lazy(() => import('./FeedbackDialog').then((m) => ({ default: m.FeedbackDialog })))

type Zustand = { phase: 'zu' } | { phase: 'aufnahme' } | { phase: 'offen'; bild: Blob | null; kontext: FeedbackKontext }

/** Toast mit Aktion „Ansehen“ (toast.ts hat nur neutrale Toasts ohne Aktion – lokale Variante, gleiche Klassen). */
function toastMitAktion(text: string, onAnsehen: () => void): void {
  let id: string | number = 0
  id = sonnerToast.custom(
    () =>
      createElement(
        'div',
        { className: 'toast-brand', 'data-variante': 'neutral', role: 'status' },
        createElement('span', { className: 'toast-text' }, text),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              onAnsehen()
              sonnerToast.dismiss(id)
            },
            className:
              'toast-aktion border-line-strong text-ink text-small hover:bg-surface-hover ease-brand inline-flex h-7 items-center rounded-sm border px-2.5 font-medium leading-none transition-[background] duration-[var(--t-1)]',
          },
          TEXT.ansehen,
        ),
      ),
    { duration: TOAST_MS * 2 },
  )
}

export function FeedbackKnopf() {
  const [zustand, setZustand] = useState<Zustand>({ phase: 'zu' })
  const phaseRef = useRef<Zustand['phase']>('zu')
  const navigate = useNavigate()
  const me = useAuth((s) => (s.status === 'mitglied' ? (s.member?.user_id ?? null) : null))

  const oeffnen = useCallback(async () => {
    if (phaseRef.current !== 'zu') return
    phaseRef.current = 'aufnahme'
    // Kontext zuerst (Konsole, Seite) – dann das Bild, solange noch nichts vom Dialog zu sehen ist
    const kontext = sammleKontext()
    setZustand({ phase: 'aufnahme' })
    const bild = await nimmAuf()
    setZustand({ phase: 'offen', bild, kontext })
  }, [])

  useEffect(() => {
    const h = () => void oeffnen()
    window.addEventListener(FEEDBACK_EVENT, h)
    return () => window.removeEventListener(FEEDBACK_EVENT, h)
  }, [oeffnen])

  // Antworten von Claude: live (Realtime) und einmal beim Start (ungesehen auf diesem Gerät)
  const ansehen = useCallback((id?: string) => navigate(id ? `${PFADE.feedback}?id=${id}` : PFADE.feedback), [navigate])
  useFeedbackRealtime(me, (f: Feedback) => toastMitAktion(TEXT.antwortEine(kurzTitel(f)), () => ansehen(f.id)))
  const { data: liste } = useFeedbackListe(!!me)
  const startGeprueft = useRef(false)
  useEffect(() => {
    if (!liste || !me || startGeprueft.current) return
    startGeprueft.current = true
    gesehenInitialisieren(liste)
    const offen = ungeseheneAntworten(liste, me, liesGesehen())
    if (offen.length === 0) return
    for (const f of offen) markiereGesehen(f.id, f.antwort_at as string)
    const erste = offen[0] as Feedback
    if (offen.length === 1) toastMitAktion(TEXT.antwortEine(kurzTitel(erste)), () => ansehen(erste.id))
    else toastMitAktion(TEXT.antwortMehrere(offen.length), () => ansehen())
  }, [liste, me, ansehen])

  return (
    <>
      {zustand.phase === 'offen' ? (
        <Suspense fallback={null}>
          <FeedbackDialog
            bild={zustand.bild}
            kontext={zustand.kontext}
            onSchliessen={() => {
              phaseRef.current = 'zu'
              setZustand({ phase: 'zu' })
            }}
          />
        </Suspense>
      ) : null}
    </>
  )
}
