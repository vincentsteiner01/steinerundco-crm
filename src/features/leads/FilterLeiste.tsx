// BAUPLAN § 3.3 `FilterLeiste.tsx` (ux § 3.2.1): Chips mit ×, „Zurücksetzen ⌫“, Filter-Popover (Zuständig · Phase · Kanal · Fällig · Tag ·
// Quelle · Rolle · Anrede · Erlaubnis · Ohne Unternehmen), „Gruppieren nach“, „Ansicht speichern“ (v1.1 – Button vorhanden, disabled).
// ICP ≥ n und Sequenz/Schritt fehlen bewusst: ICP-Punkte sind v1.1 (§ 1.5 Nr. 12), die Sequenz-Filter kennt die URL-Liste § 3.1.4 nicht.
// Zustand lebt vollständig in der URL (LE-04): die Leiste ändert nur `UrlFilter`-Overrides.
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Checkbox } from '@/components/ui/Checkbox'
import { Popover } from '@/components/ui/Popover'
import { Segment } from '@/components/ui/Segment'
import { Select } from '@/components/ui/Select'
import { fmtZeitraum } from '@/lib/format'
import { PHASEN } from '@/lib/stufen'
import { ERLAUBNIS_LABEL, KANAL_LABEL, PHASE_LABEL } from '@/texte/de'
import type {
  Channel,
  EmailConsentBasis,
  LeadFilter,
  LeadRole,
  Member,
  PhaseKey,
  Salutation,
  Tag,
} from '@/types/domain'
import type { AnsichtDef } from './ansichten'
import { hatOverrides, type UrlFilter } from './filter'
import { ANREDE_LABEL, ROLLE_LABEL } from './spalten'

const FAELLIG_LABEL: Record<NonNullable<LeadFilter['faellig']>, string> = {
  ueberfaellig: 'Überfällig',
  heute: 'Heute',
  woche: 'Diese Woche',
  spaeter: 'Später',
  ohne: 'Ohne',
}
function EREIGNIS_LABEL(e: NonNullable<LeadFilter['ereignis']>): string {
  if (e.art === 'anfrage') return 'Vernetzung angefragt'
  if (e.art === 'annahme') return 'Vernetzung angenommen'
  if (e.art === 'termin_vereinbart') return 'Erstgespräch vereinbart'
  if (e.art === 'termin')
    return e.typ === 'strategiegespraech' ? 'Strategiegespräch' : e.typ === 'erstgespraech' ? 'Erstgespräch' : 'Termin'
  if (e.typ === 'gespraech_eroeffnet') return 'Gespräch eröffnet'
  if (e.typ === 'nachricht_erhalten') return 'Antwort erhalten'
  if (e.typ === 'pitch_gesendet') return 'Pitch gesendet'
  return 'Ereignis'
}
const GRUPPE_LABEL: Record<NonNullable<LeadFilter['gruppe']>, string> = {
  faelligkeit: 'Fälligkeit',
  phase: 'Phase',
  zustaendig: 'Zuständig',
  unternehmen: 'Unternehmen',
}

export type FilterLeisteProps = {
  ansicht: AnsichtDef
  overrides: UrlFilter
  onChange: (next: UrlFilter) => void
  members: readonly Member[]
  tags: readonly Tag[]
  batches: readonly { id: string; label: string | null; created_at: string }[]
  me: string | null
}

