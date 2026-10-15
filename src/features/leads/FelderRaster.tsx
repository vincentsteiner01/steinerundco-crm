// BAUPLAN § 3.3 `FelderRaster.tsx` (DESIGN-SYSTEM § 5.11): zweispaltiges Raster label/Wert, Mono für Datum/URL/Telefon, leere Werte
// „hinzufügen“ in ink-4, Klick → Inline-Edit (components/tabelle/InlineEdit). Pflichtfelder: Quelle, Vernetzung angenommen, Eröffnet von,
// Nächster Follow-up, Langfristig ab, Follow-ups n/3. Tags mit Popover (useTags, useLeadTagSetzen).
import { useState } from 'react'
import { InlineEdit, type InlineEditArt } from '@/components/tabelle'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/components/ui/cn'
import { Popover, PopoverEintrag } from '@/components/ui/Popover'
import type { SelectOption } from '@/components/ui/Select'
import { mutationFehler } from '@/data/errors'
import { useLeadUpdate } from '@/data/leads'
import { useSequencesIndex } from '@/data/sequences'
import { useLeadTagEntfernen, useLeadTagSetzen, useTags } from '@/data/tags'
import { fmtDatum, fmtDatumKurz } from '@/lib/format'
import { fmtTelefon, nachE164 } from '@/lib/telefon'
import { linkedinAnzeige } from '@/lib/url'
import { berlinTag } from '@/lib/zeit'
import type { LeadMitBezug, LeadUpdate, Member, Settings } from '@/types/domain'
import { ALLGEMEIN } from '@/texte/de'
import { jetztIso } from './hilfen'
import { firmaPatch, useNaechsteAktionSetzen } from './leadFelder'
import { ANREDE_LABEL, ANREDE_OPTIONEN, ROLLE_OPTIONEN, rolleAnzeige } from './spalten'
import { anzeigeName } from '@/lib/mitglied'

export type FelderRasterProps = {
  lead: LeadMitBezug
  members: readonly Member[]
  /** Bleibt im Vertrag; die Fälligkeitszeit liest „Nächste Aktion“ jetzt selbst (leadFelder) */
  settings?: Settings | null
  /** Vollseite: vier Spalten */
  breit?: boolean
  className?: string
}

type Feld = {
  key: string
  label: string
  wert: string | null
  leer?: string
  mono?: boolean
  edit?: {
    art: InlineEditArt
    wert: string | null
    optionen?: SelectOption[]
    /** Patch am Lead (Unternehmen: asynchron über die Firmen-Verknüpfung) */
    patch?: (v: string | null) => LeadUpdate | null | Promise<LeadUpdate | null>
    /** Eigener Schreibweg statt eines Lead-Patches (Nächste Aktion → Schritt/Aufgabe verschieben) */
    eigen?: (v: string | null) => Promise<unknown>
  }
  hinweis?: string
}

const QUELLE: Record<string, string> = {
  app: 'Angelegt',
  import_sheet: 'Import · CRM-Tabelle',
  import_csv: 'Import · CSV',
  schnellimport: 'Schnellimport',
  linkedin_export: 'LinkedIn-Export',
  telefonie: 'Telefonie',
  email_sync: 'E-Mail',
}

