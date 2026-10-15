// BAUPLAN § 3.5 `useComposer.ts` – Zustand des Composers: Vorlage, Platzhalter, Pflichtbausteine, Threading, Gate, Entwurf,
// Statusfolge draft → opened_in_client → sent_confirmed (+ complete_step bei Sequenzschritt), Rückkehr-Prompt „Gesendet?“.
// Konflikt-Entscheid: § 3.5 sagt „useEmailErstellen({ status: 'draft' }) beim Öffnen“ – hier entsteht die Zeile beim ersten
// Versandweg/„Entwurf speichern“ (kein leerer Entwurf je Blick in den Composer); ein vorhandener Entwurf desselben Leads
// (gleiches Enrollment bzw. gleiche Vorlage) wird wiederverwendet. M-10/Esc „Entwurf bleibt“ gelten unverändert.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/components/toast'
import {
  useCompleteStep,
  useEmailErstellen,
  useEmails,
  useEmailsStatus,
  useEmailUpdate,
  useLead,
  useLeadUpdate,
  useMe,
  useMeId,
  useSequencesIndex,
  useSettings,
  useSperrliste,
  useTemplates,
  type EmailInsert,
} from '@/data'
import { heuteBerlin } from '@/lib/format'
import { fuellen, type PlatzhalterKontext } from '@/lib/platzhalter'
import { berlinTag } from '@/lib/zeit'
import { kopieren as inZwischenablage } from '@/lib/zwischenablage'
import { TOAST } from '@/texte/de'
import type { Email, EmailChannel, Lead, Member, Settings, Template } from '@/types/domain'
import { GESENDET_STATUS } from '@/lib/gates'
import { berechneGate, type EmailGateErgebnis } from './gate'
import { BODY_MAX, composeUrl, mailtoUrl, reBetreff } from './gmail'

export type ComposerStatus = 'laden' | 'bearbeiten' | 'geoeffnet' | 'bestaetigen' | 'fertig'

export type ComposerParams = {
  leadId: string
  vorlageId?: string | null
  enrollmentId?: string | null
  schrittId?: string | null
  /** Nach „Ja“ (gesendet) oder „Verwerfen“: Sheet schließen. */
  onFertig?: () => void
}

/** Anrede im Prompt: „Herrn Lindner“ / „Frau Lindner“ / voller Name. */
export function anredeName(lead: Pick<Lead, 'salutation' | 'last_name' | 'full_name' | 'first_name'>): string {
  const nach = lead.last_name?.trim()
  if (nach && lead.salutation === 'herr') return `Herrn ${nach}`
  if (nach && lead.salutation === 'frau') return `Frau ${nach}`
  return lead.full_name?.trim() || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'die Person'
}

/** Darf die Vorlage mit dieser Grundlage benutzt werden? Transaktional immer; sonst `required_consent` leer oder passend. */
export function vorlageErlaubt(
  t: Pick<Template, 'phase' | 'required_consent' | 'channel' | 'active'>,
  basis: Lead['email_consent_basis'],
): boolean {
  if (t.channel !== 'email' || !t.active) return false
  if (t.phase === 'transaktional') return true
  if (!t.required_consent || t.required_consent.length === 0) return basis !== 'none' && basis !== 'revoked'
  return t.required_consent.includes(basis)
}

export type Bausteine = {
  widerspruch: string | null
  signatur: string | null
  datenschutz: string | null
  text: string
}

/** § 8.1 Nr. 4 – Pflichtbausteine (nicht editierbar): Widerspruchssatz (nicht transaktional), Signatur, Datenschutz-Link (erste Mail eines Threads). */
export function bausteine(
  settings: Pick<Settings, 'email'> | null | undefined,
  me: Pick<Member, 'signature'> | null | undefined,
  opts: { transaktional: boolean; ersteMail: boolean },
): Bausteine {
  const widerspruch = !opts.transaktional ? settings?.email?.objection_sentence?.trim() || null : null
  const signatur = me?.signature?.trim() || null
  const url = settings?.email?.privacy_url?.trim()
  const datenschutz = opts.ersteMail && url ? `Datenschutzhinweise für Geschäftskontakte: ${url}` : null
  const text = [widerspruch, signatur, datenschutz].filter((x): x is string => !!x).join('\n\n')
  return { widerspruch, signatur, datenschutz, text }
}

/** Vollständiger Versandtext: Nachricht + Leerzeile + Bausteine. */
export function bodyZusammensetzen(nachricht: string, bausteineText: string): string {
  const n = nachricht.trimEnd()
  return bausteineText ? `${n}\n\n${bausteineText}` : n
}