export function FilterLeiste({ ansicht, overrides, onChange, members, tags, batches, me }: FilterLeisteProps) {
  const setze = <K extends keyof UrlFilter>(k: K, v: UrlFilter[K] | undefined) => {
    const next = { ...overrides }
    if (v === undefined || (Array.isArray(v) && v.length === 0) || v === '') delete next[k]
    else next[k] = v
    onChange(next)
  }
  const zustaendigLabel = (z: UrlFilter['zustaendig']) => {
    if (!z) return null
    if (Array.isArray(z)) return z.map((id) => members.find((m) => m.id === id)?.short_name ?? '?').join(', ')
    if (z === 'me') return 'Ich'
    if (z === 'andere') return members.find((m) => m.id !== me)?.short_name ?? 'Andere'
    if (z === 'frei') return 'Frei'
    return 'Alle'
  }
  const effektivZustaendig = overrides.zustaendig ?? ansicht.filter.zustaendig ?? 'alle'
  const gruppe = overrides.gruppe ?? ansicht.gruppe
  const chips: { key: keyof UrlFilter; label: string }[] = []
  if (overrides.q) chips.push({ key: 'q', label: `Suche · ‚${overrides.q}‘` })
  if (overrides.zustaendig)
    chips.push({ key: 'zustaendig', label: `Zuständig · ${zustaendigLabel(overrides.zustaendig)}` })
  if (overrides.phase?.length)
    chips.push({ key: 'phase', label: `Phase · ${overrides.phase.map((p) => PHASE_LABEL[p]).join(', ')}` })
  if (overrides.kanal?.length)
    chips.push({ key: 'kanal', label: `Kanal · ${overrides.kanal.map((k) => KANAL_LABEL[k]).join(', ')}` })
  if (overrides.faellig) chips.push({ key: 'faellig', label: `Fällig · ${FAELLIG_LABEL[overrides.faellig]}` })
  if (overrides.tag?.length)
    chips.push({
      key: 'tag',
      label: `Tag · ${overrides.tag.map((id) => tags.find((t) => t.id === id)?.name ?? id).join(', ')}`,
    })
  if (overrides.quelle)
    chips.push({
      key: 'quelle',
      label: `Quelle · ${batches.find((b) => b.id === overrides.quelle)?.label ?? 'Import'}`,
    })
  if (overrides.gruppe) chips.push({ key: 'gruppe', label: `Gruppieren · ${GRUPPE_LABEL[overrides.gruppe]}` })
  if (overrides.rolle?.length)
    chips.push({ key: 'rolle', label: `Rolle · ${overrides.rolle.map((r) => ROLLE_LABEL[r]).join(', ')}` })
  if (overrides.anrede?.length)
    chips.push({ key: 'anrede', label: `Anrede · ${overrides.anrede.map((a) => ANREDE_LABEL[a]).join(', ')}` })
  if (overrides.erlaubnis?.length)
    chips.push({
      key: 'erlaubnis',
      label: `Erlaubnis · ${overrides.erlaubnis.map((e) => ERLAUBNIS_LABEL[e]).join(', ')}`,
    })
  if (overrides.ereignis) {
    // § 7.5: Funnel-Klick aus den KPIs (K-05) – Ereignis im Zeitraum, optional nur einer Person
    const e = overrides.ereignis
    const wer = e.person ? ` · ${members.find((m) => m.id === e.person)?.short_name ?? '?'}` : ''
    chips.push({ key: 'ereignis', label: `${EREIGNIS_LABEL(e)} · ${fmtZeitraum(e.von, e.bis)}${wer}` })
  }

  const togglePhase = (p: PhaseKey) => {
    const aktuell = overrides.phase ?? ansicht.filter.phase ?? []
    const next = aktuell.includes(p) ? aktuell.filter((x) => x !== p) : [...aktuell, p]
    setze('phase', next)
  }
  const toggleIn = <K extends 'rolle' | 'anrede' | 'erlaubnis'>(k: K, wert: NonNullable<UrlFilter[K]>[number]) => {
    const aktuell = (overrides[k] ?? []) as string[]
    const next = aktuell.includes(wert) ? aktuell.filter((x) => x !== wert) : [...aktuell, wert]
    setze(k, next as UrlFilter[K])
  }
  const mehrfach = <K extends 'rolle' | 'anrede' | 'erlaubnis'>(k: K, label: string, werte: Record<string, string>) => (
    <div className="grid gap-1.5">
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {Object.entries(werte).map(([wert, text]) => {
          const an = ((overrides[k] ?? []) as string[]).includes(wert)
          return (
            <Chip
              key={wert}
              interaktiv
              ton={an ? 'neutral' : 'muted'}
              aria-pressed={an}
              onClick={() => toggleIn(k, wert as NonNullable<UrlFilter[K]>[number])}
            >
              {text}
            </Chip>
          )
        })}
      </div>
    </div>
  )
  const toggleTag = (id: string) => {
    const aktuell = overrides.tag ?? []
    setze('tag', aktuell.includes(id) ? aktuell.filter((x) => x !== id) : [...aktuell, id])
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-filterleiste>
      <Popover
        titel="Filter"
        trigger={
          <Button variante="secondary" groesse="S" icon={SlidersHorizontal} aria-label="Filter">
            Filter
          </Button>
        }
        className="max-h-[70vh] w-[340px] max-w-[340px] overflow-auto"
      >
        <div className="grid gap-3 p-1.5">
          <div className="grid gap-1.5">
            <span className="label">Zuständig</span>
            <Segment
              klein
              ariaLabel="Zuständig"
              wert={Array.isArray(effektivZustaendig) ? 'alle' : effektivZustaendig}
              onChange={(k) => setze('zustaendig', k === 'alle' && !ansicht.filter.zustaendig ? undefined : k)}
              optionen={[
                { key: 'me', label: 'Ich' },
                { key: 'andere', label: members.find((m) => m.id !== me)?.short_name ?? 'Andere' },
                { key: 'frei', label: 'Frei' },
                { key: 'alle', label: 'Alle' },
              ]}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="label">Phase</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Phase">
              {PHASEN.map((p) => {
                const an = (overrides.phase ?? ansicht.filter.phase ?? []).includes(p.key)
                return (
                  <Chip
                    key={p.key}
                    interaktiv
                    ton={an ? 'neutral' : 'muted'}
                    aria-pressed={an}
                    onClick={() => togglePhase(p.key)}
                  >
                    {p.label}
                  </Chip>
                )
              })}
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="label">Fällig</span>
            <Select
              aria-label="Fällig"
              className="h-8"
              value={overrides.faellig ?? ''}
              platzhalter="–"
              onChange={(e) => setze('faellig', (e.target.value || undefined) as UrlFilter['faellig'])}
              optionen={(Object.keys(FAELLIG_LABEL) as NonNullable<LeadFilter['faellig']>[]).map((k) => ({
                value: k,
                label: FAELLIG_LABEL[k],
              }))}
            />
          </div>
          {tags.length ? (
            <div className="grid gap-1.5">
              <span className="label">Tag</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tag">
                {tags.map((t) => {
                  const an = (overrides.tag ?? []).includes(t.id)
                  return (
                    <Chip
                      key={t.id}
                      interaktiv
                      ton={an ? 'neutral' : 'muted'}
                      aria-pressed={an}
                      onClick={() => toggleTag(t.id)}
                    >
                      {t.name}
                    </Chip>
                  )
                })}
              </div>
            </div>
          ) : null}
          {batches.length ? (
            <div className="grid gap-1.5">
              <span className="label">Quelle (Import-Stapel)</span>
              <Select
                aria-label="Quelle"
                className="h-8"
                value={overrides.quelle ?? ''}
                platzhalter="–"
                onChange={(e) => setze('quelle', e.target.value || undefined)}
                optionen={batches.map((b) => ({ value: b.id, label: b.label ?? b.id.slice(0, 8) }))}
              />
            </div>
          ) : null}
          {mehrfach('rolle', 'Rolle', ROLLE_LABEL as Record<LeadRole, string>)}
          {mehrfach('anrede', 'Anrede', { herr: 'Herr', frau: 'Frau', neutral: 'offen' } satisfies Record<
            Salutation,
            string
          >)}
          {mehrfach('erlaubnis', 'Erlaubnis-Grundlage', ERLAUBNIS_LABEL as Record<EmailConsentBasis, string>)}
          <div className="grid gap-1.5">
            <span className="label">Gruppieren nach</span>
            <Select
              aria-label="Gruppieren nach"
              className="h-8"
              value={gruppe ?? ''}
              platzhalter="–"
              onChange={(e) => setze('gruppe', (e.target.value || undefined) as UrlFilter['gruppe'])}
              optionen={(Object.keys(GRUPPE_LABEL) as NonNullable<LeadFilter['gruppe']>[]).map((k) => ({
                value: k,
                label: GRUPPE_LABEL[k],
              }))}
            />
          </div>
          <Checkbox
            label="Ohne Unternehmen"
            checked={!!ansicht.filter.ohneUnternehmen}
            disabled
            title="Über die Ansicht „Unvollständig“"
          />
        </div>
      </Popover>
      <Segment
        klein
        ariaLabel="Kanal"
        wert={(overrides.kanal?.[0] ?? 'alle') as Channel | 'alle'}
        onChange={(k) => setze('kanal', k === 'alle' ? undefined : [k as Channel])}
        optionen={[
          { key: 'alle', label: 'Alle' },
          { key: 'linkedin', label: <span className="glyph">in</span> },
          { key: 'telefon', label: 'Telefon' },
          { key: 'email', label: 'E-Mail' },
        ]}
      />
      {chips.map((c) => (
        <Chip key={c.key} ton="neutral" onRemove={() => setze(c.key, undefined)}>
          {c.label}
        </Chip>
      ))}
      {hatOverrides(overrides) ? (
        <Button variante="quiet" groesse="S" kbd="⌫" onClick={() => onChange({})}>
          Zurücksetzen
        </Button>
      ) : null}
      <Button variante="quiet" groesse="S" disabled disabledGrund="Kommt in v1.1">
        Ansicht speichern
      </Button>
    </div>
  )
}
