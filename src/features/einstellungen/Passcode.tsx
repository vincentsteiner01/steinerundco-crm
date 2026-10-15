// Einstellungen → Passcode (BAUPLAN § 3.9, ux § 3.10 Nr. 2, E-01): alt · neu ≥ 10 · Wiederholung · „Andere Geräte abmelden“ (an)
// → usePasscodeAendern (M0). Zurücksetzen der anderen Person ist v1.1 (E-02) – Button disabled mit Tooltip. „Überall abmelden“ mit Dialog.
import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button, Checkbox, Dialog, FormField, Input } from '@/components/ui'
import { useAndere } from '@/data'
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
    <FormField label={label} htmlFor={id} hinweis={hinweis}>
      <Input
        id={id}
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
    </FormField>
  )
}

export function Passcode() {
  const id = useId()
  const { aendern, laeuft, fehler } = usePasscodeAendern()
  const abmelden = useAuth((s) => s.abmelden)
  const andere = useAndere()
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

  const andererName = andere?.display_name ?? 'der anderen Person'

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
          <p className="text-small text-ink-3">
            Mindestens 10 Zeichen. Danach gilt nur noch der neue Passcode – auch auf dem Handy.
          </p>
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
            kbd="⌘↵"
            busy={laeuft}
            disabled={!geaendert}
            disabledGrund={geaendert ? undefined : 'Erst Passcode eingeben'}
          >
            Passcode ändern
          </Button>
        </div>
      </form>

      <Block
        titel={`Passcode von ${andere?.display_name ?? 'der anderen Person'} zurücksetzen`}
        beschreibung="Erzeugt einen Einmal-Passcode, der beim nächsten Login einen neuen verlangt."
      >
        <div>
          <Button disabled disabledGrund="Kommt in v1.1 – bis dahin: Lead fragen">
            Passcode von {andererName} zurücksetzen
          </Button>
        </div>
      </Block>

      <Block
        titel="Überall abmelden"
        beschreibung="Meldet alle Geräte ab, auf denen du angemeldet bist – auch die Akten-Sitzung desselben Kontos."
      >
        <div>
          <Button variante="danger" onClick={() => setDialogOffen(true)}>
            {ALLGEMEIN.ueberallAbmelden}
          </Button>
        </div>
      </Block>

      <Dialog
        offen={dialogOffen}
        onOpenChange={setDialogOffen}
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
