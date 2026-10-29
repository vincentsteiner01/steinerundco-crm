// Auftragsseite für Browser-Agenten (ChatGPT in Chrome): welche LinkedIn-Aufgaben heute dran sind – aus derselben Queue wie
// „Heute“ (crm.v_today_queue), nur flach und stabil sortiert, damit ein Agent sie zuverlässig von oben nach unten abarbeitet.
import type { QueueItem } from '@/types/domain'

export type AuftragArt = 'annahme' | 'opener' | 'follow_up'

export type AuftragsGruppen = {
  annahmen: QueueItem[]
  opener: QueueItem[]
  followUps: QueueItem[]
  /** offene Antworten – beantwortet Vincent selbst, nicht der Agent */
  antwortenOffen: number
}

const FAELLIG = new Set(['ueberfaellig', 'heute'])

/** Nur LinkedIn: Sequenzschritte mit Kanal linkedin; Sheet-Wiedervorlagen ohne eigenen Kanal zählen dazu, wenn ein Profil da ist. */
export function istLinkedin(i: Pick<QueueItem, 'channel' | 'item_kind' | 'linkedin_url'>): boolean {
  if (i.channel === 'linkedin') return true
  if (i.item_kind !== 'wiedervorlage') return false
  return i.channel !== 'telefon' && i.channel !== 'email' && !!i.linkedin_url
}

