// Einstellungen → Ziele (BAUPLAN § 3.9 Ziele.tsx, ux § 3.10 Nr. 7, E-07, E-12, § 1.5 Nr. 45): settings.linkedin, settings.queue,
// settings.kpi_targets (8), settings.feiertage (Jahr-Wahl, Hinzufügen/Entfernen), settings.langfristig (4), settings.telefon
// (Slots A–D, max_attempts, busy_retry_minutes), E-Mail-Sequenzen nach Gesprächen (zwei Switches, schreiben nur ihren Key).
// Speichern je Block → useSettingsUpdate (Objekt-Merge). Tagesziel/Wochenbudget sind Profilwerte (member_profiles), E-07.
import { useId, useState } from 'react'
import { Button, Chip, FormField, Input, Select, Skeleton } from '@/components/ui'
import { toast } from '@/components/toast'
import { profilAusMember, useMe, useProfilSpeichern, useSettings, useSettingsUpdate } from '@/data'
import { parseDatumEingabeTag } from '@/lib/datumEingabe'
import { fmtDatum, fmtDatumKurz, heuteBerlin } from '@/lib/format'
import { FEIERTAGE_HH } from '@/lib/werktage'
import type { Settings } from '@/types/domain'
import { Block, SwitchZeile, Zeile } from './components/Formular'
import { pruefeZahl, useEntwurf, zahl } from './components/formularLogik'
import {
  KPI_FELDER,
  feiertagHinzufuegen,
  kpiWerte,
  pruefeKpi,
  pruefeLinkedin,
  pruefeQueue,
  type KpiEntwurf,
  type LinkedinEntwurf,
  type QueueEntwurf,
  type ZieleFehler as Fehler,
} from './logik'

function Zahl({
  id,
  label,
  wert,
  onChange,
  fehler,
  hinweis,
  einheit,
}: {
  id: string
  label: string
  wert: string
  onChange: (v: string) => void
  fehler?: string
  hinweis?: string
  einheit?: string
}) {
  return (
    <FormField label={label} htmlFor={id} fehler={fehler} hinweis={hinweis}>
      <Input
        id={id}
        mono
        inputMode="decimal"
        // Zahlen sind kurz; ohne size nimmt das Feld 20 ch Eigenbreite und „Werktage“ schob es bei 1024 px aus der Spalte
        size={6}
        value={wert}
        onChange={(e) => onChange(e.target.value)}
        rechts={einheit ? <span className="text-ink-3 mono-sm">{einheit}</span> : undefined}
      />
    </FormField>
  )
}

const s = (n: number | undefined | null) => (n == null ? '' : String(n))
const prozent = (x: number | undefined) => (x == null ? '' : String(Math.round(x * 1000) / 10))

