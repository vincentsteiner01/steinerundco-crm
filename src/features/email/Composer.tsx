// BAUPLAN § 3.5 `Composer.tsx` / DESIGN-SYSTEM § 5.14 / ux § 3.6.2: Empfänger, Von, Erlaubnis-Badge (nicht ausblendbar),
// Vorlage-Select (nur passende Grundlage; transaktional immer), Betreff, Text mit Platzhaltern, Pflichtbausteine (nicht
// editierbar), Zeichenzähler (≤ 1 400 für den Compose-Link), Aktionen; Rückkehr-Prompt „Mail an … gesendet? Ja ↵ · Nein“.
import { Mail, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { WiderspruchErfassen } from '@/components/aktionen'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { HinweisKarte } from '@/components/ui/HinweisKarte'
import { Input } from '@/components/ui/Input'
import { Kbd } from '@/components/ui/Kbd'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/components/ui/cn'
import { VorlageWaehlen } from '@/features/leitfaeden/public'
import { SequenzStartenMenue, SequenzStatus } from '@/features/sequenzen/public'
import { useHotkeys } from '@/lib/keyboard'
import { fmtZahl } from '@/lib/format'
import { PLATZHALTER } from '@/lib/platzhalter'
import { ErlaubnisBadge } from './ErlaubnisBadge'
import { ErlaubnisErfassen } from './ErlaubnisErfassen'
import { BODY_MAX, gmailSucheUrl } from './gmail'
import { useComposer, type ComposerParams } from './useComposer'

export type ComposerProps = ComposerParams & {
  /** Dialog „Erlaubnis erfassen“ sofort öffnen (Palette-Befehl). */
  erlaubnisOffen?: boolean
  /** Dialog „Widerspruch erfassen“ sofort öffnen (Palette-Befehl). */
  widerspruchOffen?: boolean
}

/** Manuelle Platzhalter (§ 3.1.9a): Pflichtfelder über dem Text. */
const MANUELL = new Set(PLATZHALTER.filter((p) => p.quelle === 'manuell' || p.quelle === 'termin').map((p) => p.name))
const MEHRZEILIG = new Set(['Mehrwert-Absatz', 'Nächster Schritt', 'Reaktion', 'Grund', 'Einwand'])

export function Composer(props: ComposerProps) {
  const c = useComposer(props)
  const id = useId()
  const vorlageRef = useRef<HTMLSelectElement | null>(null)
  const [vorschau, setVorschau] = useState(false)
  const [kopiert, setKopiert] = useState<'betreff' | 'text' | null>(null)
  const [erlaubnisOffen, setErlaubnisOffen] = useState(!!props.erlaubnisOffen)
  const [widerspruchOffen, setWiderspruchOffen] = useState(!!props.widerspruchOffen)
  const [hinweisAus, setHinweisAus] = useState(false)

  // M-02: erster Klick zeigt die Warnung und macht aus dem Button „Trotzdem öffnen“, der zweite öffnet.
  const gmailLabel = c.trotzdem && c.gate.warnung ? 'Trotzdem öffnen' : 'In Gmail öffnen'

  useHotkeys(
    'formular',
    {
      'mod+enter': () => {
        if (c.status === 'bestaetigen') void c.gesendetJa()
        else void c.inGmailOeffnen()
      },
      'mod+shift+e': () => vorlageRef.current?.focus(),
    },
    [c.status, c.inGmailOeffnen, c.gesendetJa],
  )

  const kopierenMit = async (was: 'betreff' | 'text') => {
    const r = await c.kopieren(was)
    if (r === 'ok') {
      setKopiert(was)
      window.setTimeout(() => setKopiert(null), 2000)
    }
  }

  if (c.laedt || !c.lead) return <Skeleton zeilen={6} sofort />
  const lead = c.lead
  const gesperrt = !!c.sperrGrund
  const offenManuell = c.offen.filter((n) => MANUELL.has(n))
  const anredeOffen = c.offen.includes('Anrede')
  const sonstigeOffen = c.offen.filter((n) => !MANUELL.has(n) && n !== 'Anrede')

  return (
    <div className="grid gap-5" data-testid="composer" data-status={c.status}>
      {c.status === 'bestaetigen' ? (
        <GesendetPrompt name={c.anredeName} busy={c.busy} onJa={() => void c.gesendetJa()} onNein={c.gesendetNein} />
      ) : null}

      {/* Kopf: Empfänger · Von · Erlaubnis-Badge */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
        <FormField
          label="An"
          htmlFor={`${id}-an`}
          hinweis={
            c.empfaenger && !c.adresseVomLead
              ? 'Adresse weicht vom Lead ab – nur Adressen, die die Person selbst genannt hat.'
              : undefined
          }
          fehler={c.empfaenger && !c.empfaengerGueltig ? 'Das ist keine E-Mail-Adresse.' : undefined}
        >
          <Input
            id={`${id}-an`}
            type="email"
            mono
            value={c.empfaenger}
            placeholder="Adresse fehlt – über „Erlaubnis erfassen“ eintragen"
            onChange={(e) => c.empfaengerSetzen(e.target.value)}
          />
        </FormField>
        {/* Labels oben bündig mit der ersten Zeile – umbrechende Erlaubnis-Zeile zog sie sonst in die Mitte (Sichtprüfung) */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5">
          <span className="label flex min-h-8 items-center">Von</span>
          <span className="text-ink-2 tnum flex min-h-8 items-center font-mono text-[13px]" data-testid="von">
            {c.me?.email_address ?? '–'}
          </span>
          <span className="label flex min-h-8 items-center">Erlaubnis</span>
          <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <ErlaubnisBadge lead={lead} />
            <ErlaubnisErfassen
              leadId={lead.id}
              offen={erlaubnisOffen}
              onOpenChange={setErlaubnisOffen}
              trigger={
                <Button variante="quiet" groesse="S">
                  Erlaubnis erfassen
                </Button>
              }
            />
            <WiderspruchErfassen
              leadId={lead.id}
              umfang="email"
              offen={widerspruchOffen}
              onOpenChange={setWiderspruchOffen}
              trigger={
                <Button variante="quiet" groesse="S" disabled={lead.do_not_contact}>
                  Widerspruch erfassen
                </Button>
              }
            />
          </div>
          <span className="label flex min-h-8 items-center">Sequenz</span>
          <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <SequenzStatus leadId={lead.id} kanal="email" />
            <SequenzStartenMenue leadId={lead.id} kanal="email" />
          </div>
        </div>
        {c.gate.nachfassZaehler > 0 ? (
          <p className="text-small text-ink-3">
            Nachfass-Mails unter dieser Erlaubnis:{' '}
            <span className="tnum font-mono">
              {c.gate.nachfassZaehler}/{c.settings?.email?.max_followups_per_consent ?? 3}
            </span>
          </p>
        ) : null}
      </div>

      {c.gate.warnungText && c.gate.erlaubt ? (
        <p
          role="note"
          className="border-line-strong text-ui text-overdue rounded-md border px-3.5 py-2.5"
          data-testid="gate-warnung"
        >
          {c.trotzdem ? 'Erlaubnis älter als 12 Monate – du öffnest trotzdem.' : c.gate.warnungText}
        </p>
      ) : null}
      {gesperrt ? (
        <p className="text-small text-danger" role="status" data-testid="gate-grund">
          {c.sperrGrund}
        </p>
      ) : null}
      {c.heuteGesendet >= 30 && !hinweisAus ? (
        <HinweisKarte
          text={`Heute schon ${c.heuteGesendet} Mails bestätigt – praktisches Limit 30–50 neue Empfänger pro Tag.`}
          onAusblenden={() => setHinweisAus(true)}
          className="mb-0"
        />
      ) : null}

      {/* Vorlage · Betreff */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
        <FormField
          label="Vorlage"
          htmlFor={`${id}-vorlage`}
          hinweis={
            c.transaktional
              ? 'Transaktions-Vorlage: kein Widerspruchssatz, keine Produktabsätze.'
              : c.vorlagen.length === 0
                ? 'Keine Vorlage passt zur Grundlage – erst Erlaubnis erfassen.'
                : undefined
          }
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Select
                id={`${id}-vorlage`}
                ref={vorlageRef}
                value={c.vorlage?.id ?? ''}
                platzhalter={c.vorlagen.length ? undefined : 'Keine passende Vorlage'}
                onChange={(e) => c.vorlageWaehlen(e.target.value)}
                optionen={c.vorlagen.map((t) => ({
                  value: t.id,
                  label: t.phase === 'transaktional' ? `${t.name} · transaktional` : t.name,
                }))}
              />
            </div>
            <VorlageWaehlen
              kanal="email"
              aktuellId={c.vorlage?.id}
              onSelect={(t) => c.vorlageWaehlen(t.id)}
              trigger={
                <Button variante="quiet" kbd="⌘⇧E">
                  Wechseln
                </Button>
              }
            />
          </div>
        </FormField>
        <FormField
          label="Betreff"
          htmlFor={`${id}-betreff`}
          hinweis={
            c.thread.length ? `Folgemail im Thread (${c.thread.length} gesendet) – Betreff mit „Re:“.` : undefined
          }
        >
          <Input id={`${id}-betreff`} value={c.betreff} onChange={(e) => c.betreffSetzen(e.target.value)} />
        </FormField>
      </div>

      {/* Offene Platzhalter als Pflichtfelder (M-04) */}
      {anredeOffen ? (
        <FormField label="Anrede" hinweis="Einmal wählen – wird am Lead gespeichert.">
          <div className="flex gap-1.5">
            <Button groesse="S" onClick={() => c.anredeSetzen('herr')}>
              Herr
            </Button>
            <Button groesse="S" onClick={() => c.anredeSetzen('frau')}>
              Frau
            </Button>
          </div>
        </FormField>
      ) : null}
      {offenManuell.length ? (
        <div className="grid gap-3" data-testid="pflichtfelder">
          {offenManuell.map((name) =>
            MEHRZEILIG.has(name) ? (
              <FormField key={name} label={`[${name}]`} pflicht htmlFor={`${id}-ph-${name}`}>
                <Textarea
                  id={`${id}-ph-${name}`}
                  value={c.werte[name] ?? ''}
                  onChange={(e) => c.wertSetzen(name, e.target.value)}
                  placeholder={`${name} eintragen`}
                  className="min-h-16"
                />
              </FormField>
            ) : (
              <FormField key={name} label={`[${name}]`} pflicht htmlFor={`${id}-ph-${name}`}>
                <Input
                  id={`${id}-ph-${name}`}
                  value={c.werte[name] ?? ''}
                  onChange={(e) => c.wertSetzen(name, e.target.value)}
                  placeholder={`${name} eintragen`}
                />
              </FormField>
            ),
          )}
        </div>
      ) : null}
      {sonstigeOffen.length ? (
        <p className="text-small text-overdue" data-testid="offen-automatisch">
          Offen aus den Lead-Daten: {sonstigeOffen.map((n) => `[${n}]`).join(', ')} – im Text ersetzen oder am Lead
          ergänzen.
        </p>
      ) : null}

      {/* Text */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label className="label" htmlFor={`${id}-text`}>
            Text
          </label>
          <div className="flex items-center gap-2.5">
            <span className="text-small text-ink-3 flex items-center gap-1">
              <Kbd>[</Kbd> Platzhalter
            </span>
            <Button variante="quiet" groesse="S" onClick={() => setVorschau((v) => !v)} aria-pressed={vorschau}>
              {vorschau ? 'Bearbeiten' : 'Vorschau'}
            </Button>
          </div>
        </div>
        {vorschau ? (
          <pre
            className="bg-surface-hover border-line text-body text-ink max-w-[64ch] rounded-sm border px-3 py-2.5 whitespace-pre-wrap"
            data-testid="vorschau"
          >
            {c.bodyVoll}
          </pre>
        ) : (
          <TextMitPlatzhaltern id={`${id}-text`} wert={c.text} onChange={c.textSetzen} />
        )}
        <div
          className={cn(
            'text-small border-line bg-surface text-ink-3 rounded-sm border px-3 py-2.5 whitespace-pre-wrap',
          )}
          aria-label="Pflichtbausteine (nicht editierbar)"
          data-testid="bausteine"
        >
          <span className="label mb-1.5 block">Pflichtbausteine</span>
          {c.bausteine.text ? c.bausteine.text : 'Signatur fehlt – unter Einstellungen → Profil eintragen.'}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-small text-ink-3">
            {c.transaktional
              ? 'Transaktional: ohne Widerspruchssatz.'
              : 'Widerspruchssatz und Signatur werden angehängt.'}
          </span>
          <span
            className={cn('tnum font-mono text-[12.5px]', c.zuLang ? 'text-overdue' : 'text-ink-3')}
            data-testid="zeichen"
          >
            {fmtZahl(c.zeichen)} / {fmtZahl(BODY_MAX)}
          </span>
        </div>
        {c.zuLang ? <p className="text-small text-overdue">Zu lang für den Gmail-Link – Kopieren nutzen.</p> : null}
      </div>

      {/* Aktionen */}
      <div className="border-line flex flex-wrap items-center gap-1.5 border-t pt-4">
        <Button
          variante="primary"
          kbd="⌘↵"
          icon={Mail}
          disabled={!!c.gmailSperrGrund || c.busy}
          disabledGrund={c.gmailSperrGrund ?? undefined}
          busy={c.busy}
          onClick={() => void c.inGmailOeffnen()}
        >
          {gmailLabel}
        </Button>
        <Button
          disabled={gesperrt || c.busy}
          disabledGrund={c.sperrGrund ?? undefined}
          copied={kopiert === 'text'}
          onClick={() => void kopierenMit('text')}
        >
          Text kopieren
        </Button>
        <Button
          variante="quiet"
          disabled={gesperrt}
          disabledGrund={c.sperrGrund ?? undefined}
          copied={kopiert === 'betreff'}
          onClick={() => void kopierenMit('betreff')}
        >
          Betreff kopieren
        </Button>
        <Button
          variante="quiet"
          disabled={gesperrt || c.busy}
          disabledGrund={c.sperrGrund ?? undefined}
          onClick={() => void c.mailtoOeffnen()}
        >
          mailto: öffnen
        </Button>
        <span className="flex-1" />
        {c.thread.length && c.me?.email_address ? (
          <a
            className="text-small text-ink-2 hover:text-ink inline-flex items-center gap-1.5"
            href={gmailSucheUrl({ email: c.me.email_address, subject: c.betreff, to: c.empfaenger })}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Search size={14} strokeWidth={1.75} aria-hidden /> In Gmail suchen
          </a>
        ) : null}
        <Button variante="quiet" onClick={() => void c.entwurfSpeichern()} disabled={c.busy}>
          Entwurf speichern
        </Button>
        <Button variante="quiet" onClick={() => void c.verwerfen()} disabled={c.busy}>
          Verwerfen
        </Button>
      </div>
      {c.entwurfId ? (
        <p className="text-ink-3 tnum font-mono text-[11.5px]">
          Entwurf gespeichert ·{' '}
          {c.status === 'geoeffnet' ? 'in Gmail geöffnet – nach der Rückkehr bestätigen' : 'Tab Entwürfe'}
        </p>
      ) : null}
    </div>
  )
}

/** Inline-Prompt nach Fensterrückkehr (ux § 3.6.2, M-06/M-10): „Mail an Herrn Lindner gesendet? Ja ↵ · Nein“. */
function GesendetPrompt({
  name,
  busy,
  onJa,
  onNein,
}: {
  name: string
  busy: boolean
  onJa: () => void
  onNein: () => void
}) {
  const jaRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    jaRef.current?.focus()
  }, [])
  return (
    <div
      role="alertdialog"
      aria-label={`Mail an ${name} gesendet?`}
      className="bg-surface-raised border-line-strong flex flex-wrap items-center gap-3 rounded-md border px-4 py-3"
      data-testid="gesendet-prompt"
    >
      <span className="text-ui text-ink flex-1">Mail an {name} gesendet?</span>
      <Button ref={jaRef} variante="primary" groesse="S" kbd="↵" busy={busy} onClick={onJa}>
        Ja
      </Button>
      <Button variante="quiet" groesse="S" onClick={onNein} disabled={busy}>
        Nein
      </Button>
    </div>
  )
}

/** Textarea mit `[`-Autovervollständigung der Platzhalter (ux § 5.5). */
function TextMitPlatzhaltern({ id, wert, onChange }: { id: string; wert: string; onChange: (t: string) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [vorschlag, setVorschlag] = useState<{ start: number; filter: string; cursor: number } | null>(null)
  const treffer = vorschlag
    ? PLATZHALTER.filter((p) => p.name.toLowerCase().startsWith(vorschlag.filter.toLowerCase())).slice(0, 8)
    : []

  const pruefe = (text: string, pos: number) => {
    const davor = text.slice(0, pos)
    const m = /\[([^\]\n]{0,30})$/.exec(davor)
    setVorschlag(m ? { start: pos - (m[1]?.length ?? 0) - 1, filter: m[1] ?? '', cursor: 0 } : null)
  }

  const einfuegen = (name: string) => {
    if (!vorschlag) return
    const el = ref.current
    const pos = el?.selectionStart ?? wert.length
    const neu = `${wert.slice(0, vorschlag.start)}[${name}]${wert.slice(pos)}`
    onChange(neu)
    setVorschlag(null)
    const ziel = vorschlag.start + name.length + 2
    window.setTimeout(() => el?.setSelectionRange(ziel, ziel), 0)
  }

  const tasten = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!vorschlag || treffer.length === 0) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = (vorschlag.cursor + (e.key === 'ArrowDown' ? 1 : -1) + treffer.length) % treffer.length
      setVorschlag({ ...vorschlag, cursor: n })
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const t = treffer[vorschlag.cursor] ?? treffer[0]
      if (t) einfuegen(t.name)
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setVorschlag(null)
    }
  }

  return (
    <div className="relative">
      <Textarea
        id={id}
        ref={ref}
        value={wert}
        className="text-body min-h-[180px] leading-[1.55]"
        onChange={(e) => {
          onChange(e.target.value)
          pruefe(e.target.value, e.target.selectionStart)
        }}
        onKeyDown={tasten}
        onBlur={() => window.setTimeout(() => setVorschlag(null), 120)}
      />
      {vorschlag && treffer.length ? (
        <ul
          role="listbox"
          aria-label="Platzhalter"
          className="bg-surface-raised shadow-float absolute right-3 bottom-3 z-10 min-w-[200px] rounded-md p-1.5"
        >
          {treffer.map((t, i) => (
            <li key={t.name}>
              <button
                type="button"
                role="option"
                aria-selected={i === vorschlag.cursor}
                className={cn(
                  'text-ui hover:bg-surface-hover flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-left',
                  i === vorschlag.cursor && 'bg-surface-hover cursor-bar',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  einfuegen(t.name)
                }}
              >
                <span className="flex-1">[{t.name}]</span>
                <span className="text-small text-ink-3">{t.quelle}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