function sortiere(a: QueueItem, b: QueueItem): number {
  // überfällig zuerst (ältestes Datum oben), dann Name – stabil, damit Nummern beim Abarbeiten gleich bleiben
  const d = (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
  if (d !== 0) return d
  return (a.lead_name ?? '').localeCompare(b.lead_name ?? '', 'de')
}

export function gruppiere(items: readonly QueueItem[], istOpener: (stepId: string | null) => boolean): AuftragsGruppen {
  const annahmen: QueueItem[] = []
  const opener: QueueItem[] = []
  const followUps: QueueItem[] = []
  let antwortenOffen = 0
  for (const i of items) {
    if (i.do_not_contact) continue
    if (i.item_kind === 'antworten') {
      antwortenOffen += 1
      continue
    }
    if (i.item_kind === 'annahme_pruefen') {
      annahmen.push(i)
      continue
    }
    if (!FAELLIG.has(i.section ?? '') || !istLinkedin(i)) continue
    if (i.item_kind === 'sequenz_schritt') {
      if (istOpener(i.step_id)) opener.push(i)
      else followUps.push(i)
    } else if (i.item_kind === 'wiedervorlage') {
      followUps.push(i)
    }
  }
  annahmen.sort((a, b) => (a.lead_name ?? '').localeCompare(b.lead_name ?? '', 'de'))
  opener.sort(sortiere)
  followUps.sort(sortiere)
  return { annahmen, opener, followUps, antwortenOffen }
}

/** Vollständige Profil-URL für den Agenten (in der View steht teils die normalisierte Form ohne Protokoll). */
export function profilUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const u = url.trim()
  if (/^https?:\/\//i.test(u)) return u
  return `https://www.${u.replace(/^www\./i, '')}`
}

export const AUFTRAG_URL = 'https://crm.steinerundco.de/auftrag'

/** Prompt für den ChatGPT-Agenten in Chrome. Bewusst kleinschrittig und ohne Interpretationsspielraum. */
export function chatgptPrompt(url: string = AUFTRAG_URL, maxNachrichten = 25): string {
  return [
    'Du arbeitest für Vincent von Steiner & Co. auf LinkedIn. Was zu tun ist und welcher Text an wen geht, entscheidet ausschließlich unser CRM. Halte dich genau an diese Schritte.',
    '',
    `1. Öffne ${url} in einem eigenen Tab und lass ihn offen. Vincent ist dort angemeldet. Siehst du stattdessen eine Anmeldeseite, brich ab und sag mir Bescheid.`,
    '',
    '2. Neue Anfragen (für die KPI „Vernetzungen versendet“): Öffne auf LinkedIn https://www.linkedin.com/mynetwork/invitation-manager/sent/ („Einladungen verwalten“ → „Gesendet“). Nimm alle Personen, deren Einladung heute oder in den letzten 3 Tagen gesendet wurde („Gesendet vor … Minuten/Stunden/Tagen“). Trage sie im CRM im Feld „Neue Anfragen eintragen“ ein – gleiches Format wie unten bei den Annahmen, eine Person pro Zeile – und klicke „Eintragen“. Warte auf die Ergebniszeile („… als Anfrage eingetragen …“) und merke dir ihren Wortlaut. Schon eingetragene Personen erkennt das CRM, es zählt nichts doppelt.',
    '',
    '3. Neue Annahmen: Öffne auf LinkedIn „Mein Netzwerk“ → „Kontakte“ und sortiere nach „Kürzlich hinzugefügt“. Nimm alle Personen, die in den letzten 3 Tagen hinzugekommen sind. Trage sie im CRM im Feld „Neue Annahmen eintragen“ ein, eine Person pro Zeile, in diesem Format:',
    '   Herr Vorname Nachname | Firma | https://www.linkedin.com/in/profil',
    '   (statt „Herr“ „Frau“, wenn es eine Frau ist; ist die Firma unbekannt, lass das Feld leer). Klicke dann „Eintragen“. Personen, die das CRM schon kennt, erkennt es selbst.',
    '   Warte, bis unter dem Feld die Ergebniszeile erscheint („… als angenommen eingetragen …“) – bei vielen Personen kann das eine Minute dauern. Merke dir ihren Wortlaut. Steht dort, dass Annahmen nicht gespeichert wurden, klicke noch einmal „Eintragen“.',
    '',
    '4. Arbeite danach die Abschnitte „Opener senden“ und „Follow-ups senden“ von oben nach unten ab. Für jede Aufgabe:',
    '   a) Öffne über den LinkedIn-Link das Profil der Person und dann den Chat mit ihr.',
    '   b) Hat die Person bereits geantwortet: Sende NICHTS. Klicke im CRM „Hat geantwortet“, kopiere ihre letzte Nachricht in das Feld darunter und klicke „Antwort eintragen“. Markiere den Chat danach auf LinkedIn wieder als ungelesen (im Chat oben „…“ bzw. Rechtsklick in der Chatliste → „Als ungelesen markieren“) – sonst sieht Vincent nicht, dass dort eine neue Nachricht wartet.',
    '   c) Steht im Chat schon genau diese Nachricht von Vincent: Sende sie nicht noch einmal. Klicke im CRM „War schon gesendet“.',
    '   d) Steht im CRM „Anrede fehlt“: Klicke „Herr“ oder „Frau“, passend zur Person. Danach erscheint der fertige Text.',
    '   e) Steht im CRM ein Feld „Kurzes individuelles Kompliment“ (Vorlage „Individuelles Kompliment“): Schau dir das Profil der Person und die Unternehmensseite an (Info, Erfahrung, letzte Beiträge, Website) und schreibe in das Feld EIN kurzes, ehrliches Kompliment – ein Satz, höchstens etwa 20 Wörter. Es muss sich auf etwas Konkretes beziehen, das diese Person oder Firma wirklich tut, und darf ruhig nebenbei zeigen, warum das bemerkenswert ist. Beispiel: „Es ist spannend, dass Sie KI in Ihrem Unternehmen mit einbinden – bei vielen Energie- und Solarunternehmen ist das noch nicht so.“ Nicht schmeicheln, keine Übertreibungen („beeindruckend“, „großartig“, „toll“), kein Honig ums Maul, nichts aus dem Profil abschreiben, keine Fragen, kein Ausrufezeichen. Findest du nichts Konkretes, überspringe die Aufgabe und melde sie am Ende. Der Text im Feld „Nachricht“ aktualisiert sich, sobald du tippst.',
    '   f) Sende den Text aus dem Feld „Nachricht“ genau so, ohne ihn zu verändern, als eine einzige Nachricht.',
    '   g) Klicke sofort danach im CRM bei dieser Person „Gesendet“. Erst dann weiter zur nächsten Aufgabe.',
    '',
    '5. Regeln:',
    '   – Schreibe nur Personen an, die auf der Auftragsseite stehen, und jede höchstens einmal.',
    '   – Ändere keine Texte (außer dem Kompliment-Feld) und beantworte keine Antworten – das macht Vincent selbst.',
    '   – Öffnest du irgendwo einen Chat, in dem eine neue Nachricht der Person steht, die Vincent noch nicht gesehen hat: Markiere ihn am Ende wieder als ungelesen.',
    `   – Höchstens ${maxNachrichten} Nachrichten pro Durchgang, mit etwas Abstand zwischen den Nachrichten.`,
    '   – Ist eine Zeile gesperrt, ein Knopf ausgegraut oder sieht eine Seite anders aus als beschrieben: diese Aufgabe überspringen und am Ende melden.',
    '   – Erscheint „Offline“ oder „nicht gespeichert“ oder lädt die Seite länger als eine Minute: 30 Sekunden warten, die Auftragsseite neu laden und den letzten Schritt wiederholen. Das CRM erkennt Doppeltes, es wird nichts doppelt gezählt. Klappt es nach drei Versuchen nicht, abbrechen und melden.',
    '   – Ohne Häkchen „Gesendet“ im CRM keine weitere LinkedIn-Nachricht senden.',
    '   – Die KPIs (Anfragen, Annahmen, eröffnete Gespräche, Antworten) entstehen ausschließlich aus deinen Einträgen und Klicks im CRM. Mach die Schritte 2 und 3 deshalb bei JEDEM Durchgang, auch wenn danach keine Nachricht fällig ist, und trage jede Antwort mit „Hat geantwortet“ ein.',
    '',
    '6. Melde mir am Ende: den Wortlaut der Ergebniszeilen bei „Neue Anfragen eintragen“ und „Neue Annahmen eintragen“, wie viele Nachrichten gesendet wurden, wer schon geantwortet hatte und was nicht geklappt hat.',
  ].join('\n')
}

export type AnnahmenErgebnis = {
  neu: number
  bekannt: number
  angenommen: number
  uebersprungen: string[]
  /** Annahmen, die auch nach Wiederholung nicht gespeichert wurden (Verbindung) */
  fehlgeschlagen: number
}

export function annahmenText(e: AnnahmenErgebnis): string {
  const teile = [`${e.angenommen} als angenommen eingetragen`, `${e.neu} neu angelegt`, `${e.bekannt} schon im CRM`]
  let satz = `${teile.join(' · ')}.`
  if (e.uebersprungen.length) satz += ` Übersprungen: ${e.uebersprungen.join(', ')}.`
  if (e.fehlgeschlagen)
    satz += ` ${e.fehlgeschlagen} ${e.fehlgeschlagen === 1 ? 'Annahme' : 'Annahmen'} nicht gespeichert (Verbindung). Die Liste steht noch im Feld – einfach noch einmal „Eintragen“ klicken, doppelt wird nichts gezählt.`
  return satz
}

export type AnfragenErgebnis = {
  neu: number
  bekannt: number
  /** als gesendete Anfrage eingetragen (zählt bei „Vernetzungen versendet“) */
  eingetragen: number
  /** hatte schon eine Verbindung im CRM (offen oder angenommen) – nichts geändert */
  schonVerbunden: number
  uebersprungen: string[]
  fehlgeschlagen: number
}

export function anfragenText(e: AnfragenErgebnis): string {
  const teile = [`${e.eingetragen} als Anfrage eingetragen`, `${e.neu} neu angelegt`, `${e.bekannt} schon im CRM`]
  if (e.schonVerbunden) teile.push(`${e.schonVerbunden} schon als Anfrage/Kontakt bekannt`)
  let satz = `${teile.join(' · ')}.`
  if (e.uebersprungen.length) satz += ` Übersprungen: ${e.uebersprungen.join(', ')}.`
  if (e.fehlgeschlagen)
    satz += ` ${e.fehlgeschlagen} ${e.fehlgeschlagen === 1 ? 'Anfrage' : 'Anfragen'} nicht gespeichert. Die Liste steht noch im Feld – einfach noch einmal „Eintragen“ klicken, doppelt wird nichts gezählt.`
  return satz
}
