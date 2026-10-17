// BAUPLAN § 3.8 parser/schnellimport.ts – Grammatik § 6.3 (deterministisch, ohne LLM, ohne Netz) → SchnellimportZeile[].
// FORMAT := JSON | MDTABELLE | CSV | ZEILEN (Erkennung an den ersten 5 nicht-leeren Zeilen, in dieser Reihenfolge).
import type { Salutation, SchnellimportZeile } from '@/types/domain'
import { mappeKopf, parseCsv, tabelleZuDatensaetze, type Datensatz } from './csv'
import { erkannteKopfwoerter, zielFeldFuerKopf, type ZielFeld } from './kopfwort'
import { klassifizieren, urlFinden, type UrlTeile } from './linkedinUrl'
import { nameBereinigen, parseAnrede, parseName } from './name'
import { RECHTSFORM, ROLLENWORT, rolleAus } from './rolle'

export type Format = 'json' | 'mdtabelle' | 'csv' | 'zeilen' | 'leer'
export type SchnellimportErgebnis = { format: Format; zeilen: SchnellimportZeile[] }

// ── Normalisieren ───────────────────────────────────────────────────────────
const ZERO_WIDTH = /[​-‍﻿]/g
const CODEBLOCK = /^\s*```[a-z]*\s*$/i

export function normalisieren(eingabe: string): string[] {
  return eingabe
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(ZERO_WIDTH, '')
    .split('\n')
    .filter((z) => !CODEBLOCK.test(z))
}

// ── Format-Erkennung ────────────────────────────────────────────────────────
export function erkenneFormat(zeilen: readonly string[]): Format {
  const voll = zeilen.filter((z) => z.trim() !== '').slice(0, 5)
  if (voll.length === 0) return 'leer'
  const erste = (voll[0] as string).trim()
  if (erste.startsWith('[') || erste.startsWith('{')) return 'json'
  if (voll.filter((z) => z.trim().startsWith('|')).length >= 2) return 'mdtabelle'
  if (/[,;]/.test(erste)) {
    const delim = erste.split(';').length > erste.split(',').length ? ';' : ','
    const kopf = erste.split(delim).map((k) => k.trim())
    if (erkannteKopfwoerter(kopf) >= 2) return 'csv'
  }
  return 'zeilen'
}

// ── Gemeinsamer Zeilen-Bau ──────────────────────────────────────────────────
type Roh = {
  zeile: number
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  salutation?: string | null
  company?: string | null
  role_title?: string | null
  linkedin_url?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
}

const leer = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim()
  return t === '' ? null : t
}

function bauen(r: Roh): SchnellimportZeile | null {
  const url: UrlTeile = klassifizieren(r.linkedin_url)
  let name: ReturnType<typeof parseName>
  const vor = leer(r.first_name)
  const nach = leer(r.last_name)
  if (vor && nach) {
    // Getrennte Spalten: Anrede/Titel aus dem Vornamen-Feld, Nachname exakt wie geliefert (inkl. Partikel)
    const v = parseName(`${vor} \u0000`)
    const n = nameBereinigen(nach)
    name = {
      name: [v.title, v.first_name, n].filter(Boolean).join(' '),
      first_name: v.first_name,
      last_name: n,
      title: v.title,
      salutation: v.salutation,
    }
  } else if (vor) {
    name = parseName(vor)
  } else if (nach) {
    const n = nameBereinigen(nach)
    name = { name: n, first_name: null, last_name: n, title: null, salutation: null }
  } else {
    name = parseName(r.name)
  }
  const salutation: Salutation | null = parseAnrede(r.salutation) ?? name.salutation
  const hatName = !!(name.first_name || name.last_name)
  if (!hatName && !url.linkedin_url) return null
  const role_title = leer(r.role_title)
  const z: SchnellimportZeile = {
    zeile: r.zeile,
    name: name.name,
    first_name: name.first_name,
    last_name: name.last_name,
    title: name.title,
    salutation,
    company: leer(r.company),
    role_title,
    role: rolleAus(role_title),
    linkedin_url: url.linkedin_url,
    linkedin_url_norm: url.linkedin_url_norm,
    url_art: url.url_art,
    city: leer(r.city),
    phone: leer(r.phone),
    email: leer(r.email),
    status_lokal: 'neu',
  }
  // Name + Nummer (oder E-Mail) ist ein vollständiger Telefon-/Mail-Lead, auch ohne LinkedIn-Profil
  const kontakt = !!(z.phone || z.email)
  z.status_lokal = !hatName
    ? 'unvollstaendig'
    : z.url_art === 'sales_nav'
      ? 'sales_nav'
      : z.url_art === 'firmenseite'
        ? 'firmenseite'
        : z.url_art === 'person' || kontakt
          ? 'neu'
          : 'unvollstaendig'
  return z
}

function datensaetzeZuZeilen(ds: readonly Datensatz[]): SchnellimportZeile[] {
  const out: SchnellimportZeile[] = []
  for (const d of ds) {
    const z = bauen({ zeile: d._zeile, ...d })
    if (z) out.push(z)
  }
  return out
}

// ── JSON ────────────────────────────────────────────────────────────────────
function jsonObjekte(text: string): Record<string, unknown>[] | null {
  let wert: unknown
  try {
    wert = JSON.parse(text)
  } catch {
    return null
  }
  if (Array.isArray(wert)) return wert.filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
  if (wert && typeof wert === 'object') {
    const o = wert as Record<string, unknown>
    const liste = Object.values(o).find((v) => Array.isArray(v))
    if (Array.isArray(liste)) return liste.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    return [o]
  }
  return null
}

function parseJson(zeilen: readonly string[]): SchnellimportZeile[] {
  const objekte = jsonObjekte(zeilen.join('\n'))
  if (!objekte) return []
  const ds: Datensatz[] = objekte.map((o, i) => {
    const d: Datensatz = { _zeile: i + 1 }
    const belegt = new Set<ZielFeld>()
    for (const [k, v] of Object.entries(o)) {
      const feld = zielFeldFuerKopf(k)
      if (!feld || belegt.has(feld) || v == null) continue
      const s = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null
      if (s === null || s.trim() === '') continue
      d[feld] = s
      belegt.add(feld)
    }
    return d
  })
  return datensaetzeZuZeilen(ds)
}

// ── Markdown-Tabelle ────────────────────────────────────────────────────────
const MD_LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g
const TRENNZEILE = /^\|?\s*:?-{2,}/

function mdZellen(zeile: string): string[] {
  let s = zeile.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) =>
    c
      .replace(MD_LINK, '$2')
      .replace(/\*\*|__/g, '')
      .trim(),
  )
}

function parseMdTabelle(zeilen: readonly string[]): SchnellimportZeile[] {
  const indexiert = zeilen.map((text, i) => ({ text, nr: i + 1 })).filter((z) => z.text.trim().startsWith('|'))
  const kopfZeile = indexiert.shift()
  if (!kopfZeile) return []
  const mapping = mappeKopf(mdZellen(kopfZeile.text))
  const ds: Datensatz[] = []
  for (const z of indexiert) {
    if (TRENNZEILE.test(z.text.trim())) continue
    const zellen = mdZellen(z.text)
    const d = tabelleZuDatensaetze([zellen], mapping, z.nr)[0]
    if (d) ds.push(d)
  }
  return datensaetzeZuZeilen(ds)
}

// ── CSV ─────────────────────────────────────────────────────────────────────
function parseCsvBlock(zeilen: readonly string[]): SchnellimportZeile[] {
  const erste = zeilen.findIndex((z) => z.trim() !== '')
  const t = parseCsv(zeilen.slice(erste).join('\n'))
  const mapping = mappeKopf(t.kopf)
  return datensaetzeZuZeilen(tabelleZuDatensaetze(t.zeilen, mapping, erste + 2))
}

// ── Freie Zeilen (nummeriert, Aufzählung, Mischform) ─────────────────────────
const PREFIX = /^\s*(\d+[.)]|[-*•–])\s*/
const SUBZEILE =
  /^\s+[-*•]?\s*(Unternehmen|Firma|Position|Rolle|LinkedIn|URL|Ort|Stadt|Anrede|Telefon|Tel\.?|Mobil|Nummer|E-?Mail)\s*:\s*(.+)$/i
/** Telefonnummer als eigenes Segment: „+49 40 123456“, „040/123 45-6“, „(0)40 …“ – mindestens 6 Ziffern, sonst nur Zeichen */
const TELEFON = /^(tel\.?|telefon|mobil|zentrale|durchwahl)?\s*:?\s*(\+?[\d\s()/.-]{6,})$/i
const EMAIL = /^(e-?mail\s*:?\s*)?([^\s@]+@[^\s@]+\.[a-z]{2,})$/i
const SEPARATOREN = [' – ', ' — ', ' - ', ' | ', ', '] as const
const KLAMMER = /^(.*?)\s*\(([^()]*)\)\s*$/
const ORT = /^(ort|stadt|city)\s*:\s*(.+)$/i

function fettWeg(s: string): string {
  return s.replace(MD_LINK, '$2').replace(/\*\*|__|`/g, '')
}

