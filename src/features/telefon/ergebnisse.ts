// M3 – Die 15 Anruf-Ergebnisse (BAUPLAN § 3.4 „Ergebnis → Aufruf“, ux § 3.5.3, Seed `call_outcome_defs`):
// Taste, Gruppe, Kurztext für den Button, Pflichtfelder im Wrap-up und die reine Parameter-Funktion für `rpc.logCall`.
// `log_call` erledigt die DB-Folgen (Rückruf-Tasks, Enrollments, Stufe, Meeting); das UI liefert nur Parameter.
import type { rpc } from '@/data/rpc'
import { tagZuDate } from '@/lib/zeit'
import { ERGEBNIS_LABEL } from '@/texte/de'
import type { CallOutcome, CallOutcomeDef, Channel, EndedReason, ReachedPerson } from '@/types/domain'

export type ErgebnisGruppe = 'A' | 'B' | 'C'
export type ErgebnisTaste = '1' | '2' | '3' | '4' | 'X' | '5' | '6' | '7' | '8' | '9' | '0' | 'W' | 'K' | 'Q' | 'D'
export type PflichtFeld = 'callback_at' | 'meeting_at' | 'gespraechspartner' | 'zitat' | 'ended_reason' | 'zentrale'

export type ErgebnisDef = {
  taste: ErgebnisTaste
  outcome: CallOutcome
  gruppe: ErgebnisGruppe
  /** Button-Text (kurz, wie im Mock) */
  kurz: string
  /** Langform (Primärquelle `call_outcome_defs.label`, Fallback `ERGEBNIS_LABEL`) */
  label: string
  zaehltVersuch: boolean
  danger?: boolean
  /** Vorbelegung `p_reached_person` */
  reachedPerson: ReachedPerson
  /** Pflichtfelder im Wrap-up; Gruppe C verlangt immer den Gesprächspartner (ux § 3.5.3) */
  pflicht: readonly PflichtFeld[]
  /** Folgeaktion (Vorbelegung) in einem Satz */
  folge: string
}

export const GRUPPEN_LABEL: Record<ErgebnisGruppe, string> = {
  A: 'A · Nicht erreicht',
  B: 'B · Zentrale',
  C: 'C · Entscheider',
}

