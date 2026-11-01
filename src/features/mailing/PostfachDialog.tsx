// „Postfach verbinden“ (01.11.2026): Anbieter wählen → Adresse, Name, App-Passwort → speichern (Passwort direkt in den Supabase
// Vault) → der Mail-Motor testet sofort Anmeldung und Ordner. Prüf-Postfächer (GMX, WEB.DE, T-Online) brauchen nur IMAP.
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Segment } from '@/components/ui/Segment'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useMembers, useMeId } from '@/data'
import { usePostfachSpeichern, usePostfachTesten, type PostfachEingabe, type TestErgebnis } from '@/data/mailing'
import { fehlerMeldung } from '@/data/errors'
import { ANBIETER, anbieterVorlage, type Anbieter } from './logik'
import { Warum } from './Teile'

type Form = {
  anbieter: Anbieter
  rolle: 'versand' | 'saat'
  adresse: string
  name: string
  memberId: string
  passwort: string
  smtpHost: string
  imapHost: string
  signatur: string
  schonAlt: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function PostfachDialog({
  offen,
  onClose,
  rolle = 'versand',
}: {
  offen: boolean
  onClose: () => void
  rolle?: 'versand' | 'saat'
}) {
  const meId = useMeId()
  const { data: members } = useMembers()
  const speichern = usePostfachSpeichern()
  const testen = usePostfachTesten()
  const [f, setF] = useState<Form>(() => ({
    anbieter: rolle === 'saat' ? 'gmx' : 'google',
    rolle,
    adresse: '',
    name: '',
    memberId: meId ?? '',
    passwort: '',
    smtpHost: '',
    imapHost: '',
    signatur: '',
    schonAlt: false,
  }))
  const [fehler, setFehler] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<TestErgebnis | null>(null)
  const vorlage = anbieterVorlage(f.anbieter)
  const versand = f.rolle === 'versand' && !vorlage.nurPruef
  const setze = <K extends keyof Form>(k: K, v: Form[K]) => {
    setFehler(null)
    setF((x) => ({ ...x, [k]: v }))
  }

  const pruefen = (): string | null => {
    if (vorlage.spaeter) return vorlage.spaeter
    if (!EMAIL.test(f.adresse.trim())) return 'Bitte eine vollständige E-Mail-Adresse eingeben.'
    if (versand && f.name.trim().length < 2)
      return 'Bitte den Absendernamen eingeben (eine echte Person, z. B. „Vincent Steiner“).'
    if (f.passwort.trim().length < 4) return 'Bitte das Passwort eingeben.'
    if (f.anbieter === 'sonstige' && (!f.imapHost.trim() || (versand && !f.smtpHost.trim())))
      return 'Bitte die Server-Adressen eintragen.'
    return null
  }

  const los = async () => {
    const problem = pruefen()
    if (problem) return setFehler(problem)
    const daten: PostfachEingabe = {
      adresse: f.adresse.trim().toLowerCase(),
      absender_name: (f.name.trim() || f.adresse.split('@')[0]) ?? '',
      member_id: f.memberId || null,
      anbieter: f.anbieter,
      rolle: versand ? 'versand' : 'saat',
      imap_host: f.anbieter === 'sonstige' ? f.imapHost.trim().toLowerCase() : vorlage.imap,
      smtp_host: versand
        ? f.anbieter === 'sonstige'
          ? f.smtpHost.trim().toLowerCase()
          : (vorlage.smtp?.host ?? null)
        : null,
      smtp_port: versand ? (vorlage.smtp?.port ?? 465) : null,
      smtp_sicherheit: versand ? (vorlage.smtp?.sicherheit ?? 'ssl') : null,
      signatur: versand && f.signatur.trim() ? f.signatur.trim() : null,
      hochlauf: !f.schonAlt,
    }
    try {
      const pf = await speichern.mutateAsync({ daten, passwort: f.passwort })
      const t = await testen.mutateAsync(pf.id)
      setErgebnis(t)
      if (t.ok) {
        toast(`${daten.adresse} ist verbunden`)
        onClose()
      }
    } catch (e) {
      setFehler(fehlerMeldung(e).meldung)
    }
  }

  const anbieterOptionen = ANBIETER.filter((a) => (f.rolle === 'saat' ? !a.spaeter : !a.nurPruef)).map((a) => ({
    value: a.key,
    label: a.spaeter ? `${a.label} (kommt später)` : a.label,
  }))

  return (
    <Dialog
      offen={offen}
      onOpenChange={(o) => !o && onClose()}
      titel={f.rolle === 'saat' ? 'Prüf-Postfach verbinden' : 'Postfach verbinden'}
      text={
        f.rolle === 'saat'
          ? 'Ein eigenes Postfach bei GMX, WEB.DE, T-Online oder Gmail. Der Motor schaut dort nur nach, ob Test-Mails im Posteingang oder im Spam landen – er öffnet, klickt und verschiebt nichts.'
          : 'Das Postfach einer echten Person auf eurer Versand-Domain. Das Passwort wird verschlüsselt im Tresor gespeichert und ist danach nur für den Mail-Motor lesbar.'
      }
      primaer={{
        label: ergebnis && !ergebnis.ok ? 'Erneut versuchen' : 'Verbinden und testen',
        onClick: () => void los(),
        busy: speichern.isPending || testen.isPending,
      }}
      className="max-h-[90dvh] overflow-y-auto"
      kinder={
        <div className="grid gap-4">
          <Segment
            ariaLabel="Art des Postfachs"
            wert={f.rolle}
            onChange={(r) => {
              setze('rolle', r)
              setze('anbieter', r === 'saat' ? 'gmx' : 'google')
            }}
            optionen={[
              { key: 'versand', label: 'Versand-Postfach' },
              { key: 'saat', label: 'Prüf-Postfach' },
            ]}
          />
          <FormField label="Anbieter" htmlFor="pf-anbieter">
            <Select
              id="pf-anbieter"
              value={f.anbieter}
              onChange={(e) => setze('anbieter', e.target.value as Anbieter)}
              optionen={anbieterOptionen}
            />
          </FormField>
          {vorlage.spaeter ? <p className="text-small text-overdue">{vorlage.spaeter}</p> : null}
          <FormField label="E-Mail-Adresse" htmlFor="pf-adresse" pflicht>
            <Input
              id="pf-adresse"
              type="email"
              autoComplete="off"
              value={f.adresse}
              onChange={(e) => setze('adresse', e.target.value)}
              placeholder="vincent@eure-versanddomain.de"
            />
          </FormField>
          {versand ? (
            <>
              <FormField
                label="Absendername"
                htmlFor="pf-name"
                pflicht
                hinweis="So steht es beim Empfänger – immer eine echte Person, keine Fantasienamen."
              >
                <Input
                  id="pf-name"
                  value={f.name}
                  onChange={(e) => setze('name', e.target.value)}
                  placeholder="Vincent Steiner"
                />
              </FormField>
              <FormField label="Gehört zu" htmlFor="pf-person">
                <Select
                  id="pf-person"
                  value={f.memberId}
                  onChange={(e) => setze('memberId', e.target.value)}
                  optionen={(members ?? []).map((m) => ({ value: m.id ?? '', label: m.display_name ?? m.email ?? '' }))}
                />
              </FormField>
            </>
          ) : null}
          {f.anbieter === 'sonstige' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="IMAP-Server (Port 993)" htmlFor="pf-imap">
                <Input
                  id="pf-imap"
                  value={f.imapHost}
                  onChange={(e) => setze('imapHost', e.target.value)}
                  placeholder="imap.anbieter.de"
                />
              </FormField>
              {versand ? (
                <FormField label="SMTP-Server (Port 465)" htmlFor="pf-smtp">
                  <Input
                    id="pf-smtp"
                    value={f.smtpHost}
                    onChange={(e) => setze('smtpHost', e.target.value)}
                    placeholder="smtp.anbieter.de"
                  />
                </FormField>
              ) : null}
            </div>
          ) : null}
          {!vorlage.spaeter ? (
            <FormField label={f.anbieter === 'google' ? 'App-Passwort' : 'Passwort'} htmlFor="pf-pass" pflicht>
              <Input
                id="pf-pass"
                type="password"
                autoComplete="new-password"
                value={f.passwort}
                onChange={(e) => setze('passwort', e.target.value)}
              />
              <p className="text-small text-ink-2 mt-1.5">{vorlage.passwort}</p>
              {vorlage.link ? (
                <a
                  href={vorlage.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-small text-signal mt-1 inline-flex items-center gap-1 hover:underline"
                >
                  App-Passwort erzeugen <ExternalLink size={12} aria-hidden />
                </a>
              ) : null}
            </FormField>
          ) : null}
          {versand ? (
            <>
              <FormField
                label="Signatur"
                htmlFor="pf-signatur"
                hinweis="Name, Firma mit Rechtsform, Anschrift, Telefon, Website – Pflichtangaben wie im Geschäftsbrief. Kein Logo-Bild."
              >
                <Textarea
                  id="pf-signatur"
                  rows={4}
                  value={f.signatur}
                  onChange={(e) => setze('signatur', e.target.value)}
                />
              </FormField>
              <div>
                <Checkbox
                  checked={f.schonAlt}
                  onChange={(e) => setze('schonAlt', e.target.checked)}
                  label="Dieses Postfach schreibt schon seit Monaten echte Mails"
                />
                <Warum>
                  Neue Postfächer starten mit höchstens 10 Mails am Tag und steigern sich über sechs Wochen, solange
                  kaum etwas unzustellbar ist. Das ersetzt das „Aufwärmen“ von Instantly: künstliche Aufwärm-Netze
                  stehen seit September 2026 auf Blocklisten. Nur ein lange genutztes Postfach darf gleich mit dem
                  vollen Tageslimit starten.
                </Warum>
              </div>
            </>
          ) : null}
          {fehler ? (
            <p className="text-small text-danger" role="alert">
              {fehler}
            </p>
          ) : null}
          {ergebnis && !ergebnis.ok ? (
            <div className="bg-danger-tint text-small text-danger rounded-sm px-3 py-2" role="alert">
              <p className="font-medium">Die Verbindung hat nicht geklappt.</p>
              <p className="mt-1">{ergebnis.fehler}</p>
              <p className="text-ink mt-1.5">
                {f.anbieter === 'google'
                  ? 'Meist liegt es am Passwort: Es muss ein App-Passwort sein (16 Zeichen), nicht das normale Google-Passwort.'
                  : 'Prüfe Adresse und Passwort – und ob der Zugriff per IMAP beim Anbieter erlaubt ist.'}
              </p>
            </div>
          ) : null}
        </div>
      }
    />
  )
}
