// Eingehende Mails einordnen (Mail-Motor, 01.11.2026): Unzustellbar-Meldung · Abwesenheitsnotiz · sonstige Automatik ·
// menschliche Antwort (mit Hinweis Abmeldung / kein Interesse / interessiert). Reine Funktionen ohne Netz – getestet in
// einordnen_test.ts. Ob eine Mail zu uns gehört (Kampagne, Aufwärmen), entscheidet die Datenbank über die Message-IDs
// in `bezug`; hier wird nur gelesen, was in der Mail steht.

export type EingangsMail = {
  /** Absenderadresse (klein) und Anzeigename */
  von: string
  vonName?: string | null
  betreff: string
  /** Kopfzeilen mit kleingeschriebenen Namen; mehrfach vorkommende zusammengefügt */
  kopf: Record<string, string>
  /** Klartext (bei HTML-Mails der aus HTML gewonnene Text) */
  text: string
  /** Rohquelle, höchstens die ersten ~40 kB (für Unzustellbar-Meldungen mit eingebettetem Original) */
  roh?: string
}

export type Bounce = 'adresse_ungueltig' | 'domain_ungueltig' | 'postfach_voll' | 'abgelehnt' | 'voruebergehend' | 'sonstiges'

export type Einordnung =
  | {
      art: 'unzustellbar'
      /** true = dauerhaft (5.x.x): Adresse sperren bzw. Empfänger stoppen */
      hart: boolean
      grund: Bounce
      empfaenger: string | null
      status: string | null
      meldung: string | null
      bezug: string[]
    }
  | { art: 'abwesend'; bis: string | null; ausgeschieden: boolean; bezug: string[] }
  | { art: 'automatisch'; bezug: string[] }
  | { art: 'antwort'; hinweis: 'abmeldung' | 'kein_interesse' | 'interessiert' | null; neuerText: string; bezug: string[] }

const MSGID = /<[^<>\s]{3,250}>/g

/** Alle Message-IDs aus In-Reply-To/References (in Reihenfolge, ohne Doppelte, klein geschrieben). */
export function messageIds(...felder: (string | null | undefined)[]): string[] {
  const ids: string[] = []
  for (const f of felder) for (const m of (f ?? '').match(MSGID) ?? []) if (!ids.includes(m.toLowerCase())) ids.push(m.toLowerCase())
  return ids
}

// ---------------------------------------------------------------- zitierten Verlauf abschneiden
const ZITAT_BEGINN = [
  /^\s*am .{4,120}(schrieb|hat .{0,60} geschrieben).{0,80}:\s*$/i,
  /^\s*on .{4,120}wrote:\s*$/i,
  /^\s*-{2,}\s*(ursprüngliche nachricht|original message|weitergeleitete nachricht|forwarded message)\s*-{2,}/i,
  /^\s*(von|from):\s.+$/i, // Outlook-Kopfblock („Von: … Gesendet: …“) – nur, wenn „Gesendet:/Sent:“ folgt (unten geprüft)
  /^\s*_{10,}\s*$/,
]

/**
 * Nur den neuen Teil einer Antwort (ohne zitierten Verlauf und ohne „>“-Zeilen). Wichtig für die Hinweise: unsere eigene Mail
 * enthält den Satz „Wenn Sie keine weiteren E-Mails … möchten“ – zitiert darf er nicht als Abmeldung gelten.
 */
export function neuerText(text: string): string {
  const zeilen = text.replace(/\r\n?/g, '\n').split('\n')
  const raus: string[] = []
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i] ?? ''
    if (/^\s*>/.test(z)) continue
    let ende = false
    for (const re of ZITAT_BEGINN) {
      if (!re.test(z)) continue
      if (re === ZITAT_BEGINN[3]) {
        // „Von: …“ zählt nur als Zitatbeginn, wenn in den nächsten 4 Zeilen „Gesendet:“/„Sent:“/„Datum:“ steht
        const folge = zeilen.slice(i + 1, i + 5).join('\n')
        if (!/^\s*(gesendet|sent|datum|date):/im.test(folge)) continue
      }
      ende = true
      break
    }
    if (ende) break
    raus.push(z)
  }
  return raus.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ---------------------------------------------------------------- Unzustellbar
