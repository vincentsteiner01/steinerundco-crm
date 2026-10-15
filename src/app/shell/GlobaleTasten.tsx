import { useNavigate, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useUiStore } from '@/app/uiStore'
import { fehlerSchliessen, hatFehlerToast, retryAusfuehren, undoAusfuehren } from '@/components/toast'
import { istEingabe, useHotkeys } from '@/lib/keyboard'

/** Globale Tasten (BAUPLAN § 3.1.8, Anhang A): ⌘K · / · ? · G-Akkorde · ⌥N · ⌘⇧O · Z · R · Esc. */
export function GlobaleTasten() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const ui = useUiStore()

  useHotkeys(
    'global',
    {
      'mod+k': () => ui.setPaletteOffen(!ui.paletteOffen),
      '?': () => ui.setHilfeOffen(true),
      '/': () => {
        const feld = document.querySelector<HTMLElement>('[data-suche]')
        if (feld) feld.focus()
        else ui.setPaletteOffen(true)
      },
      'g h': () => navigate(PFADE.heute),
      'g l': () => navigate(PFADE.leads),
      'g p': () => navigate(PFADE.pipeline),
      'g t': () => navigate(PFADE.telefon),
      'g m': () => navigate(PFADE.email),
      'g k': () => navigate(PFADE.kpis),
      'g f': () => navigate(PFADE.leitfaeden),
      'g i': () => navigate(PFADE.import),
      'g e': () => navigate(PFADE.einstellungen()),
      'alt+n': () => navigate(PFADE.leadNeu),
      'mod+shift+o': () => navigate(PFADE.schnellimport(window.location.pathname + window.location.search)),
      z: () => void undoAusfuehren(),
      r: (e) => {
        if (hatFehlerToast()) {
          e.preventDefault()
          retryAusfuehren()
        }
      },
      escape: (e) => {
        // eine Ebene je Druck: Fehler-Toast → Palette/Hilfe → Feld verlassen → Peek
        if (fehlerSchliessen()) return
        if (ui.paletteOffen) return ui.setPaletteOffen(false)
        if (ui.hilfeOffen) return ui.setHilfeOffen(false)
        // Aus einem Feld heraus verlässt Esc nur das Feld (lib/keyboard blurt) – sonst schloss ein Esc im Notizfeld den Peek samt
        // ungespeichertem Entwurf, ein Esc in der Leads-Suche den offenen Peek (ux § 5.1, Review)
        if (istEingabe(e.target instanceof Element ? e.target : null)) return
        if (params.get('lead')) {
          const p = new URLSearchParams(params)
          p.delete('lead')
          setParams(p, { replace: true })
        }
      },
    },
    [ui.paletteOffen, ui.hilfeOffen, params.toString()],
  )
  return null
}