/** Verbindliche Belegung – Reihenfolge = Anzeige in der Ergebnisleiste. */
export const ERGEBNISSE: readonly ErgebnisDef[] = [
  {
    taste: '1',
    outcome: 'no_answer',
    gruppe: 'A',
    kurz: 'Nicht erreicht',
    label: ERGEBNIS_LABEL.no_answer,
    zaehltVersuch: true,
    reachedPerson: 'niemand',
    pflicht: [],
    folge: 'Nächster Versuch laut Kadenz',
  },
  {
    taste: '2',
    outcome: 'busy',
    gruppe: 'A',
    kurz: 'Besetzt',
    label: ERGEBNIS_LABEL.busy,
    zaehltVersuch: false,
    reachedPerson: 'niemand',
    pflicht: [],
    folge: 'Erneut in 45 min',
  },
  {
    taste: '3',
    outcome: 'voicemail',
    gruppe: 'A',
    kurz: 'Mailbox – keine Nachricht',
    label: ERGEBNIS_LABEL.voicemail,
    zaehltVersuch: true,
    reachedPerson: 'niemand',
    pflicht: [],
    folge: 'Nächster Versuch laut Kadenz',
  },
  {
    taste: '4',
    outcome: 'voicemail_left',
    gruppe: 'A',
    kurz: 'Mailbox – Nachricht hinterlassen',
    label: ERGEBNIS_LABEL.voicemail_left,
    zaehltVersuch: true,
    reachedPerson: 'niemand',
    pflicht: [],
    folge: 'Nächster Versuch laut Kadenz + Vorschlag „LinkedIn-DM Kurzfristig 1 senden?“',
  },
  {
    taste: 'X',
    outcome: 'wrong_number',
    gruppe: 'A',
    kurz: 'Falsche Nummer',
    label: ERGEBNIS_LABEL.wrong_number,
    zaehltVersuch: false,
    reachedPerson: 'niemand',
    pflicht: [],
    folge: 'Aufgabe „Telefonnummer recherchieren“',
  },
  {
    taste: '5',
    outcome: 'gatekeeper',
    gruppe: 'B',
    kurz: 'Entscheider nicht erreichbar',
    label: ERGEBNIS_LABEL.gatekeeper,
    zaehltVersuch: true,
    reachedPerson: 'zentrale',
    pflicht: ['zentrale', 'callback_at'],
    folge: 'Rückruf zum erfragten Zeitfenster',
  },
  {
    taste: '6',
    outcome: 'gatekeeper_blocked',
    gruppe: 'B',
    kurz: 'Blockt – Infos per E-Mail',
    label: ERGEBNIS_LABEL.gatekeeper_blocked,
    zaehltVersuch: true,
    reachedPerson: 'zentrale',
    pflicht: [],
    folge: 'Aufgabe „Kurzinfo mailen“ + Wiedervorlage +3 Tage – E-Mail nur mit Erlaubnis',
  },
  {
    taste: '7',
    outcome: 'callback_scheduled',
    gruppe: 'B',
    kurz: 'Rückruf vereinbart',
    label: ERGEBNIS_LABEL.callback_scheduled,
    zaehltVersuch: true,
    reachedPerson: 'zentrale',
    pflicht: ['callback_at'],
    folge: 'Rückruf oben in der Queue',
  },
  {
    taste: '8',
    outcome: 'dm_interest',
    gruppe: 'C',
    kurz: 'Interesse, kein Termin',
    label: ERGEBNIS_LABEL.dm_interest,
    zaehltVersuch: true,
    reachedPerson: 'entscheider',
    pflicht: ['gespraechspartner'],
    folge: 'Rückruf am nächsten Werktag',
  },
  {
    taste: '9',
    outcome: 'meeting_booked',
    gruppe: 'C',
    kurz: 'Termin vereinbart',
    label: ERGEBNIS_LABEL.meeting_booked,
    zaehltVersuch: true,
    reachedPerson: 'entscheider',
    pflicht: ['gespraechspartner', 'meeting_at'],
    folge: 'Phase Erstgespräch, Terminbestätigung per E-Mail vorschlagen',
  },
  {
    taste: '0',
    outcome: 'send_info',
    gruppe: 'C',
    kurz: '„Schicken Sie mal was“',
    label: ERGEBNIS_LABEL.send_info,
    zaehltVersuch: true,
    reachedPerson: 'entscheider',
    pflicht: ['gespraechspartner', 'zitat', 'callback_at'],
    folge: 'Erlaubnis „Am Telefon um Infos gebeten“ + Kurzinfo heute + Rückruf',
  },
  {
    taste: 'W',
    outcome: 'not_now',
    gruppe: 'C',
    kurz: 'Kein Bedarf – Wiedervorlage',
    label: ERGEBNIS_LABEL.not_now,
    zaehltVersuch: true,
    reachedPerson: 'entscheider',
    pflicht: ['gespraechspartner', 'callback_at'],
    folge: 'Wiedervorlage +3 Monate',
  },
  {
    taste: 'K',
    outcome: 'not_interested',
    gruppe: 'C',
    kurz: 'Kein Interesse – beendet',
    label: ERGEBNIS_LABEL.not_interested,
    zaehltVersuch: true,
    reachedPerson: 'entscheider',
    pflicht: ['gespraechspartner', 'ended_reason'],
    folge: 'Beendet, Grund Pflicht',
  },
  {
    taste: 'Q',
    outcome: 'not_icp',
    gruppe: 'C',
    kurz: 'Nicht ICP',
    label: ERGEBNIS_LABEL.not_icp,
    zaehltVersuch: true,
    reachedPerson: 'entscheider',
    pflicht: ['gespraechspartner', 'ended_reason'],
    folge: 'Beendet, Grund Pflicht',
  },
  {
    taste: 'D',
    outcome: 'do_not_call',
    gruppe: 'C',
    kurz: 'Werbewiderspruch',
    label: ERGEBNIS_LABEL.do_not_call,
    zaehltVersuch: true,
    danger: true,
    reachedPerson: 'entscheider',
    pflicht: ['gespraechspartner', 'zitat'],
    folge: 'Sperrliste, Beendet · Widerspruch, alle Sequenzen enden',
  },
]

export const ERGEBNIS_TASTEN: readonly ErgebnisTaste[] = ERGEBNISSE.map((e) => e.taste)