/** Thread-Mails desselben Enrollments (ohne Enrollment: alle gesendeten an den Lead), älteste zuerst. */
export function threadMails(emails: readonly Email[], enrollmentId: string | null | undefined): Email[] {
  return emails
    .filter(
      (e) =>
        e.direction === 'out' &&
        GESENDET_STATUS.includes(e.status) &&
        (enrollmentId ? e.enrollment_id === enrollmentId : true),
    )
    .sort((a, b) => (a.sent_at ?? a.status_at).localeCompare(b.sent_at ?? b.status_at))
}

/** Vorhandenen Entwurf wiederverwenden: gleiches Enrollment, sonst gleiche Vorlage. */
export function passenderEntwurf(
  emails: readonly Email[],
  p: { enrollmentId?: string | null; templateId?: string | null },
): Email | null {
  const entwuerfe = emails.filter(
    (e) => e.direction === 'out' && (e.status === 'draft' || e.status === 'opened_in_client'),
  )
  if (p.enrollmentId) return entwuerfe.find((e) => e.enrollment_id === p.enrollmentId) ?? null
  if (p.templateId) return entwuerfe.find((e) => !e.enrollment_id && e.template_id === p.templateId) ?? null
  return null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function useComposer({ leadId, vorlageId, enrollmentId, schrittId, onFertig }: ComposerParams) {
  const meId = useMeId()
  const me = useMe()
  const { data: lead, isPending: leadLaedt } = useLead(leadId)
  const { data: settings } = useSettings()
  const { data: templates } = useTemplates({ channel: 'email', active: true })
  const { data: emails } = useEmails(leadId)
  const { data: sperrliste } = useSperrliste()
  const { data: sequenzen } = useSequencesIndex()
  const { data: heuteGesendetAlle } = useEmailsStatus(meId, ['sent_confirmed'])
  const erstellen = useEmailErstellen()
  const aktualisieren = useEmailUpdate()
  const schrittErledigen = useCompleteStep()
  const leadUpdate = useLeadUpdate()

  const schritt = schrittId ? (sequenzen?.stepsById.get(schrittId) ?? null) : null
  // `?vorlage=` darf ID oder Key sein (Anruf-Vorschlag „Terminbestätigung per E-Mail“ schickt den Key aus lib/vorlagenKeys) – Review
  const vorlageParam = useMemo(
    () =>
      vorlageId
        ? ((templates ?? []).find((t) => t.id === vorlageId)?.id ??
          (templates ?? []).find((t) => t.key === vorlageId)?.id ??
          vorlageId)
        : null,
    [templates, vorlageId],
  )
  const basis = lead?.email_consent_basis ?? 'none'
  const vorlagen = useMemo(() => (templates ?? []).filter((t) => vorlageErlaubt(t, basis)), [templates, basis])

  const [templateWahl, setTemplateWahl] = useState<string | null>(null)
  const [werte, setWerte] = useState<Record<string, string>>({})
  const [quelle, setQuelle] = useState<string | null>(null)
  const [betreffOverride, setBetreffOverride] = useState<string | null>(null)
  const [empfaengerOverride, setEmpfaengerOverride] = useState<string | null>(null)
  const [anrede, setAnrede] = useState<'herr' | 'frau' | null>(null)
  const [trotzdem, setTrotzdem] = useState(false)
  const [neuerEntwurfId, setNeuerEntwurfId] = useState<string | null>(null)
  const [verlauf, setStatus] = useState<Exclude<ComposerStatus, 'laden'>>('bearbeiten')
  const [kanal, setKanal] = useState<EmailChannel>('gmail_compose')

  // Vorhandener Entwurf (gleiches Enrollment, sonst gleiche Vorlage) – abgeleitet, nicht per Effekt gesetzt.
  const vorhandener = useMemo(
    () =>
      emails
        ? passenderEntwurf(emails, {
            enrollmentId,
            templateId: templateWahl ?? vorlageParam ?? schritt?.template_id ?? null,
          })
        : null,
    [emails, enrollmentId, templateWahl, vorlageParam, schritt],
  )
  const entwurfId = neuerEntwurfId ?? vorhandener?.id ?? null

  // Vorlage: gewählt · ?vorlage · Entwurf · Sequenzschritt · erste erlaubte.
  const templateId = useMemo(() => {
    const erlaubt = (id: string | null | undefined) => (id && vorlagen.some((t) => t.id === id) ? id : null)
    return (
      erlaubt(templateWahl) ??
      erlaubt(vorlageParam) ??
      erlaubt(vorhandener?.template_id) ??
      erlaubt(schritt?.template_id) ??
      vorlagen[0]?.id ??
      null
    )
  }, [templateWahl, vorlageParam, vorhandener, schritt, vorlagen])

  const vorlage = useMemo(() => vorlagen.find((t) => t.id === templateId) ?? null, [vorlagen, templateId])
  const transaktional = vorlage?.phase === 'transaktional'
  const thread = useMemo(() => threadMails(emails ?? [], enrollmentId), [emails, enrollmentId])
  const ersteMail = thread.length === 0
  const bst = useMemo(
    () => bausteine(settings, me, { transaktional, ersteMail }),
    [settings, me, transaktional, ersteMail],
  )

  /** Text des vorhandenen Entwurfs ohne angehängte Bausteine (nur solange keine eigene Bearbeitung vorliegt). */
  const entwurfText = useMemo(() => {
    const b = vorhandener?.body_text
    if (!b) return null
    return bst.text && b.endsWith(bst.text) ? b.slice(0, b.length - bst.text.length).trimEnd() : b
  }, [vorhandener, bst.text])

  const status: ComposerStatus = leadLaedt || !templates ? 'laden' : verlauf

  const meeting = useMemo(
    () =>
      (lead?.meetings ?? [])
        .filter((m) => m.status === 'stattgefunden')
        .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))[0] ?? null,
    [lead],
  )
  const ctx: PlatzhalterKontext = useMemo(
    () => ({ werte, me: me ?? null, meeting, anrede }),
    [werte, me, meeting, anrede],
  )
  const quelleText = quelle ?? entwurfText ?? vorlage?.body ?? ''
  const fuell = useMemo(
    () => (lead ? fuellen(quelleText, lead, ctx) : { text: quelleText, offen: [], gefuellt: {} }),
    [quelleText, lead, ctx],
  )
  const betreffFuell = useMemo(() => {
    const erster = thread[0]?.subject?.trim()
    if (erster) return { text: reBetreff(erster), offen: [] as string[] }
    return lead && vorlage?.subject
      ? fuellen(vorlage.subject, lead, ctx)
      : { text: vorlage?.subject ?? '', offen: [] as string[] }
  }, [thread, lead, vorlage, ctx])
  const betreff = betreffOverride ?? (quelle === null ? vorhandener?.subject : null) ?? betreffFuell.text
  // Offene Platzhalter aus Text und (automatischem) Betreff – beide sperren Öffnen/Kopieren (§ 3.1.9a).
  const offen = useMemo(() => {
    const aus = betreffOverride === null ? betreffFuell.offen : []
    return [...fuell.offen, ...aus.filter((n) => !fuell.offen.includes(n))]
  }, [fuell.offen, betreffFuell.offen, betreffOverride])
  const empfaenger = empfaengerOverride ?? vorhandener?.to_address ?? lead?.email ?? ''
  const bodyVoll = bodyZusammensetzen(fuell.text, bst.text)
  const zeichen = bodyVoll.length
  const zuLang = zeichen > BODY_MAX

  const gate: EmailGateErgebnis = useMemo(
    () =>
      berechneGate({
        lead: lead ? { ...lead, email: empfaenger } : lead,
        emails,
        sperrliste,
        template: vorlage,
        settings,
        offen,
      }),
    [lead, empfaenger, emails, sperrliste, vorlage, settings, offen],
  )
  const empfaengerGueltig = EMAIL_RE.test(empfaenger.trim())
  const warnungOffen = !!gate.warnung && !trotzdem
  const heuteGesendet = useMemo(() => {
    const heute = heuteBerlin()
    return (heuteGesendetAlle ?? []).filter((e) => e.sent_at && berlinTag(e.sent_at) === heute).length
  }, [heuteGesendetAlle])

  /** Grund, warum Öffnen/Kopieren gesperrt ist (Tooltip), sonst null. */
  const sperrGrund: string | null = !gate.erlaubt
    ? gate.text
    : !empfaengerGueltig
      ? 'Adresse fehlt oder ist ungültig.'
      : !vorlage
        ? 'Keine Vorlage passt zur Grundlage.'
        : null
  const gmailSperrGrund = sperrGrund ?? (zuLang ? 'Zu lang für den Gmail-Link – Kopieren nutzen.' : null)

  /** Entwurf anlegen oder aktualisieren; liefert die Zeile. */
  const entwurfSichern = useCallback(
    async (channel: EmailChannel, patchStatus?: Email['status']): Promise<Email> => {
      if (!lead) throw new Error('Lead fehlt')
      setKanal(channel)
      const felder: EmailInsert = {
        lead_id: lead.id,
        member_id: meId,
        direction: 'out',
        channel,
        template_id: vorlage?.id ?? null,
        enrollment_id: enrollmentId ?? null,
        step_id: schrittId ?? null,
        from_address: me?.email_address ?? null,
        to_address: empfaenger.trim().toLowerCase(),
        subject: betreff,
        body_text: bodyVoll,
        status: patchStatus ?? 'draft',
      }
      if (entwurfId) {
        const patch = {
          channel,
          template_id: felder.template_id,
          enrollment_id: felder.enrollment_id,
          step_id: felder.step_id,
          from_address: felder.from_address,
          to_address: felder.to_address,
          subject: felder.subject,
          body_text: felder.body_text,
          status: felder.status,
        }
        return aktualisieren.mutateAsync({ id: entwurfId, leadId: lead.id, patch })
      }
      // Statusfolge wörtlich (§ 3.5): erst `draft`, dann der Übergang (`opened_in_client` / `sent_confirmed`) als Patch.
      const z = await erstellen.mutateAsync({ ...felder, status: 'draft' })
      setNeuerEntwurfId(z.id)
      if (patchStatus && patchStatus !== 'draft')
        return aktualisieren.mutateAsync({ id: z.id, leadId: lead.id, patch: { status: patchStatus, channel } })
      return z
    },
    [
      lead,
      meId,
      vorlage,
      enrollmentId,
      schrittId,
      me,
      empfaenger,
      betreff,
      bodyVoll,
      entwurfId,
      aktualisieren,
      erstellen,
    ],
  )

  const inGmailOeffnen = useCallback(async (): Promise<'trotzdem' | 'geoeffnet' | 'gesperrt'> => {
    if (gmailSperrGrund || !lead) return 'gesperrt'
    if (warnungOffen) {
      setTrotzdem(true)
      return 'trotzdem'
    }
    const url = composeUrl({ authuser: me?.email_address ?? null, to: empfaenger, su: betreff, body: bodyVoll })
    try {
      await entwurfSichern('gmail_compose', 'opened_in_client')
    } catch {
      return 'gesperrt'
    }
    window.open(url, '_blank', 'noopener')
    setStatus('geoeffnet')
    return 'geoeffnet'
  }, [gmailSperrGrund, lead, warnungOffen, me, empfaenger, betreff, bodyVoll, entwurfSichern])

  const mailtoOeffnen = useCallback(async (): Promise<'trotzdem' | 'geoeffnet' | 'gesperrt'> => {
    if (sperrGrund || !lead) return 'gesperrt'
    if (warnungOffen) {
      setTrotzdem(true)
      return 'trotzdem'
    }
    try {
      await entwurfSichern('mailto', 'opened_in_client')
    } catch {
      return 'gesperrt'
    }
    window.location.assign(mailtoUrl({ to: empfaenger, su: betreff, body: bodyVoll }))
    setStatus('bestaetigen')
    return 'geoeffnet'
  }, [sperrGrund, lead, warnungOffen, empfaenger, betreff, bodyVoll, entwurfSichern])

  /** Kopieren (Betreff/Text getrennt): Text kopieren = Versandweg „manual“ → Entwurf `opened_in_client`, Prompt nach Rückkehr. */
  const kopieren = useCallback(
    async (was: 'betreff' | 'text'): Promise<'ok' | 'fallback' | 'gesperrt'> => {
      if (sperrGrund || !lead) return 'gesperrt'
      if (warnungOffen) {
        setTrotzdem(true)
        return 'gesperrt'
      }
      const r = await inZwischenablage(was === 'betreff' ? betreff : bodyVoll)
      if (r === 'ok') toast(TOAST.kopiert)
      if (was === 'text') {
        try {
          await entwurfSichern('manual', 'opened_in_client')
          setStatus('geoeffnet')
        } catch {
          return 'gesperrt'
        }
      }
      return r
    },
    [sperrGrund, lead, warnungOffen, betreff, bodyVoll, entwurfSichern],
  )

  const entwurfSpeichern = useCallback(async () => {
    if (!lead) return
    try {
      await entwurfSichern(kanal)
      toast(TOAST.entwurfGespeichert)
    } catch {
      /* Toast kommt aus der Daten-Schicht */
    }
  }, [lead, kanal, entwurfSichern])

  const verwerfen = useCallback(async () => {
    if (entwurfId && lead) {
      try {
        await aktualisieren.mutateAsync({
          id: entwurfId,
          leadId: lead.id,
          patch: { status: 'failed', bounce_reason: 'verworfen' },
        })
      } catch {
        return
      }
      toast(TOAST.entwurfVerworfen)
    }
    setStatus('fertig')
    onFertig?.()
  }, [entwurfId, lead, aktualisieren, onFertig])

  /** „Gesendet? Ja“ → sent_confirmed (+ Sequenzschritt erledigt, M-06); Fehler des Triggers kommt als Fehler-Toast (M-14). */
  const gesendetJa = useCallback(async (): Promise<boolean> => {
    if (!lead) return false
    try {
      const z = entwurfId
        ? await aktualisieren.mutateAsync({
            id: entwurfId,
            leadId: lead.id,
            patch: { status: 'sent_confirmed', sent_at: new Date().toISOString(), channel: kanal },
          })
        : await entwurfSichern(kanal, 'sent_confirmed')
      if (enrollmentId) {
        await schrittErledigen.mutateAsync({
          enrollmentId,
          leadId: lead.id,
          outcome: 'gesendet',
          templateId: vorlage?.id ?? null,
        })
      }
      toast(TOAST.emailGesendet(vorlage?.name))
      setNeuerEntwurfId(z.id)
      setStatus('fertig')
      onFertig?.()
      return true
    } catch {
      return false
    }
  }, [lead, entwurfId, aktualisieren, kanal, entwurfSichern, enrollmentId, schrittErledigen, vorlage, onFertig])

  const gesendetNein = useCallback(() => setStatus('bearbeiten'), [])

  // Rückkehr ins Fenster (window focus / sichtbar) → Prompt „Mail an … gesendet?“
  useEffect(() => {
    if (status !== 'geoeffnet') return
    const h = () => setStatus('bestaetigen')
    const v = () => {
      if (document.visibilityState === 'visible') h()
    }
    window.addEventListener('focus', h)
    document.addEventListener('visibilitychange', v)
    return () => {
      window.removeEventListener('focus', h)
      document.removeEventListener('visibilitychange', v)
    }
  }, [status])

  const vorlageWaehlen = useCallback((id: string) => {
    setTemplateWahl(id)
    setQuelle(null)
    setBetreffOverride(null)
    setWerte({})
  }, [])

  const wertSetzen = useCallback((name: string, wert: string) => setWerte((w) => ({ ...w, [name]: wert })), [])

  /** `[Anrede]` bei `salutation = neutral`: einmal fragen, am Lead speichern (§ 3.1.9a). */
  const anredeSetzen = useCallback(
    (a: 'herr' | 'frau') => {
      setAnrede(a)
      if (lead && lead.salutation === 'neutral')
        void leadUpdate
          .mutateAsync({ id: lead.id, erwartetUpdatedAt: lead.updated_at, patch: { salutation: a } })
          .catch(() => undefined)
    },
    [lead, leadUpdate],
  )

  return {
    status,
    laedt: leadLaedt || !templates,
    lead: lead ?? null,
    me: me ?? null,
    settings: settings ?? null,
    vorlagen,
    vorlage,
    transaktional,
    ersteMail,
    thread,
    werte,
    quelle: quelleText,
    text: fuell.text,
    offen,
    gefuellt: fuell.gefuellt,
    bausteine: bst,
    bodyVoll,
    zeichen,
    zuLang,
    betreff,
    empfaenger,
    empfaengerGueltig,
    adresseVomLead: !!lead?.email && empfaenger.trim().toLowerCase() === lead.email.toLowerCase(),
    gate,
    warnungOffen,
    trotzdem,
    sperrGrund,
    gmailSperrGrund,
    heuteGesendet,
    entwurfId,
    busy: erstellen.isPending || aktualisieren.isPending || schrittErledigen.isPending,
    anredeName: lead ? anredeName(lead) : 'die Person',
    vorlageWaehlen,
    wertSetzen,
    textSetzen: setQuelle,
    betreffSetzen: setBetreffOverride,
    empfaengerSetzen: setEmpfaengerOverride,
    anredeSetzen,
    inGmailOeffnen,
    mailtoOeffnen,
    kopieren,
    entwurfSpeichern,
    verwerfen,
    gesendetJa,
    gesendetNein,
  }
}

export type Composer = ReturnType<typeof useComposer>
