// Telefonnummern im Lead (17.10.2026): Länderauswahl (Feedback ebfc59a0 – „0…“ wurde immer +49) und weitere Nummern je
// Person (Feedback 9f9301ea – Zentrale, Durchwahl, Mobil; leads.phone_numbers, Migration 10). Die Hauptnummer bleibt
// phone_e164/phone_type – daran hängen Anrufliste, Telefon-Gate und log_call.
import { Copy, Star, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { kopieren } from '@/lib/zwischenablage'
import {
  alsNummerTyp,
  fmtTelefon,
  LAENDER,
  landLabel,
  landVon,
  nachE164,
  NUMMER_TYP_LABEL,
  STANDARD_LAND,
  weitereNummern,
  type Land,
  type NummerTyp,
  type WeitereNummer,
} from '@/lib/telefon'
import { ALLGEMEIN } from '@/texte/de'
import type { Json } from '@/types/database'
import type { LeadMitBezug, LeadUpdate, PhoneType } from '@/types/domain'
import { jetztIso } from '../hilfen'

export function LandWahl({
  wert,
  onChange,
  id,
  className,
}: {
  wert: Land
  onChange: (l: Land) => void
  id?: string
  className?: string
}) {
  return (
    <Select
      id={id}
      aria-label="Land der Nummer"
      title={LAENDER.find((l) => l.land === wert)?.name}
      className={className ?? 'h-8 w-[96px] font-mono text-[12.5px]'}
      value={wert}
      onChange={(e) => onChange(e.target.value as Land)}
      optionen={LAENDER.map((l) => ({ value: l.land, label: landLabel(l.land) }))}
    />
  )
}

/** Inline-Eingabe Land + Nummer; speichert beim Verlassen der Gruppe (nicht beim Wechsel Feld ↔ Land). */
export function NummerEingabe({
  start,
  label,
  onSpeichern,
  onAbbrechen,
}: {
  start: string | null
  label: string
  onSpeichern: (text: string, land: Land) => void
  onAbbrechen: () => void
}) {
  const [text, setText] = useState(start ? fmtTelefon(start) : '')
  const [land, setLand] = useState<Land>(landVon(start) ?? STANDARD_LAND)
  return (
    <div
      className="flex min-w-0 items-center gap-1.5"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onSpeichern(text, land)
      }}
    >
      <LandWahl wert={land} onChange={setLand} />
      <Input
        autoFocus
        mono
        aria-label={label}
        value={text}
        placeholder="0… oder +…"
        className="h-8 min-w-0"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSpeichern(text, land)
          }
          if (e.key === 'Escape') onAbbrechen()
        }}
      />
    </div>
  )
}

const TYPEN = Object.keys(NUMMER_TYP_LABEL) as NummerTyp[]
const alsPhoneType = (t: NummerTyp): PhoneType => (t === 'sonstige' ? 'unbekannt' : t)

