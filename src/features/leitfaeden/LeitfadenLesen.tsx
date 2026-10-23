// Lesefenster eines Leitfadens (23.10.2026, Mikes Sales Hub): Kategorie klein, Titel, Sterne zum Bewerten, der formatierte
// Text (Kundenantworten blau-kursiv), unten Löschen · Bearbeiten (LinkedIn/E-Mail zusätzlich Kopieren). Statistik, Vorschau mit
// Lead und alle Felder stehen weiter auf der Detailseite („Details & Statistik“).
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PFADE } from '@/app/pfade'
import { FormatText } from '@/components/FormatText'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { useTemplateLoeschen, useTemplateSave } from '@/data/templates'
import { ohneFormat } from '@/lib/leitfadenFormat'
import { kopieren } from '@/lib/zwischenablage'
import type { Template } from '@/types/domain'
import { Fenster } from '@/components/Fenster'
import { Sterne } from './Sterne'

export function LeitfadenLesen({
  t,
  oberzeile,
  nutzung,
  standard,
  verwendet,
  onBearbeiten,
  onClose,
}: {
  t: Template
  oberzeile: string
  nutzung: string | null
  standard: string | null
  verwendet: boolean
  onBearbeiten: () => void
  onClose: () => void
}) {
  const speichern = useTemplateSave()
  const loeschen = useTemplateLoeschen()
  const [frage, setFrage] = useState(false)
  const kopierbar = t.channel === 'linkedin' || t.channel === 'email'

  const bewerten = (rating: number | null) => speichern.mutate({ ...t, rating })
  const kopierenJetzt = async () => {
    const text = ohneFormat(t.channel === 'email' && t.subject ? `${t.subject}\n\n${t.body}` : t.body)
    const r = await kopieren(text)
    toast(r === 'ok' ? 'Kopiert – Platzhalter in [Klammern] noch ersetzen.' : 'Text markiert – ⌘C')
  }
  const entfernen = async () => {
    if (verwendet) {
      await speichern.mutateAsync({ ...t, active: false })
      toast('Deaktiviert – bleibt in der Historie, wird nicht mehr vorgeschlagen.')
    } else {
      await loeschen.mutateAsync(t.id)
      toast('Leitfaden gelöscht.')
      onClose()
    }
    setFrage(false)
  }

  return (
    <>
      <Fenster
        offen
        onOpenChange={(o) => !o && onClose()}
        oberzeile={oberzeile}
        titel={t.name}
        unterTitel={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Sterne wert={t.rating} onChange={bewerten} />
            {t.active === false ? <Chip ton="ended">inaktiv</Chip> : null}
            {standard ? <Chip ton="neutral">{standard}</Chip> : null}
            {nutzung ? <span className="text-ink-3 text-[12px]">{nutzung}</span> : null}
          </span>
        }
        fuss={
          <>
            <Button variante="danger" groesse="S" icon={Trash2} onClick={() => setFrage(true)}>
              {verwendet ? 'Deaktivieren' : 'Löschen'}
            </Button>
            <Link
              to={PFADE.leitfaden(t.id)}
              className="text-small text-ink-3 hover:text-ink underline-offset-2 hover:underline"
            >
              Details &amp; Statistik
            </Link>
            <span className="ml-auto flex gap-2">
              {kopierbar ? (
                <Button variante="secondary" icon={Copy} onClick={() => void kopierenJetzt()}>
                  Kopieren
                </Button>
              ) : null}
              <Button variante="primary" icon={Pencil} onClick={onBearbeiten}>
                Bearbeiten
              </Button>
            </span>
          </>
        }
      >
        {t.channel === 'email' && t.subject ? (
          <p className="text-ink-bright mb-3 text-[15px] font-medium">Betreff: {t.subject}</p>
        ) : null}
        {t.when_to_use ? <p className="text-small text-ink-3 mb-4">{t.when_to_use}</p> : null}
        <FormatText
          text={t.body}
          className="text-ink text-[15px] leading-[1.65]"
          platzhalter={(_name, roh, key) => (
            <span key={key} className="text-ink-2 italic">
              {roh}
            </span>
          )}
        />
      </Fenster>
      <Dialog
        offen={frage}
        onOpenChange={setFrage}
        titel={verwendet ? 'Leitfaden deaktivieren?' : 'Leitfaden löschen?'}
        text={
          verwendet
            ? 'Er wurde schon verwendet – damit die Statistik stimmt, wird er nur deaktiviert und nicht mehr vorgeschlagen.'
            : `„${t.name}“ wird endgültig gelöscht.`
        }
        primaer={{
          label: verwendet ? 'Deaktivieren' : 'Löschen',
          danger: true,
          onClick: () => void entfernen(),
          busy: speichern.isPending || loeschen.isPending,
        }}
      />
    </>
  )
}
