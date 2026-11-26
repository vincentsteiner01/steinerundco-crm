// Auswahl „Leitfaden“ (26.11.2026, Vincent: „beim Anlegen einer Karte anklicken können, welchen Leitfaden wir benutzt haben“) –
// für „Lead hinzufügen“ und das Lead-Blatt. Angeboten werden dieselben Leitfäden wie auf der Leitfäden-Seite (nicht archiviert,
// keine E-Mail-Vorlagen). Der zuletzt benutzte ist beim nächsten Anlegen vorgewählt: wer zwanzig Leute mit demselben Leitfaden
// anschreibt, klickt ihn einmal an.
import { Select, type SelectOption } from '@/components/ui/Select'
import { KEIN_LEITFADEN, type Vorlage } from './leitfaden'

type Props = {
  id: string
  leitfaeden: readonly Vorlage[]
  wert: string | null
  onChange: (id: string | null) => void
}

export function LeitfadenWahl({ id, leitfaeden, wert, onChange }: Props) {
  const optionen: SelectOption[] = [
    { value: '', label: KEIN_LEITFADEN },
    ...leitfaeden.map((t) => ({ value: t.id, label: t.name })),
  ]
  return (
    <Select
      id={id}
      // so hoch wie die Felder daneben (44 px); auf dem Telefon 16 px Schrift, sonst zoomt iOS beim Antippen hinein
      className="text-body h-11 max-md:text-[16px]"
      optionen={optionen}
      value={wert ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    />
  )
}