// ── Block 1: LinkedIn (Profil + settings.linkedin) ────────────────────────────────────────────────
function LinkedinBlock({ settings }: { settings: Settings }) {
  const id = useId()
  const me = useMe()
  const settingsUpdate = useSettingsUpdate()
  const profil = useProfilSpeichern()
  const [fehler, setFehler] = useState<Fehler>({})
  const quelle: LinkedinEntwurf | undefined = me
    ? {
        daily_target: s(me.daily_target),
        weekly_budget: s(me.weekly_budget),
        daily_target_default: s(settings.linkedin.daily_target_default),
        warn_at_pct: s(settings.linkedin.warn_at_pct),
        pending_withdraw_days: s(settings.linkedin.pending_withdraw_days),
      }
    : undefined
  const { entwurf, setEntwurf, geaendert, zuruecksetzen } = useEntwurf(quelle)
  if (!me || !entwurf) return <Skeleton zeilen={3} />

  const speichern = async () => {
    const f = pruefeLinkedin(entwurf)
    setFehler(f)
    if (Object.values(f).some(Boolean)) return
    const aufgaben: Promise<unknown>[] = []
    if (entwurf.daily_target !== quelle?.daily_target || entwurf.weekly_budget !== quelle?.weekly_budget)
      aufgaben.push(
        profil.mutateAsync({
          ...profilAusMember(me),
          daily_target: zahl(entwurf.daily_target),
          weekly_budget: zahl(entwurf.weekly_budget),
        }),
      )
    if (
      entwurf.daily_target_default !== quelle?.daily_target_default ||
      entwurf.warn_at_pct !== quelle?.warn_at_pct ||
      entwurf.pending_withdraw_days !== quelle?.pending_withdraw_days
    )
      aufgaben.push(
        settingsUpdate.mutateAsync({
          key: 'linkedin',
          value: {
            daily_target_default: zahl(entwurf.daily_target_default),
            warn_at_pct: zahl(entwurf.warn_at_pct),
            pending_withdraw_days: zahl(entwurf.pending_withdraw_days),
          },
        }),
      )
    try {
      await Promise.all(aufgaben)
      zuruecksetzen()
      toast('Ziele gespeichert.')
    } catch {
      // Fehler-Toast kommt aus der Daten-Schicht
    }
  }

  return (
    <Block
      titel="LinkedIn"
      beschreibung="Tagesziel und Wochenbudget wirken sofort auf „Heute noch möglich“."
      onSpeichern={() => void speichern()}
      geaendert={geaendert}
      busy={profil.isPending || settingsUpdate.isPending}
    >
      <Zeile>
        <Zahl
          id={`${id}-tz`}
          label={`Tagesziel Anfragen (${me.display_name ?? 'du'})`}
          wert={entwurf.daily_target}
          onChange={(v) => setEntwurf((e) => ({ ...e, daily_target: v }))}
          fehler={fehler.daily_target}
        />
        <Zahl
          id={`${id}-wb`}
          label={`Wochenbudget (${me.display_name ?? 'du'})`}
          wert={entwurf.weekly_budget}
          onChange={(v) => setEntwurf((e) => ({ ...e, weekly_budget: v }))}
          fehler={fehler.weekly_budget}
        />
      </Zeile>
      <Zeile>
        <Zahl
          id={`${id}-std`}
          label="Standard-Tagesziel (neue Profile)"
          wert={entwurf.daily_target_default}
          onChange={(v) => setEntwurf((e) => ({ ...e, daily_target_default: v }))}
          fehler={fehler.daily_target_default}
        />
        <Zahl
          id={`${id}-warn`}
          label="Warnschwelle Budget"
          einheit="%"
          wert={entwurf.warn_at_pct}
          onChange={(v) => setEntwurf((e) => ({ ...e, warn_at_pct: v }))}
          fehler={fehler.warn_at_pct}
          hinweis="Ab diesem Anteil warnt Heute – blockiert nie."
        />
      </Zeile>
      <Zahl
        id={`${id}-zz`}
        label="Anfrage zurückziehen nach"
        einheit="Tagen"
        wert={entwurf.pending_withdraw_days}
        onChange={(v) => setEntwurf((e) => ({ ...e, pending_withdraw_days: v }))}
        fehler={fehler.pending_withdraw_days}
      />
    </Block>
  )
}

// ── Block 2: Heute-Queue (settings.queue) ─────────────────────────────────────────────────────────
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
function QueueBlock({ settings }: { settings: Settings }) {
  const id = useId()
  const update = useSettingsUpdate()
  const [fehler, setFehler] = useState<Fehler>({})
  const quelle: QueueEntwurf = {
    withdraw_weekday: s(settings.queue.withdraw_weekday),
    due_time: settings.queue.due_time,
    kommend_days: s(settings.queue.kommend_days),
  }
  const { entwurf, setEntwurf, geaendert, zuruecksetzen } = useEntwurf(quelle)
  if (!entwurf) return null
  const speichern = () => {
    const f = pruefeQueue(entwurf)
    setFehler(f)
    if (Object.values(f).some(Boolean)) return
    update.mutate(
      {
        key: 'queue',
        value: {
          withdraw_weekday: zahl(entwurf.withdraw_weekday),
          due_time: entwurf.due_time,
          kommend_days: zahl(entwurf.kommend_days),
        },
      },
      { onSuccess: () => zuruecksetzen() },
    )
  }
  return (
    <Block titel="Heute-Queue" onSpeichern={speichern} geaendert={geaendert} busy={update.isPending}>
      <Zeile>
        <FormField
          label="Zurückziehen-Tag"
          htmlFor={`${id}-wt`}
          hinweis="Sektion „Zurückziehen“ erscheint an diesem Wochentag"
        >
          <Select
            id={`${id}-wt`}
            value={entwurf.withdraw_weekday}
            onChange={(e) => setEntwurf((x) => ({ ...x, withdraw_weekday: e.target.value }))}
            optionen={WOCHENTAGE.map((w, i) => ({ value: String(i + 1), label: w }))}
          />
        </FormField>
        <FormField label="Fälligkeit um" htmlFor={`${id}-zeit`} fehler={fehler.due_time}>
          <Input
            id={`${id}-zeit`}
            mono
            type="time"
            value={entwurf.due_time}
            onChange={(e) => setEntwurf((x) => ({ ...x, due_time: e.target.value }))}
          />
        </FormField>
      </Zeile>
      <Zahl
        id={`${id}-k`}
        label="„Später“ zeigt die nächsten"
        einheit="Tage"
        wert={entwurf.kommend_days}
        onChange={(v) => setEntwurf((e) => ({ ...e, kommend_days: v }))}
        fehler={fehler.kommend_days}
      />
    </Block>
  )
}

