// Verbindungen → „LinkedIn-Benachrichtigungen aus Gmail“: Status (Script läuft? letzter Eingang, Zahlen der letzten 7 Tage,
// Schlüssel, eigenes LinkedIn-Profil) und die Einrichtung in fünf Schritten (Inhalt von tools/apps-script/ANLEITUNG.md als
// UI-Text). Schritt 5 zeigt den ersten Eingang live (Kanal crm:eingang).
import { ExternalLink } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Button, Input, Skeleton, cn } from '@/components/ui'
import { toast } from '@/components/toast'
import { profilAusMember, useAndere, useMe, useMeId, useProfilSpeichern } from '@/data'
import { fmtDatumKurz, fmtZeit } from '@/lib/format'
import { anzeigeName } from '@/lib/mitglied'
import { linkedinAnzeige, normalizeLinkedinUrl } from '@/lib/url'
import {
  artLabel,
  istStatus,
  scriptZustand,
  STATUS_LABEL,
  useEingangStatus,
  zaehle,
  type EingangStatus,
} from '@/features/eingang/public'
import { SchluesselErzeugen, SchluesselWiderrufen } from './Schluessel'
import { SKRIPT, SKRIPT_EIGENSCHAFT, SKRIPT_LABEL, SKRIPT_NAME, SKRIPT_URL, SKRIPT_ZEILEN } from './konstanten'
import { Abschnitt, Code, KopierKnopf, Schritt, Text } from './Teile'

const WOCHE: { key: EingangStatus; label: string }[] = [
  { key: 'verarbeitet', label: 'verarbeitet' },
  { key: 'unbekannt', label: 'unbekannt' },
  { key: 'ignoriert', label: 'ignoriert' },
  { key: 'fehler', label: 'Fehler' },
]

function Zeile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[148px_minmax(0,1fr)] sm:items-baseline sm:gap-3">
      <span className="label">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Eigenes LinkedIn-Profil (member_profiles.linkedin_url): die Erkennung hält es nie für einen Lead. */
function ProfilZeile() {
  const id = useId()
  const me = useMe()
  const speichern = useProfilSpeichern()
  const [bearbeiten, setBearbeiten] = useState(false)
  const [wert, setWert] = useState('')
  const [fehler, setFehler] = useState<string | undefined>()
  const aktuell = me?.linkedin_url ?? null

  const absenden = (e: FormEvent) => {
    e.preventDefault()
    if (!me) return
    const roh = wert.trim()
    const norm = roh ? normalizeLinkedinUrl(roh) : null
    if (roh && !norm) {
      setFehler('Profil-Adresse nicht erkannt – zum Beispiel linkedin.com/in/dein-name.')
      return
    }
    speichern.mutate(
      { ...profilAusMember(me), linkedin_url: norm ? `https://www.${norm}/` : null },
      {
        onSuccess: () => {
          toast(norm ? 'LinkedIn-Profil gespeichert.' : 'LinkedIn-Profil entfernt.')
          setBearbeiten(false)
        },
      },
    )
  }

  if (!bearbeiten) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {aktuell ? (
          <span className="mono text-ink">{linkedinAnzeige(aktuell, 40)}</span>
        ) : (
          <span className="text-ui text-ink-2">nicht eingetragen</span>
        )}
        <Button
          variante="quiet"
          groesse="S"
          onClick={() => {
            setWert(aktuell ?? '')
            setFehler(undefined)
            setBearbeiten(true)
          }}
        >
          {aktuell ? 'Ändern' : 'Eintragen'}
        </Button>
        <p className="text-small text-ink-3 w-full">
          LinkedIn verlinkt in jeder Mail auch dein Profil – kennt das CRM es, hält es dich nie für einen Lead.
        </p>
      </div>
    )
  }
  return (
    <form onSubmit={absenden} className="grid gap-2" aria-label="Dein LinkedIn-Profil">
      <label htmlFor={`${id}-p`} className="sr-only">
        Dein LinkedIn-Profil
      </label>
      <Input
        id={`${id}-p`}
        autoFocus
        value={wert}
        placeholder="linkedin.com/in/dein-name"
        onChange={(e) => {
          setWert(e.target.value)
          setFehler(undefined)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            setBearbeiten(false)
          }
        }}
        fehler={fehler}
      />
      <div className="flex gap-1.5">
        <Button type="submit" variante="primary" groesse="S" busy={speichern.isPending}>
          Speichern
        </Button>
        <Button variante="quiet" groesse="S" onClick={() => setBearbeiten(false)}>
          Abbrechen
        </Button>
      </div>
    </form>
  )
}

