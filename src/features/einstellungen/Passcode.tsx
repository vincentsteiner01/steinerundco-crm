// Einstellungen → Passcode (BAUPLAN § 3.9, ux § 3.10 Nr. 2, E-01): alt · neu ≥ 10 · Wiederholung · „Andere Geräte abmelden“ (an)
// → usePasscodeAendern (M0). „Überall abmelden“ mit Dialog. Neustart 25.11.2026: der nie gebaute Knopf „Passcode der anderen
// Person zurücksetzen“ und die Tastenhinweise sind raus.
import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { Feld } from '@/components/ui/Feld'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth/authStore'
import { usePasscodeAendern, type PasscodeEingabe } from '@/features/auth/usePasscodeAendern'
import { ALLGEMEIN, DIALOG } from '@/texte/de'
import { Block } from './components/Formular'

const LEER: PasscodeEingabe = { aktuell: '', neu: '', wiederholung: '', andereAbmelden: true }

function PasscodeFeld({
  id,
  label,
  wert,
  onChange,
  fehler,
  autoComplete,
  hinweis,
}: {
  id: string
  label: string
  wert: string
  onChange: (v: string) => void
  fehler?: string
  autoComplete: 'current-password' | 'new-password'
  hinweis?: string
}) {
  const [sichtbar, setSichtbar] = useState(false)
  return (
    <Feld label={label} htmlFor={id} hinweis={fehler ? undefined : hinweis}>
      <Input
        id={id}
        groesse="L"
        type={sichtbar ? 'text' : 'password'}
        mono
        value={wert}
        onChange={(e) => onChange(e.target.value)}
        fehler={fehler}
        autoComplete={autoComplete}
        spellCheck={false}
        className="text-[15px] tracking-[0.3em]"
        rechts={
          <Button
            variante="icon"
            className="h-7 w-7"
            aria-label={sichtbar ? 'Passcode verbergen' : 'Passcode anzeigen'}
            aria-pressed={sichtbar}
            onClick={() => setSichtbar((s) => !s)}
          >
            {sichtbar ? (
              <EyeOff size={16} strokeWidth={1.75} aria-hidden />
            ) : (
              <Eye size={16} strokeWidth={1.75} aria-hidden />
            )}
          </Button>
        }
      />
    </Feld>
  )
}

export function Passcode() {
  const id = useId()
  const { aendern, laeuft, fehler } = usePasscodeAendern()
  const abmelden = useAuth((s) => s.abmelden)
  const [eingabe, setEingabe] = useState<PasscodeEingabe>(LEER)
  const [dialogOffen, setDialogOffen] = useState(false)
  const [abmeldenLaeuft, setAbmeldenLaeuft] = useState(false)

  const geaendert = eingabe.aktuell !== '' || eingabe.neu !== '' || eingabe.wiederholung !== ''

  const absenden = async () => {
    const ok = await aendern(eingabe)
    if (ok) setEingabe(LEER)
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void absenden()
  }
  const tasten = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void absenden()
    }
  }

  const ueberallAbmelden = async () => {
    setAbmeldenLaeuft(true)
    try {
      await abmelden(true)
    } finally {
      setAbmeldenLaeuft(false)
      setDialogOffen(false)
    }
  }

  return (
    <div className="grid">
      <form
        onSubmit={onSubmit}
        onKeyDown={tasten}
        aria-label="Passcode ändern"
        className="grid max-w-[560px] gap-4 pb-7"
      >
        <div className="grid gap-1">
          <h3 className="text-h3 text-ink-bright">Passcode ändern</h3>
          {/* „Mindestens 10 Zeichen.“ steht einmal: als Hinweis unter „Neuer Passcode“ */}
          <p className="text-small text-ink-3">Danach gilt nur noch der neue Passcode – auch auf dem Handy.</p>
        </div>
        <PasscodeFeld
          id={`${id}-aktuell`}
          label="Aktueller Passcode"
          wert={eingabe.aktuell}
          onChange={(v) => setEingabe((e) => ({ ...e, aktuell: v }))}
          fehler={fehler?.aktuell}
          autoComplete="current-password"
        />
        <PasscodeFeld
          id={`${id}-neu`}
          label="Neuer Passcode"
          wert={eingabe.neu}
          onChange={(v) => setEingabe((e) => ({ ...e, neu: v }))}
          fehler={fehler?.neu}
          autoComplete="new-password"
          hinweis={ALLGEMEIN.passcodeZuKurz}
        />
        <PasscodeFeld
          id={`${id}-wdh`}
          label="Neuen Passcode wiederholen"
          wert={eingabe.wiederholung}
          onChange={(v) => setEingabe((e) => ({ ...e, wiederholung: v }))}
          fehler={fehler?.wiederholung}
          autoComplete="new-password"
        />
        <Checkbox
          label="Andere Geräte abmelden"
          checked={eingabe.andereAbmelden ?? true}
          onChange={(e) => setEingabe((x) => ({ ...x, andereAbmelden: e.target.checked }))}
        />
        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            variante="primary"
            groesse="L"
            busy={laeuft}
            disabled={!geaendert}
            disabledGrund={geaendert ? undefined : 'Erst Passcode eingeben'}
          >
            Passcode ändern
          </Button>
        </div>
      </form>

      <Block
        titel="Überall abmelden"
        beschreibung="Meldet alle Geräte ab, auf denen du angemeldet bist – auch die Akten-Sitzung desselben Kontos."
      >
        <div>
          <Button variante="danger" groesse="L" className="-ml-4" onClick={() => setDialogOffen(true)}>
            {ALLGEMEIN.ueberallAbmelden}
          </Button>
        </div>
      </Block>

      <Dialog
        offen={dialogOffen}
        onOpenChange={setDialogOffen}
        gross
        titel={ALLGEMEIN.ueberallAbmelden}
        text={DIALOG.ueberallAbmelden.text}
        primaer={{
          label: DIALOG.ueberallAbmelden.primaer,
          onClick: () => void ueberallAbmelden(),
          danger: true,
          busy: abmeldenLaeuft,
        }}
      />
    </div>
  )
}