// ── Block 3: KPI-Zielwerte ────────────────────────────────────────────────────────────────────────
function KpiBlock({ settings }: { settings: Settings }) {
  const id = useId()
  const update = useSettingsUpdate()
  const [fehler, setFehler] = useState<Fehler>({})
  const quelle = Object.fromEntries(
    KPI_FELDER.map((f) => [
      f.key,
      f.art === 'prozent' ? prozent(settings.kpi_targets[f.key]) : s(settings.kpi_targets[f.key]),
    ]),
  ) as KpiEntwurf
  const { entwurf, setEntwurf, geaendert, zuruecksetzen } = useEntwurf(quelle)
  if (!entwurf) return null
  const speichern = () => {
    const f = pruefeKpi(entwurf)
    setFehler(f)
    if (Object.values(f).some(Boolean)) return
    update.mutate({ key: 'kpi_targets', value: kpiWerte(entwurf) }, { onSuccess: () => zuruecksetzen() })
  }
  return (
    <Block
      titel="KPI-Zielwerte"
      beschreibung="Ziele neben den Kennzahlen in KPIs."
      onSpeichern={speichern}
      geaendert={geaendert}
      busy={update.isPending}
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {KPI_FELDER.map((f) => (
          <Zahl
            key={f.key}
            id={`${id}-${f.key}`}
            label={f.label}
            einheit={f.art === 'prozent' ? '%' : f.einheit}
            wert={entwurf[f.key]}
            onChange={(v) => setEntwurf((e) => ({ ...e, [f.key]: v }))}
            fehler={fehler[f.key]}
          />
        ))}
      </div>
    </Block>
  )
}

// ── Block 4: Wiedervorlage (settings.langfristig) ─────────────────────────────────────────────────
type LangKey = keyof Settings['langfristig']
const LANG_FELDER: { key: LangKey; label: string }[] = [
  { key: 'default_days', label: 'Standard (Kein Interesse, Später)' },
  { key: 'hat_partner_days', label: 'Hat Partner' },
  { key: 'nicht_erreicht_days', label: 'Nicht erreicht' },
  { key: 'kein_bedarf_days', label: 'Kein Bedarf' },
]

function LangfristigBlock({ settings }: { settings: Settings }) {
  const id = useId()
  const update = useSettingsUpdate()
  const [fehler, setFehler] = useState<Fehler>({})
  const quelle = Object.fromEntries(LANG_FELDER.map((f) => [f.key, s(settings.langfristig[f.key])])) as Record<
    LangKey,
    string
  >
  const { entwurf, setEntwurf, geaendert, zuruecksetzen } = useEntwurf(quelle)
  if (!entwurf) return null
  const speichern = () => {
    const f: Fehler = {}
    for (const feld of LANG_FELDER) f[feld.key] = pruefeZahl(entwurf[feld.key], 1, 1000, 'Tage')
    setFehler(f)
    if (Object.values(f).some(Boolean)) return
    const value = Object.fromEntries(LANG_FELDER.map((f) => [f.key, zahl(entwurf[f.key])])) as Settings['langfristig']
    update.mutate({ key: 'langfristig', value }, { onSuccess: () => zuruecksetzen() })
  }
  return (
    <Block
      titel="Wiedervorlage"
      beschreibung="Kalendertage bis zur Wiedervorlage je Reaktion, gerollt auf den nächsten Werktag."
      onSpeichern={speichern}
      geaendert={geaendert}
      busy={update.isPending}
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {LANG_FELDER.map((f) => (
          <Zahl
            key={f.key}
            id={`${id}-${f.key}`}
            label={f.label}
            einheit="Tage"
            wert={entwurf[f.key]}
            onChange={(v) => setEntwurf((e) => ({ ...e, [f.key]: v }))}
            fehler={fehler[f.key]}
          />
        ))}
      </div>
    </Block>
  )
}

