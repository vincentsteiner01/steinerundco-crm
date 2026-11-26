// „Lead hinzufügen“ (25.11.2026): Vorname, Nachname, LinkedIn-Link, Zugehörigkeit (voreingestellt: ich). Die Datenbank
// entscheidet (crm.board_karte_anlegen): neu · übernommen (Person war schon gespeichert) · schon da. Ihre deutschen Fehlertexte
// stehen direkt am Formular. Die Anrede wird aus dem Vornamen geraten und lässt sich im Lead-Blatt korrigieren.
// Der Link wird schon hier geprüft und auf den Profil-Teil gekürzt (lib/url linkedinProfilLink).
import { useId, useState, type KeyboardEvent } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Dialog } from '@/components/ui/Dialog'
import { Feld } from '@/components/ui/Feld'
import { Input } from '@/components/ui/Input'
import { useKarteAnlegen, type KarteAngelegt } from '@/data/board'
import { fehlerMeldung } from '@/data/errors'
import { anzeigeName } from '@/lib/mitglied'
import { linkedinProfilLink } from '@/lib/url'
import { anredeAusVorname } from '@/lib/vornamen'
import type { Member } from '@/types/domain'
import { KEIN_PROFIL_LINK } from './blatt'
import { Wahl } from './Wahl'

const NAME_FEHLT = 'Bitte einen Namen eingeben'

type Props = {
  offen: boolean
  onOpenChange: (offen: boolean) => void
  /** Mitglieder in Anzeige-Reihenfolge (Vincent · Mike). */
  members: readonly Member[]
  meId: string | null
  /** Antwort der Datenbank und der eingegebene Name (für „… liegt schon in …“). */
  onAngelegt: (ergebnis: KarteAngelegt, name: string) => void
}

export function LeadHinzufuegen({ offen, onOpenChange, members, meId, onAngelegt }: Props) {
  const id = useId()
  const anlegen = useKarteAnlegen()
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [link, setLink] = useState('')
  const [owner, setOwner] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const ownerWert = owner ?? meId

  const schliessen = (o: boolean) => {
    onOpenChange(o)
    if (o) return
    setVorname('')
    setNachname('')
    setLink('')
    setOwner(null)
    setFehler(null)
  }

  const hinzufuegen = async () => {
    if (anlegen.isPending) return
    if (!vorname.trim() && !nachname.trim()) return setFehler(NAME_FEHLT)
    // Der Link ist freiwillig. Steht einer da, geht nur der saubere Profil-Link an die Datenbank – ohne Anhang wie
    // /overlay/contact-info/ (LinkedIn mit offener „Kontaktinfo“). Alles andere steht sofort am Feld, ohne Anfrage.
    const profil = link.trim() ? linkedinProfilLink(link) : ''
    if (profil === null) return setFehler(KEIN_PROFIL_LINK)
    setFehler(null)
    try {
      const ergebnis = await anlegen.mutateAsync({
        vorname,
        nachname,
        linkedinUrl: profil,
        ownerId: ownerWert,
        anrede: anredeAusVorname(vorname),
      })
      onAngelegt(ergebnis, [vorname.trim(), nachname.trim()].filter(Boolean).join(' '))
      schliessen(false)
    } catch (e) {
      setFehler(fehlerMeldung(e).meldung)
    }
  }

  // Der Fehler steht an dem Feld, das er meint; alles andere (Sperrliste, Widerspruch, Netz) unter dem Formular
  const amNamen = fehler !== null && /Namen/.test(fehler)
  const amLink = fehler !== null && /LinkedIn/.test(fehler)
  const mitEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    void hinzufuegen()
  }

  return (
    <Dialog
      gross
      offen={offen}
      onOpenChange={schliessen}
      titel="Lead hinzufügen"
      primaer={{ label: 'Hinzufügen', onClick: () => void hinzufuegen(), busy: anlegen.isPending }}
      kinder={
        <>
          <div className="grid grid-cols-2 gap-3">
            <Feld label="Vorname" htmlFor={`${id}-vorname`}>
              <Input
                id={`${id}-vorname`}
                groesse="L"
                autoFocus
                autoComplete="off"
                value={vorname}
                onChange={(e) => setVorname(e.target.value)}
                onKeyDown={mitEnter}
                aria-invalid={amNamen || undefined}
              />
            </Feld>
            <Feld label="Nachname" htmlFor={`${id}-nachname`}>
              <Input
                id={`${id}-nachname`}
                groesse="L"
                autoComplete="off"
                value={nachname}
                onChange={(e) => setNachname(e.target.value)}
                onKeyDown={mitEnter}
                aria-invalid={amNamen || undefined}
              />
            </Feld>
            {amNamen ? (
              <p className="text-small text-danger col-span-2" role="alert">
                {fehler}
              </p>
            ) : null}
          </div>
          <Feld label="LinkedIn-Link" htmlFor={`${id}-link`}>
            <Input
              id={`${id}-link`}
              groesse="L"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="linkedin.com/in/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={mitEnter}
              fehler={amLink ? (fehler ?? undefined) : undefined}
            />
          </Feld>
          <Feld label="Zugehörigkeit">
            <Wahl
              ariaLabel="Zugehörigkeit"
              wert={ownerWert}
              onChange={setOwner}
              optionen={members
                .filter((m): m is Member & { id: string } => !!m.id)
                .map((m) => ({
                  key: m.id,
                  label: anzeigeName(m, m.id),
                  icon: (
                    <span aria-hidden className="inline-flex">
                      <Avatar member={m} groesse={22} />
                    </span>
                  ),
                }))}
            />
          </Feld>
          {fehler !== null && !amNamen && !amLink ? (
            <p className="text-small text-danger" role="alert">
              {fehler}
            </p>
          ) : null}
        </>
      }
    />
  )
}
