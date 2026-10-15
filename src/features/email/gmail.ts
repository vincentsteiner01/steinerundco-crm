// BAUPLAN § 3.5 `gmail.ts` – Versandwege v1 (E11): Gmail-Compose-Link, mailto, „In Gmail suchen“. Kein Provider-Versand.
// composeUrl: https://mail.google.com/mail/?view=cm&fs=1&tf=1&authuser=<idx|email>&to=&su=&body= (encodeURIComponent, \n → %0A).

/** Praktische Obergrenze des Body für die Compose-URL (ux § 3.6.2, DESIGN-SYSTEM § 5.14). */
export const BODY_MAX = 1400

const GMAIL = 'https://mail.google.com/mail/'

export type ComposeEingabe = {
  /** Postfach-Index („0“) oder E-Mail-Adresse der angemeldeten Person. */
  authuser?: string | number | null
  to: string
  su: string
  body: string
}

/** `encodeURIComponent` kodiert `\n` bereits als `%0A`; `\r` wird vorher entfernt, damit Gmail keine Leerzeilen verdoppelt. */
function kodiere(s: string): string {
  return encodeURIComponent(s.replace(/\r\n?/g, '\n'))
}

/** Gmail-Compose-Link (ux § 3.6.2, M-05): `view=cm`, `fs=1`, `tf=1`, `authuser`, `to`, `su`, `body`. */
export function composeUrl({ authuser, to, su, body }: ComposeEingabe): string {
  const teile = ['view=cm', 'fs=1', 'tf=1']
  if (authuser !== undefined && authuser !== null && String(authuser).trim() !== '')
    teile.push(`authuser=${kodiere(String(authuser).trim())}`)
  teile.push(`to=${kodiere(to.trim())}`, `su=${kodiere(su)}`, `body=${kodiere(body)}`)
  return `${GMAIL}?${teile.join('&')}`
}

/** `mailto:` (mobil Standard): Betreff und Text als `subject`/`body`. */
export function mailtoUrl({ to, su, body }: Omit<ComposeEingabe, 'authuser'>): string {
  return `mailto:${kodiere(to.trim())}?subject=${kodiere(su)}&body=${kodiere(body)}`
}

/** „In Gmail suchen“ (Threading ohne Message-IDs): Suche nach Betreff + Empfänger im Postfach der Person. */
export function gmailSucheUrl({ email, subject, to }: { email: string; subject: string; to: string }): string {
  const q = `${subject.replace(/^(re|aw|fwd?):\s*/i, '')} ${to}`.trim()
  return `${GMAIL}u/${kodiere(email)}/#search/${kodiere(q).replace(/%20/g, '+')}`
}

/** Passt der Body in die Compose-URL (≤ 1 400 Zeichen)? */
export function passtInCompose(body: string): boolean {
  return body.length <= BODY_MAX
}

/** Betreff der Folgemail im selben Thread: „Re: “ genau einmal (M-11). */
export function reBetreff(erster: string): string {
  const s = erster.trim()
  return /^re:\s*/i.test(s) ? s : `Re: ${s}`
}