// ── Block 5: Telefon (settings.telefon) ───────────────────────────────────────────────────────────
type TelefonEntwurf = { A: string; B: string; C: string; D: string; max_attempts: string; busy_retry_minutes: string }
const SLOTS = ['A', 'B', 'C', 'D'] as const

function TelefonBlock({ settings }: { settings: Settings }) {
  const id = useId()
  const update = useSettingsUpdate()
  const [fehler, setFehler] = useState<Fehler>({})
  const quelle: TelefonEntwurf = {
    A: settings.telefon.slots.A,
    B: settings.telefon.slots.B,
    C: settings.telefon.slots.C,
    D: settings.telefon.slots.D,
    max_attempts: s(settings.telefon.max_attempts),
    busy_retry_minutes: s(settings.telefon.busy_retry_minutes),
  }
  const { entwurf, setEntwurf, geaendert, zuruecksetzen } = useEntwurf(quelle)
  if (!entwurf) return null
  const speichern = () => {
    const f: Fehler = {
      max_attempts: pruefeZahl(entwurf.max_attempts, 1, 20),
      busy_retry_minutes: pruefeZahl(entwurf.busy_retry_minutes, 5, 300, 'Minuten'),
    }
    for (const slot of SLOTS) if (entwurf[slot].trim() === '') f[slot] = 'Zeitfenster eingeben'
    setFehler(f)
    if (Object.values(f).some(Boolean)) return
    update.mutate(
      {
        key: 'telefon',
        value: {
          slots: { A: entwurf.A.trim(), B: entwurf.B.trim(), C: entwurf.C.trim(), D: entwurf.D.trim() },
          max_attempts: zahl(entwurf.max_attempts),
          busy_retry_minutes: zahl(entwurf.busy_retry_minutes),
        },
      },
      { onSuccess: () => zuruecksetzen() },
    )
  }
  return (
    <Block
      titel="Telefon"
      beschreibung="Anrufzeitfenster A–D (Anzeige in der Anrufliste), Versuche je Lead, Wiederholung bei besetzt."
      onSpeichern={speichern}
      geaendert={geaendert}
      busy={update.isPending}
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {SLOTS.map((slot) => (
          <FormField key={slot} label={`Zeitfenster ${slot}`} htmlFor={`${id}-${slot}`} fehler={fehler[slot]}>
            <Input
              id={`${id}-${slot}`}
              mono
              placeholder="09:30–11:30"
              value={entwurf[slot]}
              onChange={(e) => setEntwurf((x) => ({ ...x, [slot]: e.target.value }))}
            />
          </FormField>
        ))}
      </div>
      <Zeile>
        <Zahl
          id={`${id}-max`}
          label="Versuche je Lead"
          wert={entwurf.max_attempts}
          onChange={(v) => setEntwurf((e) => ({ ...e, max_attempts: v }))}
          fehler={fehler.max_attempts}
        />
        <Zahl
          id={`${id}-busy`}
          label="Bei besetzt erneut nach"
          einheit="Minuten"
          wert={entwurf.busy_retry_minutes}
          onChange={(v) => setEntwurf((e) => ({ ...e, busy_retry_minutes: v }))}
          fehler={fehler.busy_retry_minutes}
        />
      </Zeile>
    </Block>
  )
}