function StatusKarte() {
  const meId = useMeId()
  const { data, isLoading } = useEingangStatus(meId)
  if (isLoading || !data) return <Skeleton zeilen={4} />
  const zustand = scriptZustand(data.schluessel)
  const woche = zaehle(data.woche)
  const letzter = data.letzter
  return (
    <div className="rule bg-surface-raised grid gap-3.5 rounded-md p-4" aria-label="Status">
      <Zeile label="Status">
        <span
          className={cn(
            'text-ui',
            zustand.art === 'aktiv' ? 'text-ink' : zustand.art === 'still' ? 'text-overdue' : 'text-ink-2',
          )}
          data-zustand={zustand.art}
        >
          {zustand.text}
        </span>
        {zustand.art === 'aus' ? (
          <p className="text-small text-ink-3">Folge den fünf Schritten unten – das dauert etwa zehn Minuten.</p>
        ) : zustand.art === 'still' ? (
          <p className="text-small text-ink-3">
            Das Script meldet sich nur bei neuen LinkedIn-Mails. Prüfe auf script.google.com unter „Ausführungen“, ob
            alle 5 Minuten ein Lauf „sync“ steht.
          </p>
        ) : null}
      </Zeile>
      <Zeile label="Letzte 7 Tage">
        <span className="text-small text-ink-2 flex flex-wrap gap-x-1.5 gap-y-0.5">
          {[...WOCHE, ...(woche.neu > 0 ? [{ key: 'neu' as const, label: 'offen' }] : [])].map((w, i) => (
            <span key={w.key} className={cn(w.key === 'fehler' && woche.fehler > 0 && 'text-danger')}>
              {i > 0 ? <span className="text-ink-3 mr-1.5">·</span> : null}
              <span className={cn('tnum font-mono', w.key === 'fehler' && woche.fehler > 0 ? '' : 'text-ink')}>
                {woche[w.key]}
              </span>{' '}
              {w.label}
            </span>
          ))}
        </span>
      </Zeile>
      <Zeile label="Letzter Eingang">
        {letzter ? (
          <span className="text-ui text-ink-2">
            <span className="mono text-ink">
              {fmtDatumKurz(letzter.created_at)} {fmtZeit(letzter.created_at)}
            </span>{' '}
            · {artLabel(letzter.art)} · {istStatus(letzter.status) ? STATUS_LABEL[letzter.status] : letzter.status}
          </span>
        ) : (
          <span className="text-ui text-ink-2">noch keiner</span>
        )}
      </Zeile>
      <Zeile label="Schlüssel">
        {data.schluessel ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-ui text-ink">aktiv</span>
            <SchluesselWiderrufen me={meId} />
          </span>
        ) : (
          <span className="text-ui text-ink-2">keiner – Schritt 3</span>
        )}
      </Zeile>
      <Zeile label="Dein LinkedIn-Profil">
        <ProfilZeile />
      </Zeile>
    </div>
  )
}

