// Einführungstour – Steuerung (in der AppShell eingehängt, eigenes kleines Chunk; die Tour-UI lädt erst beim Start nach).
// Startet einmal je Person automatisch, sobald sie auf Heute ist und `preferences.onboarding_v1` fehlt; jederzeit neu über das
// Fenster-Ereignis `crm:tour` (Hilfe „Tour erneut starten“, „Zeig’s mir“, Palette). Gespeichert wird nur das Ende der Einführung:
// Fertig → `done`, Überspringen → `skipped` (nie ein `done` überschreiben). Mini-Touren schreiben nichts.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { profilAusMember, useMe, useProfilSpeichern } from '@/data/members'
import { istTourKey, TOUR_EVENT, type TourKey } from './ereignis'
import { mitOnboarding, onboardingStatus, statusNachEnde } from './praeferenz'
import type { TourEnde } from './TourOverlay'
import { anzeigeName } from '@/lib/mitglied'

const TourOverlay = lazy(() => import('./TourOverlay'))

/** Kurze Ruhe nach dem Laden von Heute, damit die Tour nicht über eine halb geladene Seite fällt. */
export const AUTOSTART_MS = 1200

export function OnboardingTour() {
  const me = useMe()
  const { pathname } = useLocation()
  const speichern = useProfilSpeichern()
  const paletteOffen = useUiStore((s) => s.paletteOffen)
  const hilfeOffen = useUiStore((s) => s.hilfeOffen)
  const [aktiv, setAktiv] = useState<{ tour: TourKey; lauf: number } | null>(null)
  const geprueft = useRef(false)
  const lauf = useRef(0)
  // undefined = Profil lädt noch; null = Einführung nie gesehen
  const status = me ? onboardingStatus(me.preferences) : undefined

  const starten = useCallback((tour: TourKey) => {
    geprueft.current = true
    lauf.current += 1
    setAktiv({ tour, lauf: lauf.current })
  }, [])

  useEffect(() => {
    const h = (e: Event) => {
      const t = (e as CustomEvent<{ tour?: unknown } | undefined>).detail?.tour
      starten(istTourKey(t) ? t : 'onboarding')
    }
    window.addEventListener(TOUR_EVENT, h)
    return () => window.removeEventListener(TOUR_EVENT, h)
  }, [starten])

  useEffect(() => {
    if (aktiv || geprueft.current || status === undefined) return
    if (status !== null) {
      geprueft.current = true
      return
    }
    if (pathname !== PFADE.heute || paletteOffen || hilfeOffen) return
    const t = window.setTimeout(() => {
      if (!geprueft.current) starten('onboarding')
    }, AUTOSTART_MS)
    return () => window.clearTimeout(t)
  }, [aktiv, status, pathname, paletteOffen, hilfeOffen, starten])

  const ende = useCallback(
    (art: TourEnde) => {
      if (aktiv?.tour === 'onboarding' && me) {
        const neu = statusNachEnde(onboardingStatus(me.preferences), art)
        if (neu) speichern.mutate({ ...profilAusMember(me), preferences: mitOnboarding(me.preferences, neu) })
      }
      setAktiv(null)
    },
    [aktiv, me, speichern],
  )

  if (!aktiv) return null
  return (
    <Suspense fallback={null}>
      <TourOverlay key={aktiv.lauf} tour={aktiv.tour} name={anzeigeName(me)} onEnde={ende} />
    </Suspense>
  )
}