export function FelderRaster({ lead, members, breit, className }: FelderRasterProps) {
  const [aktiv, setAktiv] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const update = useLeadUpdate()
  const naechsteAktion = useNaechsteAktionSetzen()
  const { data: seq } = useSequencesIndex()
  const { data: tags } = useTags()
  const tagSetzen = useLeadTagSetzen()
  const tagEntfernen = useLeadTagEntfernen()

  const name = (id: string | null | undefined) => {
    const m = id ? members.find((x) => x.id === id) : null
    return anzeigeName(m) || null
  }
  const angenommen = (lead.linkedin_connections ?? []).find((c) => c.status === 'angenommen' && c.accepted_at)
  const enrollment = (lead.enrollments ?? []).find((e) => e.status === 'aktiv' && e.channel === 'linkedin')
  const sequenz = enrollment ? seq?.sequenzen.find((s) => s.id === enrollment.sequence_id) : undefined
  const langfristig = enrollment && sequenz ? sequenz.steps.find((s) => /^langfristig/i.test(s.name)) : undefined
  const legacy = (lead.custom as { sheet_row?: number } | null)?.sheet_row

  const felder: Feld[] = [
    {
      key: 'linkedin',
      label: 'LinkedIn',
      wert: lead.linkedin_url ? linkedinAnzeige(lead.linkedin_url, 40) : null,
      mono: true,
      edit: {
        art: 'text',
        wert: lead.linkedin_url,
        // `linkedin_url_norm` ist eine generierte Spalte – die DB leitet sie ab (Review: Update wurde abgelehnt)
        patch: (v) => ({ linkedin_url: v }),
      },
    },
    {
      key: 'telefon',
      label: 'Telefon',
      wert: lead.phone_e164 ? fmtTelefon(lead.phone_e164) : null,
      mono: true,
      edit: {
        art: 'text',
        wert: lead.phone_e164,
        patch: (v) => {
          if (!v) return { phone_e164: null }
          const e164 = nachE164(v)
          if (!e164) {
            setFehler(ALLGEMEIN.nummerUnvollstaendig)
            return null
          }
          return { phone_e164: e164, phone_collected_at: jetztIso() }
        },
      },
    },
    {
      key: 'email',
      label: 'E-Mail',
      wert: lead.email,
      mono: true,
      edit: { art: 'text', wert: lead.email, patch: (v) => ({ email: v?.trim().toLowerCase() || null }) },
    },
    {
      key: 'unternehmen',
      label: 'Unternehmen',
      wert: lead.company_name,
      // Firma verknüpfen statt nur `company_name` – sonst setzt leads_before_write den alten Firmennamen zurück
      edit: { art: 'text', wert: lead.company_name, patch: (v) => firmaPatch(v) },
    },
    {
      key: 'rolle',
      label: 'Rolle',
      wert: rolleAnzeige(lead.role, lead.role_title),
      edit: {
        art: 'select',
        wert: lead.role,
        optionen: ROLLE_OPTIONEN,
        patch: (v) => (v ? { role: v as LeadMitBezug['role'] } : null),
      },
    },
    {
      key: 'anrede',
      label: 'Anrede',
      wert: lead.salutation === 'neutral' ? null : ANREDE_LABEL[lead.salutation],
      leer: 'offen',
      edit: {
        art: 'select',
        wert: lead.salutation,
        optionen: ANREDE_OPTIONEN,
        patch: (v) => (v ? { salutation: v as LeadMitBezug['salutation'] } : null),
      },
    },
    { key: 'ort', label: 'Ort', wert: lead.city, edit: { art: 'text', wert: lead.city, patch: (v) => ({ city: v }) } },
    {
      key: 'quelle',
      label: 'Quelle',
      wert: `${QUELLE[lead.source] ?? lead.source} · ${fmtDatumKurz(lead.created_at)}${legacy ? ` · Zeile ${legacy}` : ''}`,
      mono: true,
    },
    {
      key: 'angenommen',
      label: 'Vernetzung angenommen',
      wert: angenommen?.accepted_at
        ? `${fmtDatum(angenommen.accepted_at)}${name(angenommen.member_id) ? ` · ${name(angenommen.member_id)}` : ''}`
        : null,
      leer: 'noch nicht',
      mono: true,
    },
    { key: 'eroeffnet', label: 'Eröffnet von', wert: name(lead.opened_by_id), leer: 'noch nicht' },
    {
      key: 'sequenz',
      label: 'Sequenz',
      wert:
        enrollment && sequenz
          ? `${sequenz.name} · Version ${sequenz.version} · Schritt ${enrollment.current_position ?? 1}/${sequenz.steps.length}`
          : null,
      leer: 'keine',
    },
    { key: 'followups', label: 'Follow-ups', wert: `${lead.follow_up_count} von 3 kurzfristig`, mono: true },
    {
      key: 'naechster',
      label: 'Nächster Follow-up',
      wert: lead.next_action_at
        ? `${fmtDatum(lead.next_action_at)}${lead.next_action_label ? ` · ${lead.next_action_label}` : ''}`
        : null,
      leer: 'keiner',
      mono: true,
      edit: {
        art: 'datum',
        wert: lead.next_action_at ? berlinTag(lead.next_action_at) : null,
        eigen: (v) => naechsteAktion(lead, v),
      },
    },
    {
      key: 'langfristig',
      label: 'Langfristig ab',
      wert:
        langfristig &&
        enrollment?.next_due_at &&
        /^langfristig/i.test(seq?.stepsById.get(enrollment.current_step_id ?? '')?.name ?? '')
          ? fmtDatum(enrollment.next_due_at)
          : null,
      leer: langfristig ? 'nach Kurzfristig 3' : '–',
      mono: true,
    },
    {
      key: 'icp',
      label: 'ICP-Punkte',
      wert: lead.priority ? String(lead.priority) : null,
      leer: 'offen',
      mono: true,
      hinweis: 'v1: Priorität als ICP-Ersatz (§ 1.5 Nr. 12)',
    },
  ]

  const speichern = async (f: Feld, v: string | null) => {
    setAktiv(null)
    if (!f.edit) return
    setFehler(null)
    if (f.edit.eigen) {
      await f.edit.eigen(v)
      return
    }
    let patch: LeadUpdate | null = null
    try {
      patch = (await f.edit.patch?.(v)) ?? null
    } catch (e) {
      mutationFehler(e)
      return
    }
    if (!patch) return
    try {
      await update.mutateAsync({ id: lead.id, erwartetUpdatedAt: lead.updated_at, patch })
    } catch {
      /* Toast aus der Mutation */
    }
  }

  const leadTags = new Set((lead.lead_tags ?? []).map((t) => t.tag_id))

  return (
    <div
      // breit (Vollseite): so viele Spalten wie 140 px passen – fest 4 Spalten ergaben bei 1024 px nur 72 px je Feld (Werte liefen über)
      className={cn(
        'mb-5 grid gap-x-5 gap-y-3.5',
        breit ? 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]' : 'grid-cols-[repeat(2,minmax(0,1fr))]',
        className,
      )}
    >
      {felder.map((f) => (
        <div key={f.key} className="grid min-w-0 gap-[3px]">
          <span className="label" title={f.hinweis}>
            {f.label}
          </span>
          {aktiv === f.key && f.edit ? (
            <InlineEdit
              art={f.edit.art}
              wert={f.edit.wert}
              optionen={f.edit.optionen}
              ariaLabel={f.label}
              mono={f.mono}
              onSave={(v) => void speichern(f, v)}
              onCancel={() => setAktiv(null)}
            />
          ) : f.edit ? (
            <button
              type="button"
              className={cn(
                'hover:border-line-strong truncate border-b border-dashed border-transparent py-0.5 text-left text-[14px]',
                f.mono && 'tnum font-mono text-[13px]',
                f.wert ? (f.mono ? 'text-ink-2' : 'text-ink') : 'text-ink-4',
              )}
              onClick={() => setAktiv(f.key)}
              aria-label={`${f.label} bearbeiten`}
              title={typeof f.wert === 'string' ? f.wert : undefined}
            >
              {f.wert ?? f.leer ?? 'hinzufügen'}
            </button>
          ) : (
            <span
              className={cn(
                'truncate py-0.5 text-[14px]',
                f.mono && 'tnum font-mono text-[13px]',
                f.wert ? (f.mono ? 'text-ink-2' : 'text-ink') : 'text-ink-4',
              )}
              title={typeof f.wert === 'string' ? f.wert : undefined}
            >
              {f.wert ?? f.leer ?? 'hinzufügen'}
            </span>
          )}
          {f.key === 'telefon' && fehler ? <span className="text-small text-danger">{fehler}</span> : null}
        </div>
      ))}
      <div className="grid min-w-0 gap-[3px]" data-tags>
        <span className="label">Tags</span>
        <span className="flex flex-wrap items-center gap-1.5 py-0.5">
          {(tags ?? [])
            .filter((t) => leadTags.has(t.id))
            .map((t) => (
              <Chip key={t.id} ton="muted" onRemove={() => tagEntfernen.mutate({ leadId: lead.id, tagId: t.id })}>
                {t.name}
              </Chip>
            ))}
          <Popover
            titel="Tag hinzufügen"
            trigger={
              <button type="button" className="text-ink-4 hover:text-ink text-[14px]">
                {leadTags.size ? '+' : 'hinzufügen'}
              </button>
            }
          >
            {(tags ?? []).filter((t) => !leadTags.has(t.id)).length === 0 ? (
              <span className="text-small text-ink-3 block px-2.5 py-1.5">Keine weiteren Tags.</span>
            ) : (
              (tags ?? [])
                .filter((t) => !leadTags.has(t.id))
                .map((t) => (
                  <PopoverEintrag key={t.id} onClick={() => tagSetzen.mutate({ leadId: lead.id, tagId: t.id })}>
                    {t.name}
                  </PopoverEintrag>
                ))
            )}
          </Popover>
        </span>
      </div>
    </div>
  )
}