const BOUNCE_ABSENDER = /^(mailer-daemon|mailerdaemon|mail-daemon|postmaster|bounce[s]?|mdaemon)@/i
const BOUNCE_NAME = /^(mail delivery (subsystem|system)|mailer[- ]daemon|microsoft outlook|postmaster|mail administrator)$/i
const BOUNCE_BETREFF =
  /(undeliver|unzustellbar|nicht zustellbar|delivery status notification \((failure|delay)\)|returned mail|mail delivery failed|delivery failure|failure notice|zustellung fehlgeschlagen|undelivered mail|non remis|message not delivered|nachricht nicht zugestellt|unzustellbare nachricht)/i

function bounceGrund(status: string | null, text: string): Bounce {
  const t = text.toLowerCase()
  if (status?.startsWith('4')) return status === '4.2.2' ? 'postfach_voll' : 'voruebergehend'
  if (status === '5.2.2' || /mailbox (is )?full|quota exceeded|over ?quota|postfach (ist )?voll|speicherplatz/.test(t))
    return 'postfach_voll'
  if (
    status?.startsWith('5.7') ||
    /\b(spam|blocked|blacklist|block ?list|reputation|policy|abgelehnt wegen|unsolicited|spamhaus|dmarc|not authorized|rejected due to)\b/.test(t)
  )
    return 'abgelehnt'
  if (
    status === '5.1.2' ||
    status === '5.4.4' ||
    /(host|domain) (not found|unknown|does not exist)|no mx|nxdomain|domain existiert nicht|unrouteable address|dns error/.test(t)
  )
    return 'domain_ungueltig'
  if (
    status?.startsWith('5.1') ||
    /(user|recipient|address|mailbox|empfänger|adresse|postfach)[^.\n]{0,40}(unknown|not found|does not exist|doesn't exist|nicht gefunden|unbekannt|existiert nicht|invalid|ungültig|disabled|deaktiviert)|no such user|address couldn.t be found|recipientnotfound|resolver\.adr/.test(
      t,
    )
  )
    return 'adresse_ungueltig'
  return 'sonstiges'
}

function istBounce(m: EingangsMail): boolean {
  const ct = (m.kopf['content-type'] ?? '').toLowerCase()
  if (ct.includes('multipart/report') && ct.includes('delivery-status')) return true
  if (BOUNCE_ABSENDER.test(m.von) && (BOUNCE_BETREFF.test(m.betreff) || /final-recipient:|diagnostic-code:/i.test(m.roh ?? m.text)))
    return true
  return BOUNCE_NAME.test((m.vonName ?? '').trim()) && BOUNCE_BETREFF.test(m.betreff)
}