/** Primärquelle für Hotkey und Langtext ist `call_outcome_defs` (BAUPLAN § 3.4); Gruppen und Kurztexte bleiben statisch. */
export function ergebnisseMit(defs?: readonly CallOutcomeDef[] | null): readonly ErgebnisDef[] {
  if (!defs?.length) return ERGEBNISSE
  const nachOutcome = new Map(defs.map((d) => [d.outcome, d] as const))
  return ERGEBNISSE.map((e) => {
    const d = nachOutcome.get(e.outcome)
    if (!d) return e
    const taste =
      d.hotkey && ERGEBNIS_TASTEN.includes(d.hotkey.toUpperCase() as ErgebnisTaste)
        ? (d.hotkey.toUpperCase() as ErgebnisTaste)
        : e.taste
    return { ...e, taste, label: d.label || e.label, zaehltVersuch: d.counts_attempt }
  })
}

export function ergebnisNachTaste(taste: string, liste: readonly ErgebnisDef[] = ERGEBNISSE): ErgebnisDef | null {
  const t = taste.toUpperCase()
  return liste.find((e) => e.taste === t) ?? null
}

export function ergebnisNachOutcome(
  outcome: CallOutcome,
  liste: readonly ErgebnisDef[] = ERGEBNISSE,
): ErgebnisDef | null {
  return liste.find((e) => e.outcome === outcome) ?? null
}

/** Werte des Wrap-ups (lokal gehalten, bis „Weiter“ gedrückt wird). Datum/Uhrzeit als `YYYY-MM-DDTHH:MM` Europe/Berlin. */
export type WrapUpWerte = {
  callbackAt: string | null
  meetingAt: string | null
  reachedPerson: ReachedPerson | null
  reachedName: string
  reachedRolle: string
  zitat: string
  endedReason: EndedReason | null
  zentraleName: string
  zentraleDurchwahl: string
  zentraleZeitpunkt: string
  widerspruchKanaele: Channel[]
}

export const WRAPUP_LEER: WrapUpWerte = {
  callbackAt: null,
  meetingAt: null,
  reachedPerson: null,
  reachedName: '',
  reachedRolle: '',
  zitat: '',
  endedReason: null,
  zentraleName: '',
  zentraleDurchwahl: '',
  zentraleZeitpunkt: '',
  widerspruchKanaele: ['telefon'],
}

export const PFLICHT_LABEL: Record<PflichtFeld, string> = {
  callback_at: 'Datum und Uhrzeit',
  meeting_at: 'Termin (Datum und Uhrzeit)',
  gespraechspartner: 'Gesprächspartner (Name)',
  zitat: 'Zitat',
  ended_reason: 'Grund',
  zentrale: 'Name der Zentrale',
}

/** Felder, die auch „Weiter ohne Wrap-up“ (⌘↵) nicht überspringen darf – ohne sie kann `log_call` nicht arbeiten. */
const HART: readonly PflichtFeld[] = ['callback_at', 'meeting_at', 'zitat']

const getrimmt = (s: string) => s.trim()

/** Fehlende Pflichtfelder (Labels) – leer = speicherbar. `streng = false` prüft nur die harten Felder (⌘↵). */
export function pruefeWrapUp(def: ErgebnisDef, w: WrapUpWerte, streng = true): PflichtFeld[] {
  const fehlt: PflichtFeld[] = []
  for (const f of def.pflicht) {
    if (!streng && !HART.includes(f)) continue
    switch (f) {
      case 'callback_at':
        if (!w.callbackAt && !(def.outcome === 'gatekeeper' && getrimmt(w.zentraleZeitpunkt))) fehlt.push(f)
        break
      case 'meeting_at':
        if (!w.meetingAt || w.meetingAt.length < 16) fehlt.push(f)
        break
      case 'gespraechspartner':
        if (!getrimmt(w.reachedName)) fehlt.push(f)
        break
      case 'zitat':
        if (!getrimmt(w.zitat)) fehlt.push(f)
        break
      case 'ended_reason':
        if (!w.endedReason) fehlt.push(f)
        break
      case 'zentrale':
        if (!getrimmt(w.zentraleName)) fehlt.push(f)
        break
    }
  }
  return fehlt
}

