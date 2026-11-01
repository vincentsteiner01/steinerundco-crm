// Ablauf einer Kampagne (01.11.2026): Mails mit Wartetagen und A/B-Varianten schreiben, Platzhalter per Klick einfügen, Vorschau
// mit echten Daten des ersten Empfängers, Hinweise zu Zustellbarkeit und Recht (logik.textHinweise). Gespeichert wird alles in
// einem Zug (crm.mail_kampagne_speichern) – Varianten mit Sendungen werden beim Entfernen nur deaktiviert.
import { Plus, Save, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Segment } from '@/components/ui/Segment'
import { Textarea } from '@/components/ui/Textarea'
import { useSettings } from '@/data'
import { type Empfaenger, type KampagneZahlen, type Postfach, type Schritt, useKampagneSpeichern } from '@/data/mailing'
import { fuellenVorschau, MAIL_PLATZHALTER, tagImAblauf, textHinweise, woerter } from './logik'
import { Warum } from './Teile'

type Variante = { kennung: string; betreff: string; text: string; aktiv: boolean }
type SchrittForm = { wartetage: number; im_thread: boolean; varianten: Variante[] }

const KENNUNGEN = ['A', 'B', 'C', 'D', 'E'] as const

function ausServer(schritte: Schritt[]): SchrittForm[] {
  return schritte.map((s) => ({
    wartetage: s.wartetage,
    im_thread: s.im_thread,
    varianten: s.mail_varianten.map((v) => ({ kennung: v.kennung, betreff: v.betreff, text: v.text, aktiv: v.aktiv })),
  }))
}

