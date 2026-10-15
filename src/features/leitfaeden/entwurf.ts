// Editor-Entwurf (BAUPLAN § 3.7 „State & Keys“: localStorage `crm.leitfaden.entwurf.<id>`) und Zeile für useTemplateSave.
import type { TemplateInsert } from '@/data/templates'
import type { Channel, Template, TemplatePhase } from '@/types/domain'
import { phasenFuer } from './phasen'

export type Entwurf = {
  name: string
  phase: TemplatePhase
  when_to_use: string
  form_of_address: '' | 'sie' | 'du'
  notes: string
  subject: string
  body: string
}

export const ENTWURF_PRAEFIX = 'crm.leitfaden.entwurf.'

export function entwurfVon(t: Template): Entwurf {
  return {
    name: t.name,
    phase: t.phase,
    when_to_use: t.when_to_use ?? '',
    form_of_address: t.form_of_address ?? '',
    notes: t.notes ?? '',
    subject: t.subject ?? '',
    body: t.body,
  }
}

export function entwurfLeer(kanal: Channel): Entwurf {
  return {
    name: '',
    phase: phasenFuer(kanal)[0]?.key ?? 'eroeffnung',
    when_to_use: '',
    form_of_address: '',
    notes: '',
    subject: '',
    body: '',
  }
}

export function istGleich(a: Entwurf, b: Entwurf): boolean {
  return (Object.keys(a) as (keyof Entwurf)[]).every((k) => a[k] === b[k])
}

export function liesEntwurf(id: string): Entwurf | null {
  try {
    const roh = localStorage.getItem(ENTWURF_PRAEFIX + id)
    return roh ? (JSON.parse(roh) as Entwurf) : null
  } catch {
    return null
  }
}

export function schreibeEntwurf(id: string, e: Entwurf | null): void {
  try {
    if (e) localStorage.setItem(ENTWURF_PRAEFIX + id, JSON.stringify(e))
    else localStorage.removeItem(ENTWURF_PRAEFIX + id)
  } catch {
    // ohne Storage kein Entwurf – die Seite funktioniert trotzdem
  }
}

/** Zeile für `useTemplateSave` aus Vorlage (oder null bei Neuanlage) + Entwurf. */
export function zeileAusEntwurf(t: Template | null, e: Entwurf, kanal: Channel, key: string): TemplateInsert {
  return {
    ...(t ?? { key, channel: kanal, active: true, sort_order: 0 }),
    name: e.name.trim(),
    phase: e.phase,
    when_to_use: e.when_to_use.trim() || null,
    form_of_address: e.form_of_address || null,
    notes: e.notes.trim() || null,
    subject: e.subject.trim() || null,
    body: e.body,
  }
}

/** Kopie einer Vorlage (BAUPLAN § 3.7 „Regeln“): `variant_of`, Name „… (Kopie)“, aktiv. */
export function kopieVon(t: Template, key: string): TemplateInsert {
  return {
    key,
    channel: t.channel,
    phase: t.phase,
    name: `${t.name} (Kopie)`,
    when_to_use: t.when_to_use,
    subject: t.subject,
    body: t.body,
    notes: t.notes,
    form_of_address: t.form_of_address,
    required_consent: t.required_consent,
    variant_of: t.id,
    active: true,
    sort_order: t.sort_order + 1,
  }
}