/** Schritt 5: der erste (bzw. jüngste) Eingang der angemeldeten Person – live. */
function ErsterEingang({ onEingang }: { onEingang: () => void }) {
  const meId = useMeId()
  const { data } = useEingangStatus(meId)
  const letzter = data?.letzter ?? null
  return (
    <div
      className="border-line-strong grid gap-1.5 rounded-md border border-dashed p-3.5"
      aria-live="polite"
      data-angekommen={letzter ? 'ja' : 'nein'}
    >
      {letzter ? (
        <>
          <span className="label">Angekommen</span>
          <span className="text-ui text-ink">
            <span className="mono">
              {fmtDatumKurz(letzter.created_at)} {fmtZeit(letzter.created_at)}
            </span>{' '}
            · {artLabel(letzter.art)}
            {letzter.absender_name ? ` von ${letzter.absender_name}` : ''} ·{' '}
            {istStatus(letzter.status) ? STATUS_LABEL[letzter.status] : letzter.status}
          </span>
          <div>
            <Button variante="quiet" groesse="S" onClick={onEingang}>
              Zum Eingang
            </Button>
          </div>
        </>
      ) : (
        <>
          <span className="label">Wartet auf den ersten Eingang</span>
          <span className="text-table text-ink-2">
            Sobald dein Script die erste LinkedIn-Mail überträgt, erscheint sie hier – ohne Neuladen.
          </span>
        </>
      )}
    </div>
  )
}

