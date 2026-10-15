// Einstellungen → Profil (BAUPLAN § 3.9 Profil.tsx, ux § 3.10 Nr. 1, E-11): Anzeigename/E-Mail read-only, Kürzel, LinkedIn-Plan
// (→ Wochenbudget-Vorschlag, ändert nur das Feld), Wochenbudget, Tagesziel, Rufnummer E.164 (lib/telefon), Signatur, Calendly,
// Kanäle aktiv (preferences.kanaele), Benachrichtigungen (preferences.realtime_toasts). Upsert der eigenen member_profiles-Zeile.
import { useId, useState } from 'react'
import { Button, FormField, Input, Select, Skeleton, Textarea } from '@/components/ui'
import {
  liesPreferences,
  mergePreferences,
  profilAusMember,
  useMe,
  useProfilSpeichern,
  useSettings,
  type Preferences,
} from '@/data'
import { fmtTelefon, istGueltig, nachE164 } from '@/lib/telefon'
import { toast } from '@/components/toast'
import { Block, SwitchZeile, Zeile } from './components/Formular'
import { useEntwurf, zahl } from './components/formularLogik'
import { PLAN_LABEL, pruefeProfil, type Plan, type ProfilEntwurf, type ProfilFehler } from './logik'

export function Profil() {
  const id = useId()
  const me = useMe()
  const settings = useSettings().data
  const speichern = useProfilSpeichern()
  const [fehler, setFehler] = useState<ProfilFehler>({})

  const quelle: ProfilEntwurf | undefined = me
    ? {
        short_name: me.short_name ?? '',
        linkedin_plan: me.linkedin_plan ?? 'basic',
        weekly_budget: String(me.weekly_budget ?? 0),
        daily_target: String(me.daily_target ?? 0),
        rufnummer: me.caller_number_e164 ? fmtTelefon(me.caller_number_e164) : '',
        signature: me.signature ?? '',
        calendly_url: me.calendly_url ?? '',
        preferences: liesPreferences(me.preferences),
      }
    : undefined
  const { entwurf, setEntwurf, geaendert, zuruecksetzen } = useEntwurf(quelle)

  if (!me || !entwurf) return <Skeleton zeilen={6} />

  const vorschlag = settings?.linkedin.weekly_budget_default[entwurf.linkedin_plan]
  const vorschlagAbweichend = vorschlag !== undefined && String(vorschlag) !== entwurf.weekly_budget

  const absenden = () => {
    const f = pruefeProfil(entwurf)
    setFehler(f)
    if (Object.keys(f).length) return
    const e164 = entwurf.rufnummer.trim() === '' ? null : nachE164(entwurf.rufnummer)
    speichern.mutate(
      {
        ...profilAusMember(me),
        short_name: entwurf.short_name.trim() || null,
        linkedin_plan: entwurf.linkedin_plan,
        weekly_budget: zahl(entwurf.weekly_budget),
        daily_target: zahl(entwurf.daily_target),
        caller_number_e164: e164,
        signature: entwurf.signature.trim() || null,
        calendly_url: entwurf.calendly_url.trim() || null,
        preferences: mergePreferences(me.preferences, entwurf.preferences),
      },
      {
        onSuccess: () => {
          zuruecksetzen()
          toast('Profil gespeichert.')
        },
      },
    )
  }

  const rufnummerFormatieren = () => {
    const e164 = nachE164(entwurf.rufnummer)
    if (e164 && istGueltig(e164)) setEntwurf((e) => ({ ...e, rufnummer: fmtTelefon(e164) }))
  }

  const prefSetzen = (fn: (p: Preferences) => Preferences) =>
    setEntwurf((e) => ({ ...e, preferences: fn(e.preferences) }))

  return (
    <div className="grid">
      <Block titel="Person" onSpeichern={absenden} geaendert={geaendert} busy={speichern.isPending}>
        <Zeile>
          <FormField label="Anzeigename" htmlFor={`${id}-name`} hinweis="Kommt aus dem Konto – in v1 nicht änderbar.">
            <Input id={`${id}-name`} value={me.display_name ?? ''} readOnly disabled />
          </FormField>
          <FormField
            label="Kürzel"
            htmlFor={`${id}-kuerzel`}
            fehler={fehler.short_name}
            hinweis="Avatar und Tabelle (VS / MM)"
          >
            <Input
              id={`${id}-kuerzel`}
              mono
              maxLength={3}
              value={entwurf.short_name}
              onChange={(e) => setEntwurf((x) => ({ ...x, short_name: e.target.value.toUpperCase() }))}
            />
          </FormField>
        </Zeile>
        <FormField label="E-Mail" htmlFor={`${id}-email`} hinweis="Login-Adresse – nur der Lead ändert sie.">
          <Input id={`${id}-email`} value={me.email ?? ''} readOnly disabled />
        </FormField>
        <Zeile>
          <FormField label="LinkedIn-Plan" htmlFor={`${id}-plan`}>
            <Select
              id={`${id}-plan`}
              value={entwurf.linkedin_plan}
              onChange={(e) => setEntwurf((x) => ({ ...x, linkedin_plan: e.target.value as Plan }))}
              optionen={(Object.keys(PLAN_LABEL) as Plan[]).map((p) => ({ value: p, label: PLAN_LABEL[p] }))}
            />
          </FormField>
          <FormField
            label="Wochenbudget Anfragen"
            htmlFor={`${id}-budget`}
            fehler={fehler.weekly_budget}
            hinweis={
              vorschlagAbweichend
                ? `Vorschlag für ${PLAN_LABEL[entwurf.linkedin_plan]}: ${vorschlag}`
                : 'Anfragen je Woche'
            }
          >
            <Input
              id={`${id}-budget`}
              mono
              inputMode="numeric"
              value={entwurf.weekly_budget}
              onChange={(e) => setEntwurf((x) => ({ ...x, weekly_budget: e.target.value }))}
              rechts={
                vorschlagAbweichend ? (
                  <Button
                    variante="quiet"
                    groesse="S"
                    onClick={() => setEntwurf((x) => ({ ...x, weekly_budget: String(vorschlag) }))}
                  >
                    {vorschlag} übernehmen
                  </Button>
                ) : undefined
              }
            />
          </FormField>
        </Zeile>
        <Zeile>
          <FormField label="Tagesziel Anfragen" htmlFor={`${id}-ziel`} fehler={fehler.daily_target}>
            <Input
              id={`${id}-ziel`}
              mono
              inputMode="numeric"
              value={entwurf.daily_target}
              onChange={(e) => setEntwurf((x) => ({ ...x, daily_target: e.target.value }))}
            />
          </FormField>
          <FormField
            label="Rufnummer"
            htmlFor={`${id}-tel`}
            fehler={fehler.rufnummer}
            hinweis="Pflicht vor dem ersten Anruf – nie unterdrückt anrufen."
          >
            <Input
              id={`${id}-tel`}
              mono
              type="tel"
              inputMode="tel"
              placeholder="+49 40 …"
              value={entwurf.rufnummer}
              onChange={(e) => setEntwurf((x) => ({ ...x, rufnummer: e.target.value }))}
              onBlur={rufnummerFormatieren}
            />
          </FormField>
        </Zeile>
        <FormField
          label="E-Mail-Signatur"
          htmlFor={`${id}-sig`}
          hinweis="Pflichtbaustein: Anschrift (Firma, Straße, Ort) – Platzhalter [Signatur] in E-Mail-Vorlagen."
        >
          <Textarea
            id={`${id}-sig`}
            rows={4}
            value={entwurf.signature}
            onChange={(e) => setEntwurf((x) => ({ ...x, signature: e.target.value }))}
            onSubmit={absenden}
          />
        </FormField>
        <FormField
          label="Calendly-URL"
          htmlFor={`${id}-cal`}
          fehler={fehler.calendly_url}
          hinweis="Platzhalter [Termin-Link]"
        >
          <Input
            id={`${id}-cal`}
            type="url"
            placeholder="https://calendly.com/…"
            value={entwurf.calendly_url}
            onChange={(e) => setEntwurf((x) => ({ ...x, calendly_url: e.target.value }))}
          />
        </FormField>
      </Block>

      <Block
        titel="Kanäle aktiv"
        beschreibung="Steuert, welche Kanalzeilen in Heute erscheinen. Fällige Schritte bleiben erhalten."
        onSpeichern={absenden}
        geaendert={geaendert}
        busy={speichern.isPending}
      >
        <div className="grid">
          <SwitchZeile
            label="LinkedIn"
            checked={entwurf.preferences.kanaele.linkedin}
            onCheckedChange={(an) => prefSetzen((p) => ({ ...p, kanaele: { ...p.kanaele, linkedin: an } }))}
          />
          <SwitchZeile
            label="Telefon"
            checked={entwurf.preferences.kanaele.telefon}
            onCheckedChange={(an) => prefSetzen((p) => ({ ...p, kanaele: { ...p.kanaele, telefon: an } }))}
          />
          <SwitchZeile
            label="E-Mail"
            checked={entwurf.preferences.kanaele.email}
            onCheckedChange={(an) => prefSetzen((p) => ({ ...p, kanaele: { ...p.kanaele, email: an } }))}
          />
        </div>
      </Block>

      <Block titel="Benachrichtigungen" onSpeichern={absenden} geaendert={geaendert} busy={speichern.isPending}>
        <div className="grid">
          <SwitchZeile
            label="Realtime-Toasts"
            hinweis="„Mike hat dir … übergeben“ und Termine der anderen Person"
            checked={entwurf.preferences.realtime_toasts}
            onCheckedChange={(an) => prefSetzen((p) => ({ ...p, realtime_toasts: an }))}
          />
        </div>
      </Block>
    </div>
  )
}