/** `YYYY-MM-DDTHH:MM` (Berlin) oder `YYYY-MM-DD` → ISO-Zeitpunkt; reines Datum = `dueTime` (Standard 09:00). */
export function lokalNachIso(wert: string | null | undefined, dueTime = '09:00'): string | null {
  if (!wert) return null
  const tag = wert.slice(0, 10)
  const zeit = wert.length >= 16 ? wert.slice(11, 16) : dueTime
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tag)) return null
  return tagZuDate(tag, zeit).toISOString()
}

export type LogCallParameter = Parameters<typeof rpc.logCall>[0]

export type AnrufParameterEingabe = {
  leadId: string
  def: ErgebnisDef
  werte: WrapUpWerte
  startedAt: string
  dauerSec: number
  notiz: string
  enrollmentId: string | null
  taskId: string | null
  templateId: string | null
  toNumber: string | null
  fromNumber: string | null
  dueTime?: string
}

/**
 * Reine Abbildung Ergebnis + Wrap-up → `rpc.logCall`-Parameter (BAUPLAN § 3.4 Tabelle). Immer dabei: `startedAt`,
 * `endedAt`, `durationSec`, `note`, `enrollmentId`, `taskId`, `templateId`, `direction = 'out'`.
 */
export function logCallParameter(e: AnrufParameterEingabe): LogCallParameter {
  const { def, werte: w } = e
  const started = new Date(e.startedAt)
  const dauer = Math.max(0, Math.round(e.dauerSec))
  const endedAt = new Date(started.getTime() + dauer * 1000).toISOString()
  const notiz = getrimmt(e.notiz)
  const teile: string[] = []
  if (notiz) teile.push(notiz)

  let reachedPerson: ReachedPerson = w.reachedPerson ?? def.reachedPerson
  let reachedName: string | null = null
  if (def.gruppe === 'C') {
    reachedPerson = w.reachedPerson ?? 'entscheider'
    const rolle = getrimmt(w.reachedRolle)
    reachedName = getrimmt(w.reachedName) ? `${getrimmt(w.reachedName)}${rolle ? ` (${rolle})` : ''}` : null
  } else if (def.gruppe === 'B') {
    reachedPerson = w.reachedPerson ?? 'zentrale'
    reachedName = getrimmt(w.zentraleName) || null
  } else {
    reachedPerson = 'niemand'
  }

  let callbackAt: string | null = null
  let meetingAt: string | null = null
  let endedReason: EndedReason | null = null
  const dueTime = e.dueTime ?? '09:00'

  switch (def.outcome) {
    case 'gatekeeper': {
      const info: string[] = []
      if (getrimmt(w.zentraleName)) info.push(`Zentrale: ${getrimmt(w.zentraleName)}`)
      if (getrimmt(w.zentraleDurchwahl)) info.push(`Durchwahl ${getrimmt(w.zentraleDurchwahl)}`)
      if (getrimmt(w.zentraleZeitpunkt)) info.push(`bester Zeitpunkt: ${getrimmt(w.zentraleZeitpunkt)}`)
      if (info.length) teile.push(info.join(' · '))
      callbackAt = lokalNachIso(w.callbackAt, dueTime)
      break
    }
    case 'callback_scheduled':
    case 'send_info':
      callbackAt = lokalNachIso(w.callbackAt, dueTime)
      break
    case 'not_now':
      callbackAt = lokalNachIso(w.callbackAt, dueTime)
      break
    case 'meeting_booked':
      meetingAt = lokalNachIso(w.meetingAt, dueTime)
      break
    case 'not_interested':
      endedReason = w.endedReason ?? 'kein_interesse'
      break
    case 'not_icp':
      endedReason = w.endedReason ?? 'nicht_icp'
      break
    case 'do_not_call':
      // Zitat = Widerspruchs-Wortlaut → `objection_note`/`ended_note` (log_call liest p_note)
      teile.unshift(`Widerspruch: ‚${getrimmt(w.zitat)}‘`)
      break
    default:
      break
  }

  return {
    leadId: e.leadId,
    outcome: def.outcome,
    note: teile.length ? teile.join('\n') : null,
    reachedPerson,
    reachedName,
    startedAt: e.startedAt,
    endedAt,
    durationSec: dauer,
    callbackAt,
    meetingAt,
    enrollmentId: e.enrollmentId,
    taskId: e.taskId,
    templateId: e.templateId,
    fromNumber: e.fromNumber,
    toNumber: e.toNumber,
    direction: 'out',
    endedReason,
  }
}