/** Weitere Nummern: Liste mit Kopieren · „Hauptnummer“ · Entfernen, darunter „+ Nummer“ (Typ · Land · Nummer). */
export function WeitereNummern({ lead, patch }: { lead: LeadMitBezug; patch: (p: LeadUpdate) => Promise<boolean> }) {
  const liste = weitereNummern(lead.phone_numbers)
  const [neu, setNeu] = useState<{ typ: NummerTyp; land: Land; text: string } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const speichern = async (l: WeitereNummer[]) => patch({ phone_numbers: l as unknown as Json })

  const hinzufuegen = async () => {
    if (!neu) return
    const e164 = nachE164(neu.text, neu.land)
    if (!e164) {
      setFehler(ALLGEMEIN.nummerUnvollstaendig)
      return
    }
    if (e164 === lead.phone_e164 || liste.some((n) => n.e164 === e164)) {
      setFehler('Diese Nummer ist schon eingetragen.')
      return
    }
    setFehler(null)
    // Ohne Hauptnummer wird die erste Nummer die Hauptnummer (Anrufliste, Anrufen)
    const ok = lead.phone_e164
      ? await speichern([...liste, { e164, typ: neu.typ }])
      : await patch({
          phone_e164: e164,
          phone_type: alsPhoneType(neu.typ),
          phone_collected_at: jetztIso(),
        })
    if (ok) setNeu(null)
  }

  const alsHauptnummer = async (n: WeitereNummer) => {
    const rest = liste.filter((x) => x.e164 !== n.e164)
    const alt = lead.phone_e164 ? [{ e164: lead.phone_e164, typ: alsNummerTyp(lead.phone_type) }] : []
    const ok = await patch({
      phone_e164: n.e164,
      phone_type: alsPhoneType(n.typ),
      phone_numbers: [...alt, ...rest] as unknown as Json,
    })
    if (ok) toast(`${NUMMER_TYP_LABEL[n.typ]} ist jetzt die Hauptnummer.`)
  }

  const kopiere = async (e164: string) => {
    const r = await kopieren(e164)
    toast(r === 'ok' ? 'Nummer kopiert.' : 'Nummer markiert – ⌘C')
  }

  return (
    <div className="col-span-2 grid gap-1.5" data-weitere-nummern>
      <span className="label">Weitere Nummern</span>
      {liste.length ? (
        <ul className="grid gap-1">
          {liste.map((n) => (
            <li key={n.e164} className="flex min-w-0 items-center gap-2" data-nummer={n.e164}>
              <span className="text-ink-3 w-[72px] flex-none text-[12.5px]">{NUMMER_TYP_LABEL[n.typ]}</span>
              <span className="tnum text-ink-2 min-w-0 flex-1 truncate font-mono text-[13px]">
                {fmtTelefon(n.e164)}
              </span>
              <Button
                variante="icon"
                aria-label={`${NUMMER_TYP_LABEL[n.typ]} kopieren`}
                onClick={() => void kopiere(n.e164)}
              >
                <Copy size={14} strokeWidth={1.75} aria-hidden />
              </Button>
              <Button
                variante="icon"
                aria-label={`${NUMMER_TYP_LABEL[n.typ]} als Hauptnummer`}
                title="Als Hauptnummer – wird in der Anrufliste gewählt"
                onClick={() => void alsHauptnummer(n)}
              >
                <Star size={14} strokeWidth={1.75} aria-hidden />
              </Button>
              <Button
                variante="icon"
                aria-label={`${NUMMER_TYP_LABEL[n.typ]} entfernen`}
                onClick={() => void speichern(liste.filter((x) => x.e164 !== n.e164))}
              >
                <X size={14} strokeWidth={1.75} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {neu ? (
        <div className="grid gap-1.5" role="group" aria-label="Nummer hinzufügen">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Select
              aria-label="Art der Nummer"
              className="h-8 w-[112px]"
              value={neu.typ}
              onChange={(e) => setNeu({ ...neu, typ: e.target.value as NummerTyp })}
              optionen={TYPEN.map((t) => ({ value: t, label: NUMMER_TYP_LABEL[t] }))}
            />
            <LandWahl wert={neu.land} onChange={(land) => setNeu({ ...neu, land })} />
            <Input
              autoFocus
              mono
              aria-label="Neue Nummer"
              placeholder="0… oder +…"
              className="h-8 min-w-[140px] flex-1"
              value={neu.text}
              onChange={(e) => setNeu({ ...neu, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void hinzufuegen()
                }
                if (e.key === 'Escape') setNeu(null)
              }}
            />
          </div>
          {fehler ? <span className="text-small text-danger">{fehler}</span> : null}
          <div className="flex gap-1.5">
            <Button variante="primary" groesse="S" disabled={!neu.text.trim()} onClick={() => void hinzufuegen()}>
              Speichern
            </Button>
            <Button
              variante="quiet"
              groesse="S"
              onClick={() => {
                setNeu(null)
                setFehler(null)
              }}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            variante="quiet"
            groesse="S"
            onClick={() =>
              setNeu({
                typ: lead.phone_type === 'zentrale' ? 'durchwahl' : 'zentrale',
                land: landVon(lead.phone_e164) ?? STANDARD_LAND,
                text: '',
              })
            }
          >
            + Nummer
          </Button>
        </div>
      )}
    </div>
  )
}
