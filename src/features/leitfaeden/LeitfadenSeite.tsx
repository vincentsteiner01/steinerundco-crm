// BAUPLAN § 3.7 LeitfadenSeite.tsx – Vollseite /leitfaeden/:id (Palette, Deep-Link, Mobil). `:id = neu` legt an (`?kanal=`).
// Query: ?vorschau=<lead_id>. Mobil (< 1024 px): nur lesen + Kopieren, Editor sagt „Am Desktop bearbeiten“ (E28).
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { PFADE } from '@/app/pfade'
import { Button } from '@/components/ui/Button'
import { SeitenKopf } from '@/components/ui/SeitenKopf'
import { useTemplate } from '@/data/templates'
import { KANAL_LABEL } from '@/texte/de'
import { MEDIEN, useMediaQuery } from '@/lib/useMediaQuery'
import { NEU } from './befehle'
import { kanalAusParam } from './helfer'
import { LeitfadenDetail } from './LeitfadenDetail'
import { phaseDef } from './phasen'

export function Component() {
  const { id = NEU } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const neu = id === NEU
  const kanalNeu = kanalAusParam(params.get('kanal'))
  const vorschau = params.get('vorschau')
  const desktop = useMediaQuery(MEDIEN.desktop)
  const { data: vorlage } = useTemplate(neu ? null : id)
  const kanal = vorlage?.channel ?? kanalNeu
  const kontext = vorlage ? `${KANAL_LABEL[kanal]} · ${phaseDef(kanal, vorlage.phase).label}` : KANAL_LABEL[kanal]

  return (
    <>
      <SeitenKopf
        titel={neu ? 'Neuer Leitfaden' : (vorlage?.name ?? 'Leitfaden')}
        kontext={kontext}
        rechts={
          <Button variante="quiet" icon={ArrowLeft} onClick={() => navigate(`${PFADE.leitfaeden}?kanal=${kanal}`)}>
            Alle Leitfäden
          </Button>
        }
      />
      <div className="max-w-[880px]">
        <LeitfadenDetail
          key={id}
          id={id}
          kanalNeu={kanalNeu}
          vorschauLeadId={vorschau}
          nurLesen={!desktop}
          onVorschauLead={(lid) => {
            const p = new URLSearchParams(params)
            if (lid) p.set('vorschau', lid)
            else p.delete('vorschau')
            setParams(p, { replace: true })
          }}
          onAngelegt={(neueId) => navigate(PFADE.leitfaden(neueId), { replace: true })}
        />
      </div>
    </>
  )
}