function bounceLesen(m: EingangsMail): Extract<Einordnung, { art: 'unzustellbar' }> {
  const quelle = `${m.roh ?? ''}\n${m.text}`
  const status = /^\s*Status:\s*([245]\.\d{1,3}\.\d{1,3})/im.exec(quelle)?.[1] ?? /\b([45]\.\d\.\d{1,2})\b/.exec(m.text)?.[1] ?? null
  const action = /^\s*Action:\s*(\w+)/im.exec(quelle)?.[1]?.toLowerCase() ?? null
  const empfaenger =
    /^\s*(?:Final|Original)-Recipient:\s*(?:rfc822;)?\s*<?([^\s<>;]+@[^\s<>;]+)>?/im.exec(quelle)?.[1]?.toLowerCase() ??
    /(?:wasn't delivered to|nicht an|delivery has failed to these recipients or groups:\s*)\s*<?([^\s<>]+@[^\s<>]+?)>?[\s.,]/i
      .exec(m.text)?.[1]
      ?.toLowerCase() ??
    null
  const diag = /^\s*Diagnostic-Code:\s*(?:smtp;\s*)?(.+(?:\n[ \t].+)*)/im.exec(quelle)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
  const grund = bounceGrund(status, `${diag ?? ''}\n${m.text}`)
  const hart =
    grund === 'voruebergehend' || grund === 'postfach_voll'
      ? false
      : action === 'delayed'
        ? false
        : status
          ? status.startsWith('5')
          : grund !== 'sonstiges'
  // Bezug: Message-IDs des eingebetteten Originals – die eigene ID der Meldung (erste Message-ID-Zeile) zählt nicht
  const eigene = (m.kopf['message-id'] ?? '').toLowerCase().trim()
  const eingebettet = [...quelle.matchAll(/^\s*Message-I[Dd]:\s*(<[^<>\s]+>)/gim)].map((x) => (x[1] ?? '').toLowerCase())
  const bezug = messageIds(m.kopf['in-reply-to'], m.kopf.references, eingebettet.filter((x) => x !== eigene).join(' '))
  return {
    art: 'unzustellbar',
    hart,
    grund,
    empfaenger,
    status,
    meldung: (diag ?? m.text.trim().split('\n').find((z) => z.trim().length > 20) ?? '').slice(0, 500) || null,
    bezug,
  }
}

// ---------------------------------------------------------------- Automatik / Abwesenheit
const ABWESEND_BETREFF =
  /(abwesenheit|automatische antwort|autom\. antwort|auto(matic)?[- ]?reply|out of (the )?office|ooo\b|nicht im büro|abwesend|urlaub|elternzeit|ausser haus|außer haus|vacation|away from)/i
const ABWESEND_TEXT =
  /(bin (ich )?(derzeit |zurzeit |aktuell |momentan )?(nicht im büro|abwesend|im urlaub|außer haus|ausser haus|nicht erreichbar|in elternzeit|krank)|befinde mich (derzeit |zurzeit |aktuell )?(im urlaub|in elternzeit|außer haus|nicht im büro)|bin (ab|bis) (dem |zum )?\d{1,2}\.\d{1,2}\.|wieder (im büro|erreichbar|da)|out of (the )?office|currently away|on vacation|on leave|ihre (e-?mail|nachricht) wird nicht weitergeleitet|in dringenden fällen)/i
const AUSGESCHIEDEN =
  /(nicht mehr (im|bei|für) (unternehmen|uns|die|der|das|unserem|unserer)|nicht mehr (tätig|beschäftigt)|hat (das unternehmen|uns) verlassen|ist ausgeschieden|no longer (with|employed|works)|has left the company|dieses postfach wird nicht mehr|adresse ist nicht mehr aktiv)/i
const AUTO_SONST =
  /(ihre (nachricht|anfrage|e-?mail) (ist|wurde) (bei uns )?(eingegangen|erhalten)|wir haben ihre (nachricht|anfrage|e-?mail) erhalten|vielen dank für ihre (nachricht|anfrage|e-?mail)[^.\n]{0,40}(automatisch|wir melden uns)|this is an automated|dies ist eine automatisch|automatisch generiert|ticket ?(nummer|#|id)|do not reply|nicht auf diese (e-?mail|nachricht) antworten)/i

function automatischKopf(k: Record<string, string>): boolean {
  const as = (k['auto-submitted'] ?? '').toLowerCase().trim()
  if (as && as !== 'no') return true
  if (k['x-autoreply'] || k['x-autorespond'] || k['x-autoresponder']) return true
  if (/^(auto[_-]?reply|bulk|junk)$/i.test((k.precedence ?? k['x-precedence'] ?? '').trim())) return true
  return /^(yes|true)$/i.test((k['x-auto-response'] ?? '').trim())
}

const MONATE: Record<string, number> = {
  jan: 1, januar: 1, feb: 2, februar: 2, mär: 3, maerz: 3, märz: 3, mar: 3, apr: 4, april: 4, mai: 5, jun: 6, juni: 6,
  jul: 7, juli: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, dez: 12, dezember: 12,
}

/**
 * Rückkehrdatum aus einer Abwesenheitsnotiz (ISO `JJJJ-MM-TT`) – das späteste plausible Datum in den nächsten 120 Tagen.
 * „bis einschließlich 7.11.“ → 7.11., „ab dem 10.11.2026 wieder“ → 10.11.; ohne Jahr gilt das nächste passende Jahr.
 */
export function rueckkehrDatum(text: string, heute: Date = new Date()): string | null {
  const t = text.toLowerCase()
  const kandidaten: Date[] = []
  const basis = Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate())
  const plausibel = (j: number, mo: number, ta: number) => {
    if (mo < 1 || mo > 12 || ta < 1 || ta > 31) return
    const d = new Date(Date.UTC(j, mo - 1, ta))
    if (d.getUTCMonth() !== mo - 1) return
    const tage = (d.getTime() - basis) / 86_400_000
    if (tage >= 0 && tage <= 120) kandidaten.push(d)
  }
  const jahrFuer = (mo: number, ta: number, j?: string) => {
    if (j) return j.length === 2 ? 2000 + Number(j) : Number(j)
    const dies = heute.getUTCFullYear()
    return Date.UTC(dies, mo - 1, ta) < basis ? dies + 1 : dies
  }
  for (const m of t.matchAll(/\b(\d{1,2})\.\s?(\d{1,2})\.(\d{4}|\d{2})?(?!\d)/g)) {
    const ta = Number(m[1])
    const mo = Number(m[2])
    plausibel(jahrFuer(mo, ta, m[3]), mo, ta)
  }
  for (const m of t.matchAll(/\b(\d{1,2})\.\s?([a-zä]{3,9})\.?\s?(\d{4})?/g)) {
    const mo = MONATE[m[2] ?? '']
    if (!mo) continue
    const ta = Number(m[1])
    plausibel(jahrFuer(mo, ta, m[3]), mo, ta)
  }
  if (!kandidaten.length) return null
  const spaetestes = new Date(Math.max(...kandidaten.map((d) => d.getTime())))
  return spaetestes.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------- Hinweise in menschlichen Antworten
const ABMELDUNG =
  /(\babmelden\b|\babmeldung\b|\baustragen\b|aus (ihrem|dem|ihren) (verteiler|e-?mail-?verteiler|newsletter)|keine (weiteren |weitere )?(e-?mails?|nachrichten|werbung|werbemails?|kontaktaufnahme|zuschriften)( mehr)?\b|nicht (mehr |weiter )?(kontaktieren|anschreiben|anmailen)|(schreiben|kontaktieren) sie (mich|uns) nicht|unterlassen sie|widersprech|\bwiderspruch\b|\bunsubscribe\b|remove me|take me off|lösch(en|ung) (sie )?(meine|unsere) (daten|adresse|e-?mail)|\bspam\b|unerwünschte werbung|unaufgefordert)/i
const KEIN_INTERESSE =
  /(kein(e|en)? (interesse|bedarf)|nicht interessiert|nicht relevant|passt (aktuell |gerade |derzeit )?nicht|haben (bereits|schon) (eine lösung|einen anbieter|einen partner|ein system)|brauchen wir nicht|no interest|not interested)/i
const INTERESSIERT =
  /(\bgerne\b|klingt (gut|interessant|spannend)|\binteresse\b|interessiert|termin|telefonat|rufen sie (mich|uns) an|melden sie sich|wann (passt|haben sie|hätten sie)|schicken sie (mir|uns)|senden sie (mir|uns)|unterlagen|mehr (dazu )?erfahren|lassen sie uns|kurz sprechen|\bcall\b|sounds good|interested)/i

function hinweis(t: string): 'abmeldung' | 'kein_interesse' | 'interessiert' | null {
  if (!t) return null
  if (ABMELDUNG.test(t)) return 'abmeldung'
  // sehr kurze Antworten „Stop“ / „Nein danke“ / „Bitte austragen“
  if (/^\s*(stop+|stopp|nein,? danke\.?|nein\.?|bitte nicht mehr)\s*[.!]*\s*$/i.test(t.split('\n')[0] ?? '') && t.length < 60)
    return 'abmeldung'
  if (KEIN_INTERESSE.test(t)) return 'kein_interesse'
  if (INTERESSIERT.test(t)) return 'interessiert'
  return null
}

/** Ordnet eine eingegangene Mail ein (Reihenfolge: Unzustellbar → Automatik → menschliche Antwort). */
export function einordnen(m: EingangsMail, heute: Date = new Date()): Einordnung {
  const bezug = messageIds(m.kopf['in-reply-to'], m.kopf.references)
  if (istBounce(m)) return bounceLesen(m)

  const neu = neuerText(m.text)
  const kopfAuto = automatischKopf(m.kopf)
  const kurz = neu.slice(0, 1500)
  const abwesendBetreff = ABWESEND_BETREFF.test(m.betreff)
  const abwesendText = ABWESEND_TEXT.test(kurz)
  const ausgeschieden = AUSGESCHIEDEN.test(kurz) || AUSGESCHIEDEN.test(m.betreff)
  if ((kopfAuto || abwesendBetreff) && (abwesendText || abwesendBetreff || ausgeschieden))
    return { art: 'abwesend', bis: ausgeschieden ? null : rueckkehrDatum(kurz, heute), ausgeschieden, bezug }
  if (kopfAuto || AUTO_SONST.test(kurz)) {
    if (ausgeschieden) return { art: 'abwesend', bis: null, ausgeschieden: true, bezug }
    return { art: 'automatisch', bezug }
  }
  // Abwesenheitsnotizen ohne Automatik-Kopf (manche Server setzen keinen): eindeutiger Betreff UND Text
  if (abwesendBetreff && abwesendText) return { art: 'abwesend', bis: rueckkehrDatum(kurz, heute), ausgeschieden, bezug }
  return { art: 'antwort', hinweis: hinweis(neu), neuerText: neu.slice(0, 4000), bezug }
}