/** Zerlegt einen Text rekursiv: je Ebene gewinnt der erste vorkommende Separator. */
function segmente(text: string, ebene = 0): string[] {
  for (let i = ebene; i < SEPARATOREN.length; i++) {
    const sep = SEPARATOREN[i] as string
    if (!text.includes(sep)) continue
    return text
      .split(sep)
      .map((t) => t.trim())
      .filter((t) => t !== '')
      .flatMap((t) => segmente(t, i + 1))
  }
  const t = text.trim()
  return t === '' ? [] : [t]
}

function sieht_nach_name_aus(seg: string): boolean {
  const s = nameBereinigen(seg)
  if (s === '' || /\d/.test(s)) return false
  const woerter = s.split(' ')
  if (woerter.length > 6) return false
  // mindestens ein Großbuchstabe am Wortanfang (Namen stehen nie komplett klein)
  return woerter.some((w) => /^[A-ZÄÖÜ]/.test(w))
}

type Person = Roh & { _text: string }

function personZeile(text: string, nr: number): Person | null {
  const ohnePrefix = text.replace(PREFIX, '')
  const hatPrefix = ohnePrefix !== text
  const { url, rest } = urlFinden(fettWeg(ohnePrefix))
  // Nach dem Entfernen der URL bleibt oft ein Trenner am Rand („… GmbH –“) übrig
  const inhalt = rest
    .replace(/\s+/g, ' ')
    .replace(/^[\s–—|,;-]+|[\s–—|,;-]+$/g, '')
    .trim()
  const hatSeparator = SEPARATOREN.some((s) => inhalt.includes(s))
  // Überschriften, Fließtext, „Hier ist die Liste:“ – ohne URL, ohne Prefix, ohne Trenner
  if (!url && !hatPrefix && !hatSeparator) return null
  if (!url && /:\s*$/.test(inhalt)) return null
  if (/^#/.test(inhalt)) return null
  const segs = segmente(inhalt)
  const p: Person = { zeile: nr, _text: inhalt, linkedin_url: url }
  const erstes = segs.shift()
  if (erstes !== undefined) {
    const km = KLAMMER.exec(erstes)
    if (km) {
      p.name = km[1] ?? null
      p.city = km[2] ?? null
    } else p.name = erstes
    if (!sieht_nach_name_aus(p.name ?? '')) {
      if (!url) return null
      p.name = null
    }
  }
  const rest2: string[] = []
  for (let seg of segs) {
    const km = KLAMMER.exec(seg)
    if (km) {
      if (!p.city) p.city = km[2] ?? null
      seg = (km[1] ?? '').trim()
      if (seg === '') continue
    }
    const om = ORT.exec(seg)
    if (om) {
      p.city = om[2] ?? null
      continue
    }
    const tm = TELEFON.exec(seg)
    if (!p.phone && tm && (tm[2] ?? '').replace(/\D/g, '').length >= 6) {
      p.phone = (tm[2] ?? '').trim()
      continue
    }
    const em = EMAIL.exec(seg)
    if (!p.email && em) {
      p.email = em[2] ?? null
      continue
    }
    if (!p.company && RECHTSFORM.test(seg)) p.company = seg
    else if (!p.role_title && ROLLENWORT.test(seg)) p.role_title = seg
    else rest2.push(seg)
  }
  if (!p.company && rest2.length > 0) p.company = rest2.pop() ?? null
  return p
}

function parseZeilen(zeilen: readonly string[]): SchnellimportZeile[] {
  const personen: Person[] = []
  zeilen.forEach((text, i) => {
    if (text.trim() === '') return
    const sub = SUBZEILE.exec(text)
    const letzte = personen[personen.length - 1]
    if (sub && letzte && /^\s/.test(text)) {
      const schluessel = (sub[1] as string).toLowerCase()
      const wert = (sub[2] as string).trim()
      if (/unternehmen|firma/.test(schluessel)) letzte.company = wert
      else if (/position|rolle/.test(schluessel)) letzte.role_title = wert
      else if (/linkedin|url/.test(schluessel)) letzte.linkedin_url = fettWeg(wert)
      else if (/ort|stadt/.test(schluessel)) letzte.city = wert
      else if (/anrede/.test(schluessel)) letzte.salutation = wert
      else if (/mail/.test(schluessel)) letzte.email = wert
      else if (/tel|mobil|nummer/.test(schluessel)) letzte.phone = wert
      return
    }
    const p = personZeile(text, i + 1)
    if (p) personen.push(p)
  })
  const out: SchnellimportZeile[] = []
  for (const p of personen) {
    const z = bauen(p)
    if (z) out.push(z)
  }
  return out
}

// ── Dedupe innerhalb der Liste (§ 6.3 DEDUPE LISTE) ─────────────────────────
export function listeDedupe(zeilen: SchnellimportZeile[]): SchnellimportZeile[] {
  const gesehen = new Set<string>()
  return zeilen.map((z) => {
    if (!z.linkedin_url_norm) return z
    if (gesehen.has(z.linkedin_url_norm)) return { ...z, status_lokal: 'dublette_liste' }
    gesehen.add(z.linkedin_url_norm)
    return z
  })
}

// ── Einstieg ────────────────────────────────────────────────────────────────
export function parseSchnellimport(eingabe: string): SchnellimportErgebnis {
  const zeilen = normalisieren(eingabe)
  const format = erkenneFormat(zeilen)
  let out: SchnellimportZeile[]
  switch (format) {
    case 'leer':
      out = []
      break
    case 'json':
      out = parseJson(zeilen)
      if (out.length === 0) out = parseZeilen(zeilen)
      break
    case 'mdtabelle':
      out = parseMdTabelle(zeilen)
      break
    case 'csv':
      out = parseCsvBlock(zeilen)
      break
    default:
      out = parseZeilen(zeilen)
  }
  return { format, zeilen: listeDedupe(out) }
}