export function AblaufEditor({
  kampagne,
  schritte,
  empfaenger,
  postfaecher,
}: {
  kampagne: KampagneZahlen
  schritte: Schritt[]
  empfaenger: Empfaenger[]
  postfaecher: Postfach[]
}) {
  const speichern = useKampagneSpeichern()
  const { data: settings } = useSettings()
  const [form, setForm] = useState<SchrittForm[]>(() => ausServer(schritte))
  const [geaendert, setGeaendert] = useState(false)
  const [auswahl, setAuswahl] = useState<Record<number, string>>({})
  const eigeneVariablen = useMemo(
    () => [...new Set(empfaenger.flatMap((e) => Object.keys((e.variablen as Record<string, unknown> | null) ?? {})))],
    [empfaenger],
  )
  // Neuer Server-Stand (nach dem Speichern) baut den Editor über `key` in KampagneSeite neu auf

  const aendern = (f: (x: SchrittForm[]) => SchrittForm[]) => {
    setForm((x) => f(structuredClone(x)))
    setGeaendert(true)
  }
  const sichern = () =>
    speichern.mutate(
      { id: kampagne.id as string, name: kampagne.name as string, schritte: form },
      { onSuccess: () => (setGeaendert(false), toast('Ablauf gespeichert')) },
    )

  const beispiel = empfaenger[0]?.leads ?? {
    first_name: 'Lukas',
    last_name: 'Beispiel',
    company_name: 'Beispiel Solar GmbH',
  }
  const absender = postfaecher[0] ?? null
  const fuss = [
    kampagne.abmelde_satz ? (settings?.email?.objection_sentence ?? '') : '',
    kampagne.datenschutz_satz && settings?.email?.privacy_url
      ? `Hinweise zum Datenschutz: ${settings.email.privacy_url}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="grid gap-5">
      {form.length > 3 ? (
        <p className="bg-overdue-tint text-small text-overdue rounded-sm px-3 py-2">
          Mehr als 3 Mails: Bei Leads mit Erlaubnis gehen höchstens 3 Mails ohne Antwort raus – die 4. würde das CRM
          stoppen.
        </p>
      ) : null}
      {form.map((s, i) => {
        const kennung =
          auswahl[i] && s.varianten.some((v) => v.kennung === auswahl[i])
            ? auswahl[i]!
            : (s.varianten[0]?.kennung ?? 'A')
        const vi = s.varianten.findIndex((v) => v.kennung === kennung)
        const v = s.varianten[vi]
        return (
          <section key={i} className="border-line-strong rounded-md border" aria-label={`Mail ${i + 1}`}>
            <header className="border-line bg-sidebar flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-ui text-ink-bright">Mail {i + 1}</h3>
                <Chip ton="grau">
                  Tag{' '}
                  {tagImAblauf(
                    form.map((x) => x.wartetage),
                    i,
                  )}
                </Chip>
                {i > 0 ? (
                  <label className="text-small text-ink-2 flex items-center gap-1.5">
                    nach
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={s.wartetage}
                      onChange={(e) =>
                        aendern((x) => ((x[i]!.wartetage = Math.max(1, Math.min(30, Number(e.target.value) || 1))), x))
                      }
                      className="w-16"
                      aria-label={`Wartetage vor Mail ${i + 1}`}
                    />
                    Tagen
                  </label>
                ) : null}
                {i > 0 ? (
                  <Checkbox
                    checked={s.im_thread}
                    onChange={(e) => aendern((x) => ((x[i]!.im_thread = e.target.checked), x))}
                    label="im selben Verlauf"
                  />
                ) : null}
              </div>
              {form.length > 1 ? (
                <Button
                  variante="quiet"
                  groesse="S"
                  icon={Trash2}
                  onClick={() => aendern((x) => x.filter((_, j) => j !== i))}
                >
                  Mail entfernen
                </Button>
              ) : null}
            </header>
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <div className="grid content-start gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Segment
                    ariaLabel={`Varianten von Mail ${i + 1}`}
                    klein
                    wert={kennung}
                    onChange={(k) => setAuswahl((a) => ({ ...a, [i]: k }))}
                    optionen={s.varianten.map((x) => ({
                      key: x.kennung,
                      label: x.aktiv ? x.kennung : `${x.kennung} (aus)`,
                    }))}
                  />
                  {s.varianten.length < KENNUNGEN.length ? (
                    <Button
                      variante="quiet"
                      groesse="S"
                      icon={Plus}
                      onClick={() => {
                        const frei = KENNUNGEN.find((k) => !s.varianten.some((x) => x.kennung === k)) ?? 'B'
                        aendern(
                          (x) => (
                            x[i]!.varianten.push({
                              kennung: frei,
                              betreff: v?.betreff ?? '',
                              text: v?.text ?? '',
                              aktiv: true,
                            }),
                            x
                          ),
                        )
                        setAuswahl((a) => ({ ...a, [i]: frei }))
                      }}
                    >
                      Variante
                    </Button>
                  ) : null}
                  {s.varianten.length > 1 && v ? (
                    <Button
                      variante="quiet"
                      groesse="S"
                      icon={Trash2}
                      onClick={() =>
                        aendern((x) => ((x[i]!.varianten = x[i]!.varianten.filter((y) => y.kennung !== v.kennung)), x))
                      }
                    >
                      {v.kennung} entfernen
                    </Button>
                  ) : null}
                </div>
                {v ? (
                  <VarianteFelder
                    v={v}
                    ersterSchritt={i === 0}
                    eigeneVariablen={eigeneVariablen}
                    onChange={(neu) => aendern((x) => ((x[i]!.varianten[vi] = neu), x))}
                  />
                ) : null}
              </div>
              {v ? (
                <Vorschau
                  betreff={
                    v.betreff.trim()
                      ? fuellenVorschau(v.betreff, beispiel, {
                          name: absender?.absender_name,
                          signatur: absender?.signatur,
                        })
                      : i > 0
                        ? `Re: ${fuellenVorschau(form[0]?.varianten[0]?.betreff ?? '', beispiel, { name: absender?.absender_name })}`
                        : ''
                  }
                  text={fuellenVorschau(v.text, beispiel, {
                    name: absender?.absender_name,
                    signatur: absender?.signatur,
                  })}
                  signatur={v.text.includes('[Signatur]') ? '' : (absender?.signatur ?? '')}
                  fuss={i === 0 ? fuss : kampagne.abmelde_satz ? (settings?.email?.objection_sentence ?? '') : ''}
                  an={`${beispiel.first_name ?? ''} ${beispiel.last_name ?? ''}`.trim()}
                  von={absender?.absender_name ?? 'Absender'}
                />
              ) : null}
            </div>
          </section>
        )
      })}
      <div className="bg-canvas border-line sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t py-3">
        <div className="flex flex-wrap gap-2">
          {form.length < 5 ? (
            <Button
              variante="secondary"
              icon={Plus}
              onClick={() =>
                aendern((x) => [
                  ...x,
                  {
                    wartetage: x.length === 1 ? 3 : 5,
                    im_thread: true,
                    varianten: [
                      {
                        kennung: 'A',
                        betreff: '',
                        text: '[Briefanrede],\n\n\n\nViele Grüße\n[Absender Vorname]',
                        aktiv: true,
                      },
                    ],
                  },
                ])
              }
            >
              Mail hinzufügen
            </Button>
          ) : null}
        </div>
        <Button variante="primary" icon={Save} busy={speichern.isPending} disabled={!geaendert} onClick={sichern}>
          {geaendert ? 'Ablauf speichern' : 'Gespeichert'}
        </Button>
      </div>
      <Warum label="Was macht eine gute Mail aus?">
        Kurz (unter 120 Wörtern, ideal 50–80), reiner Text, ein klarer Anlass, eine einfache Frage am Ende. In der
        ersten Mail keine Links und keine Bilder. Folgemails laufen im selben Verlauf („Re:“) – drei Mails reichen: Tag
        0, +3, +8. Varianten A/B testen Betreff oder Einstieg; das CRM verteilt sie gleichmäßig und zählt die Antworten
        je Variante.
      </Warum>
    </div>
  )
}

function VarianteFelder({
  v,
  ersterSchritt,
  eigeneVariablen,
  onChange,
}: {
  v: Variante
  ersterSchritt: boolean
  eigeneVariablen: string[]
  onChange: (v: Variante) => void
}) {
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const hinweise = textHinweise(v.betreff, v.text, ersterSchritt, eigeneVariablen)
  const einfuegen = (name: string) => {
    const el = textRef.current
    const marke = `[${name}]`
    if (!el) return onChange({ ...v, text: v.text + marke })
    const a = el.selectionStart ?? v.text.length
    const b = el.selectionEnd ?? a
    onChange({ ...v, text: v.text.slice(0, a) + marke + v.text.slice(b) })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + marke.length, a + marke.length)
    })
  }
  return (
    <>
      <FormField
        label="Betreff"
        hinweis={ersterSchritt ? undefined : 'Leer lassen = Antwort im selben Verlauf („Re: …“)'}
      >
        <Input value={v.betreff} onChange={(e) => onChange({ ...v, betreff: e.target.value })} aria-label="Betreff" />
      </FormField>
      <FormField label={`Text · ${woerter(v.text)} Wörter`}>
        <Textarea
          ref={textRef}
          rows={11}
          value={v.text}
          onChange={(e) => onChange({ ...v, text: e.target.value })}
          aria-label="Text"
        />
      </FormField>
      <div className="flex flex-wrap gap-1.5" aria-label="Platzhalter einfügen">
        {[...MAIL_PLATZHALTER, ...eigeneVariablen].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => einfuegen(p)}
            className="border-line-strong text-small text-ink-2 hover:bg-surface-hover hover:text-ink rounded-xs border px-2 py-0.5"
          >
            [{p}]
          </button>
        ))}
      </div>
      <Checkbox
        checked={v.aktiv}
        onChange={(e) => onChange({ ...v, aktiv: e.target.checked })}
        label="Variante wird verschickt"
      />
      {hinweise.length ? (
        <ul className="grid gap-1">
          {hinweise.map((h) => (
            <li key={h.text} className={cn('text-small', h.ton === 'warnung' ? 'text-overdue' : 'text-ink-3')}>
              {h.text}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

function Vorschau({
  betreff,
  text,
  signatur,
  fuss,
  an,
  von,
}: {
  betreff: string
  text: string
  signatur: string
  fuss: string
  an: string
  von: string
}) {
  const teile = [text.trimEnd(), signatur.trim(), fuss.trim()].filter(Boolean)
  return (
    <div className="bg-sidebar min-w-0 rounded-md p-4" aria-label="Vorschau">
      <p className="text-label text-ink-3">Vorschau · so sieht {an || 'der erste Empfänger'} die Mail</p>
      <p className="text-small text-ink-3 mt-2">Von: {von}</p>
      <p className="text-ui text-ink-bright mt-1 break-words">
        {betreff || <span className="text-danger">Betreff fehlt</span>}
      </p>
      <div className="text-body text-ink mt-3 break-words whitespace-pre-wrap">
        {teile
          .join('\n\n')
          .split(/(\[[^[\]\n]{1,40}\])/g)
          .map((t, i) =>
            /^\[[^[\]\n]{1,40}\]$/.test(t) ? (
              <mark key={i} className="bg-overdue-tint text-overdue rounded-xs px-0.5">
                {t}
              </mark>
            ) : (
              <span key={i}>{t}</span>
            ),
          )}
      </div>
    </div>
  )
}