// ── Block 6: Feiertage (settings.feiertage) ───────────────────────────────────────────────────────
function FeiertageBlock({ settings }: { settings: Settings }) {
  const id = useId()
  const update = useSettingsUpdate()
  const heute = heuteBerlin()
  const [jahr, setJahr] = useState(heute.slice(0, 4))
  const [eingabe, setEingabe] = useState('')
  const [fehler, setFehler] = useState<string | undefined>()
  const { entwurf, setEntwurf, geaendert, zuruecksetzen } = useEntwurf<string[]>([...settings.feiertage].sort())
  if (!entwurf) return null

  const jahre = [...new Set([...entwurf, ...FEIERTAGE_HH, heute].map((t) => t.slice(0, 4)))].sort()
  const sichtbar = entwurf.filter((t) => t.startsWith(jahr))

  const hinzufuegen = () => {
    const tag = parseDatumEingabeTag(eingabe, heute)
    if (!tag) {
      setFehler('Datum wie 24.12.2026 oder 24.12.')
      return
    }
    if (entwurf.includes(tag)) {
      setFehler(`${fmtDatum(tag)} steht schon in der Liste`)
      return
    }
    setFehler(undefined)
    setEntwurf((l) => feiertagHinzufuegen(l, tag))
    setJahr(tag.slice(0, 4))
    setEingabe('')
  }
  const entfernen = (tag: string) => setEntwurf((l) => l.filter((t) => t !== tag))
  const hamburgErgaenzen = () =>
    setEntwurf((l) => [...new Set([...l, ...FEIERTAGE_HH.filter((t) => t.startsWith(jahr))])].sort())

  const speichern = () =>
    update.mutate(
      { key: 'feiertage', value: [...entwurf].sort() },
      {
        onSuccess: () => {
          zuruecksetzen()
          toast('Feiertage gespeichert – neue Fälligkeiten rollen ab jetzt.')
        },
      },
    )

  return (
    <Block
      titel="Feiertage"
      beschreibung="Hamburg. Sequenzschritte und Wiedervorlagen rollen auf den nächsten Werktag – Änderungen wirken sofort auf neue Fälligkeiten."
      onSpeichern={speichern}
      geaendert={geaendert}
      busy={update.isPending}
    >
      <Zeile>
        <FormField label="Jahr" htmlFor={`${id}-jahr`}>
          <Select
            id={`${id}-jahr`}
            value={jahr}
            onChange={(e) => setJahr(e.target.value)}
            optionen={jahre.map((j) => ({ value: j, label: j }))}
          />
        </FormField>
        {/* size 10 (= TT.MM.JJJJ): die Eigenbreite des Felds (20 ch) + „Hinzufügen ↵“ sprengte bei 1024 px die Spalte (+55 px) */}
        <FormField label="Feiertag hinzufügen" htmlFor={`${id}-neu`} fehler={fehler} className="min-w-0 grid-cols-1">
          <Input
            id={`${id}-neu`}
            mono
            size={10}
            placeholder="24.12.2026"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault()
                hinzufuegen()
              }
            }}
            rechts={
              <Button variante="quiet" groesse="S" onClick={hinzufuegen} kbd="↵">
                Hinzufügen
              </Button>
            }
          />
        </FormField>
      </Zeile>
      {sichtbar.length === 0 ? (
        <p className="text-small text-ink-3">Keine Feiertage für {jahr} hinterlegt.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Feiertage ${jahr}`}>
          {sichtbar.map((t) => (
            <li key={t}>
              <Chip ton={t < heute ? 'ended' : 'neutral'} onRemove={() => entfernen(t)} title={fmtDatum(t)}>
                {fmtDatumKurz(t)}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variante="quiet" groesse="S" onClick={hamburgErgaenzen}>
          Gesetzliche Feiertage Hamburg {jahr} ergänzen
        </Button>
      </div>
    </Block>
  )
}

// ── Block 7: E-Mail-Sequenzen nach Gesprächen (§ 1.5 Nr. 45) ──────────────────────────────────────
function EmailAutoEnrollBlock({ settings }: { settings: Settings }) {
  const update = useSettingsUpdate()
  return (
    <Block
      titel="E-Mail-Sequenzen nach Gesprächen"
      beschreibung="Startet die Warm-Sequenz, sobald ein Gespräch als „stattgefunden“ eingetragen ist. Das E-Mail-Gate gilt weiterhin."
    >
      <div className="grid">
        <SwitchZeile
          label="Nach Erstgespräch ‚stattgefunden‘ automatisch starten"
          hinweis="Sequenz „E-Mail Erstgespräch“"
          checked={settings.email.auto_enroll_after_erstgespraech}
          busy={update.isPending}
          onCheckedChange={(an) => update.mutate({ key: 'email', value: { auto_enroll_after_erstgespraech: an } })}
        />
        <SwitchZeile
          label="Nach Strategiegespräch ‚stattgefunden‘ automatisch starten"
          hinweis="Sequenz „E-Mail Strategiegespräch“"
          checked={settings.email.auto_enroll_after_strategiegespraech}
          busy={update.isPending}
          onCheckedChange={(an) => update.mutate({ key: 'email', value: { auto_enroll_after_strategiegespraech: an } })}
        />
      </div>
    </Block>
  )
}

export function Ziele() {
  const { data: settings } = useSettings()
  if (!settings) return <Skeleton zeilen={6} />
  return (
    <div className="grid">
      <LinkedinBlock settings={settings} />
      <QueueBlock settings={settings} />
      <KpiBlock settings={settings} />
      <LangfristigBlock settings={settings} />
      <TelefonBlock settings={settings} />
      <FeiertageBlock settings={settings} />
      <EmailAutoEnrollBlock settings={settings} />
    </div>
  )
}
