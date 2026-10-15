// BAUPLAN § 3.8 ImportSeite: Stepper 1 Quelle · 2 Spalten · 3 Prüfen · 4 Fertig (DESIGN-SYSTEM § 5.17); mobil „Am Desktop bearbeiten“.
// Tastatur (Assistent): Enter weiter, Esc zurück – nicht, wenn ein Button/Feld/Dialog den Fokus hat.
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { useMeId } from '@/data'
import { Button, SeitenKopf } from '@/components/ui'
import { istEingabe, useHotkeys } from '@/lib/keyboard'
import { useIstTelefon } from '@/lib/useMediaQuery'
import { AmDesktop, Stepper } from './components/Assistent'
import { istPresetKey } from './presets'
import { mappingVollstaendig } from './presets/allgemein'
import { SchrittFertig } from './SchrittFertig'
import { SchrittPruefen } from './SchrittPruefen'
import { SchrittQuelle } from './SchrittQuelle'
import { SchrittSpalten } from './SchrittSpalten'
import { useImport } from './useImport'

function fokusBlockiert(): boolean {
  const el = document.activeElement
  if (!el || el === document.body) return false
  if (istEingabe(el)) return true
  return !!el.closest('button, a, [role="dialog"], [role="radio"], select')
}

export function Component() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const me = useMeId()
  const api = useImport(me)
  const mobil = useIstTelefon() // < 768 px (ux § 7, E28): „Am Desktop bearbeiten“
  const { state, info } = api

  // ?preset= vorbelegen (einmalig)
  const presetParam = params.get('preset')
  useEffect(() => {
    if (istPresetKey(presetParam) && state.preset === null) api.waehlePreset(presetParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetParam])

  useHotkeys(
    'global',
    {
      enter: (e) => {
        if (fokusBlockiert()) return
        e.preventDefault()
        api.weiter()
      },
      escape: () => {
        if (fokusBlockiert()) return
        api.zurueck()
      },
    },
    [api.weiter, api.zurueck],
  )

  const weiterLabel =
    state.schritt === 1
      ? 'Weiter'
      : state.schritt === 2
        ? info?.dryRun
          ? 'Prüfen (Dry-Run)'
          : 'Prüfen'
        : 'Importieren'
  const weiterMoeglich =
    !state.laeuft &&
    ((state.schritt === 1 && !!state.quelle) ||
      (state.schritt === 2 && (state.preset !== 'allgemein' || mappingVollstaendig(state.mapping))) ||
      (state.schritt === 3 && (state.preset !== 'crm_tabelle' || api.crmOhneZustaendig.length === 0)))
  const weiterGrund =
    state.schritt === 1 && !state.quelle
      ? 'Erst Preset und Datei wählen'
      : state.schritt === 2 && state.preset === 'allgemein' && !mappingVollstaendig(state.mapping)
        ? 'Ordne mindestens Name oder LinkedIn-URL zu'
        : state.schritt === 3 && state.preset === 'crm_tabelle' && api.crmOhneZustaendig.length > 0
          ? `${api.crmOhneZustaendig.length} Zeilen ohne Zuständigen`
          : undefined

  return (
    <>
      <SeitenKopf
        titel="Import"
        kontext={info ? info.name : undefined}
        rechts={
          <Button variante="quiet" kbd="⌘⇧O" onClick={() => navigate(PFADE.schnellimport(PFADE.import))}>
            Schnellimport
          </Button>
        }
      />
      {mobil ? (
        <AmDesktop
          kinder={
            <div className="mt-5">
              <Button variante="primary" onClick={() => navigate(PFADE.schnellimport(PFADE.heute))}>
                Schnellimport
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-2">
          <Stepper aktiv={state.schritt} onSchritt={api.geheZu} />
          {state.schritt === 1 ? <SchrittQuelle api={api} /> : null}
          {state.schritt === 2 ? <SchrittSpalten api={api} /> : null}
          {state.schritt === 3 ? <SchrittPruefen api={api} /> : null}
          {state.schritt === 4 ? <SchrittFertig api={api} /> : null}
          {state.fehler && state.schritt !== 1 ? (
            <p role="alert" className="text-small text-danger mt-2">
              {state.fehler}
            </p>
          ) : null}
          {state.schritt < 4 ? (
            <div className="hairline-t mt-6 flex flex-wrap items-center gap-2 pt-4">
              {state.schritt > 1 ? (
                <Button variante="quiet" icon={ArrowLeft} kbd="Esc" onClick={api.zurueck} disabled={state.laeuft}>
                  Zurück
                </Button>
              ) : null}
              <span className="flex-1" />
              <Button
                variante="primary"
                icon={ArrowRight}
                kbd="↵"
                onClick={api.weiter}
                busy={state.laeuft}
                disabled={!weiterMoeglich}
                disabledGrund={weiterGrund}
              >
                {weiterLabel}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}
