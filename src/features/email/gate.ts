// BAUPLAN § 3.5 `gate.ts` – Wrapper um lib/gates.emailGate (§ 8.1 Nr. 2, ux § 3.6.3): Nachfass-Zähler (ausgehende Mails
// seit der Grundlage ohne Antwort), Sperrlisten-Treffer (E-Mail), Wortlaut je Grund. Identische Regel für Composer,
// Heute-Karte und Kanal-Karte; serverseitig wiederholt `emails_before_write` die Regeln 1, 4 und 7 (§ 1.5 Nr. 33).
import { useMemo } from 'react'
import { useEmails, useSettings, useSperrliste } from '@/data'
import {
  emailGate,
  nachfassZaehler,
  sperrlistenEintraege,
  type EmailGate,
  type EmailGrund,
  type GateLead,
  type SperrlistenTreffer,
} from '@/lib/gates'
import { EMAIL_WARNUNG_12_MONATE, emailGateText } from '@/texte/de'
import type { Email, Lead, Settings, SperrlisteEintrag, Template } from '@/types/domain'

/** Lead-Felder, die das E-Mail-Gate liest (Teilmenge von `Lead` + Firmen-Embed); Telefon/URL für Sperrlisten-Einträge ohne Lead. */
export type GateLeadEmail = GateLead &
  Partial<Pick<Lead, 'first_name' | 'full_name' | 'linkedin_url_norm'>> & { id?: string | null }

export type EmailGateErgebnis = EmailGate & {
  /** Grund-Text für Tooltip/Hinweis (ux § 3.3.3, § 3.6.3). */
  text: string | null
  /** Hinweistext zur Warnung (Regel 2) – Öffnen erst nach „Trotzdem öffnen“. */
  warnungText: string | null
  nachfassZaehler: number
  transaktional: boolean
}

// Nachfass-Zähler und GESENDET_STATUS: lib/gates (Integration – eine Regel für Composer, Heute-Karte, Kanal-Karte).

/** Sperrlisten-Treffer der Person (lib/gates.sperrlistenEintraege); `emailGate` prüft die Kanäle. */
export function sperrlistenTreffer(
  eintraege: readonly SperrlisteEintrag[] | undefined,
  lead: {
    id?: string | null
    email?: string | null
    phone_e164?: string | null
    linkedin_url_norm?: string | null
  },
): SperrlistenTreffer {
  const treffer = sperrlistenEintraege(eintraege, lead)
  return treffer.length ? treffer : false
}

/** Wortlaut je Grund (ux § 3.3.3, § 3.6.3; `offene_platzhalter` ist Regel 5 aus § 3.1.9a) – Quelle texte/de.ts. */
export function gateText(grund: EmailGrund | 'offene_platzhalter', lead?: GateLeadEmail): string {
  return emailGateText(grund, lead?.first_name)
}

export type GateEingabe = {
  lead: GateLeadEmail | null | undefined
  emails?: readonly Email[]
  sperrliste?: readonly SperrlisteEintrag[]
  template?: Pick<Template, 'phase'> | null
  settings?: Pick<Settings, 'email'> | null
  /** Offene Platzhalter im Text (Regel 5). */
  offen?: readonly string[]
  /** Nur für Tests: Bezugstag. */
  heute?: Date | string
}

/** Reine Gate-Funktion (alle sieben Regeln, Transaktions-Ausnahme). */
export function berechneGate({ lead, emails = [], sperrliste, template, settings, offen = [], heute }: GateEingabe) {
  const transaktional = template?.phase === 'transaktional'
  if (!lead) {
    return {
      erlaubt: false,
      grund: 'keine_adresse',
      text: gateText('keine_adresse'),
      warnungText: null,
      nachfassZaehler: 0,
      transaktional,
    } satisfies EmailGateErgebnis
  }
  const zaehler = nachfassZaehler(emails, {
    email_consent_at: lead.email_consent_at ?? null,
    last_inbound_at: lead.last_inbound_at ?? null,
  })
  // Ganze Person (Review): manuelle Einträge (M8) haben keine lead_id und hängen oft an URL oder Telefon mit allen Kanälen
  const treffer = sperrlistenTreffer(sperrliste, {
    id: lead.id ?? null,
    email: lead.email ?? null,
    phone_e164: lead.phone_e164 ?? null,
    linkedin_url_norm: lead.linkedin_url_norm ?? null,
  })
  const g = emailGate(lead, zaehler, treffer, {
    transaktional,
    maxNachfass: settings?.email?.max_followups_per_consent,
    maxAlterMonate: settings?.email?.consent_max_age_months,
    heute,
  })
  // Regel 5: offene Platzhalter sperren Öffnen/mailto/Kopieren (§ 3.1.9a) – nach den rechtlichen Gründen, damit der
  // rechtliche Grund im Tooltip Vorrang hat.
  if (g.erlaubt && offen.length > 0) {
    return {
      erlaubt: false,
      grund: undefined,
      warnung: g.warnung,
      text: gateText('offene_platzhalter'),
      warnungText: g.warnung ? EMAIL_WARNUNG_12_MONATE : null,
      nachfassZaehler: zaehler,
      transaktional,
    } satisfies EmailGateErgebnis
  }
  return {
    ...g,
    text: g.grund ? gateText(g.grund, lead) : null,
    warnungText: g.warnung ? EMAIL_WARNUNG_12_MONATE : null,
    nachfassZaehler: zaehler,
    transaktional,
  } satisfies EmailGateErgebnis
}

/** Hook-Variante: lädt E-Mails des Leads, Sperrliste und Settings; `lead` kommt vom Aufrufer (`useLead` oder Queue-Zeile). */
export function useEmailGate(
  lead: (GateLeadEmail & { id?: string | null }) | null | undefined,
  template?: Pick<Template, 'phase'> | null,
  offen: readonly string[] = [],
): EmailGateErgebnis {
  const leadId = (lead as { id?: string | null } | null | undefined)?.id ?? null
  const { data: emails } = useEmails(leadId)
  const { data: sperrliste } = useSperrliste()
  const { data: settings } = useSettings()
  const offenKey = offen.join('\u0000')
  return useMemo(
    () =>
      berechneGate({ lead, emails, sperrliste, template, settings, offen: offenKey ? offenKey.split('\u0000') : [] }),
    [lead, emails, sperrliste, template, settings, offenKey],
  )
}