export function GmailAbschnitt({ onEingang }: { onEingang: () => void }) {
  const meId = useMeId()
  const andere = anzeigeName(useAndere(), 'Die andere Person')
  const { data } = useEingangStatus(meId)

  return (
    <Abschnitt
      id="verbindungen-gmail"
      titel="LinkedIn-Benachrichtigungen aus Gmail"
      beschreibung="LinkedIn schickt dir für neue Nachrichten und angenommene Einladungen eine Mail. Ein kleines Google-Script in deinem eigenen Gmail schickt nur diese Mails alle 5 Minuten ans CRM – Annahmen und Antworten stehen dann von selbst am Lead, laufende Sequenzen starten oder stoppen."
    >
      <StatusKarte />

      <ol className="grid" aria-label="Einrichtung in fünf Schritten">
        <Schritt nr={1} titel="Script kopieren">
          <Text>
            Das Script liest nur Mails von linkedin.com, schickt Betreff, Absender, Datum und Text ans CRM und setzt das
            Gmail-Label „{SKRIPT_LABEL}“. Es sendet, löscht und klickt nichts – auch nicht auf LinkedIn.
          </Text>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <KopierKnopf text={SKRIPT} meldung={`Script kopiert – ${SKRIPT_ZEILEN} Zeilen.`}>
              Script kopieren
            </KopierKnopf>
            <span className="mono-sm text-ink-3">{SKRIPT_ZEILEN} Zeilen</span>
          </div>
          <details className="group">
            <summary className="text-small text-ink-2 hover:text-ink cursor-pointer select-none">Code ansehen</summary>
            <pre className="border-line bg-surface-hover text-ink-2 mt-2 max-h-72 overflow-auto rounded-sm border p-3 font-mono text-[11.5px] leading-[1.45]">
              {SKRIPT}
            </pre>
          </details>
        </Schritt>

        <Schritt nr={2} titel="Auf script.google.com ein neues Projekt anlegen">
          <Text>
            Melde dich mit dem Google-Konto an, in dem die LinkedIn-Mails ankommen (rechts oben prüfen). Links oben
            „Neues Projekt“, dann oben auf „Unbenanntes Projekt“ klicken und es „{SKRIPT_NAME}“ nennen. In{' '}
            <Code>Code.gs</Code> alles markieren (⌘A), löschen, das Script einfügen (⌘V) und speichern (⌘S).
          </Text>
          <div>
            <a
              href={SKRIPT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border-line-strong text-ui text-ink hover:bg-surface-hover ease-brand inline-flex h-9 items-center gap-2 rounded-sm border px-3.5 font-medium transition-[background] duration-[var(--t-1)]"
            >
              script.google.com öffnen
              <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
            </a>
          </div>
        </Schritt>

        <Schritt nr={3} titel="Schlüssel erzeugen und als Skripteigenschaft eintragen">
          <Text>
            Der Schlüssel verbindet dein Script mit deinem CRM-Konto. Er steht nicht im Code, sondern in den
            Projekteinstellungen: links das Zahnrad „Projekteinstellungen“ → ganz unten „Skripteigenschaft hinzufügen“ →
            Eigenschaft <Code>{SKRIPT_EIGENSCHAFT}</Code>, Wert: dein Schlüssel → „Skripteigenschaften speichern“.
          </Text>
          <div className="flex flex-wrap gap-1.5">
            <KopierKnopf text={SKRIPT_EIGENSCHAFT} groesse="S">
              Name {SKRIPT_EIGENSCHAFT} kopieren
            </KopierKnopf>
          </div>
          <SchluesselErzeugen me={meId} aktiv={data?.schluessel ?? null} />
        </Schritt>

        <Schritt nr={4} titel="„einrichten“ ausführen und Google erlauben">
          <Text>
            Links „Editor“ (Symbol &lt; &gt;), oben im Auswahlfeld neben „Debuggen“ die Funktion <Code>einrichten</Code>{' '}
            wählen, dann „Ausführen“. Google fragt beim ersten Mal nach Erlaubnis: „Berechtigungen überprüfen“ → dein
            Konto wählen.
          </Text>
          <Text>
            Dann erscheint „Google hat diese App nicht überprüft“. Das kommt bei jedem selbst geschriebenen Script –
            Google prüft nur Apps, die andere Leute benutzen; hier hast nur du Zugriff. Klicke auf „Erweitert“ und „Zu{' '}
            {SKRIPT_NAME} wechseln (unsicher)“, hake alle Kästchen an und klicke „Zulassen“.
          </Text>
          <Text>
            „Gmail-Nachrichten lesen, verfassen, senden und löschen“ klingt nach viel – Google kennt für Gmail-Scripts
            nur diese eine Berechtigung. Was das Script tatsächlich tut, steht im Code (Schritt 1): Es sucht nur{' '}
            <Code>from:linkedin.com</Code> der letzten 3 Tage und setzt ein Label.
          </Text>
        </Schritt>

        <Schritt nr={5} titel="Prüfen">
          <Text>
            Im Ausführungsprotokoll steht „Eingerichtet: läuft ab jetzt alle 5 Minuten.“, in Gmail erscheint links das
            Label „{SKRIPT_LABEL}“. Der erste Lauf holt die LinkedIn-Mails der letzten 3 Tage; was du schon mit{' '}
            <Code>A</Code> erfasst oder beantwortet hast, bucht das CRM nicht noch einmal.
          </Text>
          <ErsterEingang onEingang={onEingang} />
        </Schritt>
      </ol>

      <Text klein>
        {andere} richtet das in seinem eigenen Gmail ein – angemeldet als {andere}, mit seinem eigenen Schlüssel.
        Annahmen und Antworten aus seinem Postfach werden in seinem Namen verbucht.
      </Text>

      <details className="group">
        <summary className="text-small text-ink-2 hover:text-ink cursor-pointer select-none">
          Anhalten und Datenschutz
        </summary>
        <ul className="text-small text-ink-2 mt-2 grid max-w-[64ch] list-disc gap-1.5 pl-4">
          <li>
            Pausieren: auf script.google.com die Funktion <Code>stoppen</Code> ausführen. Wieder starten mit{' '}
            <Code>einrichten</Code>.
          </li>
          <li>Sperren: oben unter „Schlüssel“ widerrufen – das Script kann danach nichts mehr übertragen.</li>
          <li>
            Google-Zugriff ganz entziehen: myaccount.google.com/permissions → „{SKRIPT_NAME}“ → „Zugriff entfernen“.
          </li>
          <li>
            Übertragen werden nur Mails von linkedin.com: Betreff, Absender, Datum, der Anfang des Textes und
            LinkedIn-Links ohne Tracking. Gespeichert werden höchstens 2000 Zeichen Nachrichtentext – nie die ganze
            Mail.
          </li>
          <li>Werbung, Job-Mails und Einladungen von Personen außerhalb des CRM löscht das CRM nach 30 Tagen.</li>
          <li>
            Der Schlüssel liegt nur in deinen Skripteigenschaften; das CRM kennt nur einen nicht umkehrbaren Abdruck.
          </li>
        </ul>
      </details>
    </Abschnitt>
  )
}
