// DNS-Prüfung einer Versand-Domain direkt aus dem Browser (DNS-over-HTTPS bei dns.google, CORS erlaubt – geprüft 01.11.2026;
// dns.google steht deshalb in connect-src der CSP, vite.config.ts und public/.htaccess).
// Geprüft wird, was Gmail, Yahoo, Microsoft und die deutschen Anbieter verlangen (Recherche 02 § 3): MX, genau ein SPF mit dem
// Dienst des Postfachs, DKIM (Schlüssellänge aus dem öffentlichen Schlüssel geschätzt) und DMARC mit Berichtsadresse.
import type { Anbieter } from './logik'

type DohAntwort = { Status: number; Answer?: { type: number; data: string }[] }

export type DnsTeil = { ok: boolean; wert?: string | null; hinweis?: string | null }
export type DnsErgebnis = {
  ok: boolean
  mx: DnsTeil & { hosts?: string[] }
  spf: DnsTeil
  dkim: DnsTeil & { selector?: string | null; bits?: number | null }
  dmarc: DnsTeil & { policy?: string | null; rua?: boolean }
  geprueft_at: string
}

const SPF_INCLUDE: Partial<Record<Anbieter, string>> = {
  google: 'include:_spf.google.com',
  ionos: 'include:_spf-eu.ionos.com',
  strato: 'include:spf.strato.de',
}

const DKIM_SELEKTOREN: Partial<Record<Anbieter, string[]>> = {
  google: ['google'],
  ionos: ['s1-ionos', 's2-ionos'],
  strato: ['strato-dkim-0001', 'strato-dkim-0002'],
}

export async function doh(name: string, typ: 'MX' | 'TXT', f: typeof fetch = fetch): Promise<string[] | null> {
  try {
    const r = await f(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${typ}`, {
      headers: { accept: 'application/dns-json' },
    })
    if (!r.ok) return null
    const j = (await r.json()) as DohAntwort
    if (j.Status === 3) return []
    if (j.Status !== 0) return null
    const nr = typ === 'MX' ? 15 : 16
    return (j.Answer ?? [])
      .filter((a) => a.type === nr)
      .map((a) => (typ === 'TXT' ? a.data.replace(/"\s*"/g, '').replace(/^"|"$/g, '') : a.data))
  } catch {
    return null
  }
}

/** Schlüssellänge eines DKIM-Eintrags (p=…) – grob aus der Länge des öffentlichen RSA-Schlüssels. */
export function dkimBits(eintrag: string): number | null {
  const p = /(?:^|;)\s*p=([A-Za-z0-9+/=\s]*)/.exec(eintrag)?.[1]?.replace(/\s+/g, '') ?? ''
  if (!p) return null
  const bytes = Math.floor((p.length * 3) / 4) - (p.endsWith('==') ? 2 : p.endsWith('=') ? 1 : 0)
  const roh = (bytes - 38) * 8
  return [1024, 2048, 3072, 4096].reduce((best, b) => (Math.abs(b - roh) < Math.abs(best - roh) ? b : best), 1024)
}

/** DNS-Lookups im SPF grob zählen (nur die erste Ebene: include, a, mx, ptr, exists, redirect). */
export function spfLookups(spf: string): number {
  return (spf.match(/\b(include:|a\b|a:|mx\b|mx:|ptr|exists:|redirect=)/gi) ?? []).length
}

export async function dnsPruefen(
  domain: string,
  anbieter: Anbieter,
  eigenerSelector?: string | null,
  f: typeof fetch = fetch,
): Promise<DnsErgebnis> {
  const d = domain.trim().toLowerCase()
  const [mx, txt, dmarcTxt] = await Promise.all([doh(d, 'MX', f), doh(d, 'TXT', f), doh(`_dmarc.${d}`, 'TXT', f)])

  const hosts = (mx ?? []).map((x) => x.split(/\s+/)[1]?.replace(/\.$/, '') ?? '').filter((h) => h && h !== '.')
  const mxTeil = {
    ok: hosts.length > 0,
    hosts,
    hinweis: mx === null ? 'DNS nicht erreichbar' : hosts.length ? null : 'Kein MX-Eintrag',
  }

  const spfe = (txt ?? []).filter((t) => /^v=spf1\b/i.test(t))
  const include = SPF_INCLUDE[anbieter]
  const spf = spfe[0] ?? null
  let spfHinweis: string | null = null
  if (!spfe.length) spfHinweis = 'Kein SPF-Eintrag'
  else if (spfe.length > 1) spfHinweis = 'Mehr als ein SPF-Eintrag – zusammenführen'
  else if (include && !spf!.toLowerCase().includes(include)) spfHinweis = `SPF ohne „${include}“`
  else if (spfLookups(spf!) > 10) spfHinweis = 'SPF hat mehr als 10 Abfragen'
  else if (!/[~-]all\b/i.test(spf!)) spfHinweis = 'SPF endet nicht mit ~all oder -all'
  const spfTeil = { ok: spfe.length === 1 && !spfHinweis, wert: spf, hinweis: spfHinweis }

  const selektoren = eigenerSelector?.trim() ? [eigenerSelector.trim()] : (DKIM_SELEKTOREN[anbieter] ?? [])
  let dkimTeil: DnsErgebnis['dkim'] = {
    ok: false,
    selector: null,
    bits: null,
    hinweis: selektoren.length ? 'Kein DKIM-Schlüssel gefunden' : 'DKIM-Selektor eintragen',
  }
  for (const s of selektoren) {
    const t = await doh(`${s}._domainkey.${d}`, 'TXT', f)
    const eintraege = (t ?? []).filter((x) => /v=DKIM1|p=/i.test(x))
    const eintrag = eintraege[0]
    if (eintrag) {
      const bits = dkimBits(eintrag)
      // Zwei Schlüssel unter demselben Namen (z. B. alter Workspace + neuer): Empfänger nehmen einen zufälligen, DKIM scheitert mal.
      const doppelt = eintraege.length > 1
      dkimTeil = {
        ok: !doppelt && !!bits && bits >= 1024,
        selector: s,
        bits,
        wert: `${eintrag.slice(0, 60)}…`,
        hinweis: doppelt
          ? `${eintraege.length} DKIM-Schlüssel unter „${s}._domainkey“ – den alten löschen`
          : bits && bits < 2048
            ? `Nur ${bits} Bit – 2048 Bit empfohlen`
            : null,
      }
      break
    }
  }

  const dmarc = (dmarcTxt ?? []).find((t) => /^v=DMARC1\b/i.test(t)) ?? null
  const policy = dmarc ? (/\bp=(none|quarantine|reject)\b/i.exec(dmarc)?.[1]?.toLowerCase() ?? null) : null
  const rua = !!dmarc && /\brua=mailto:/i.test(dmarc)
  const dmarcTeil = {
    ok: !!dmarc && !!policy,
    wert: dmarc,
    policy,
    rua,
    hinweis: !dmarc
      ? 'Kein DMARC-Eintrag'
      : !policy
        ? 'DMARC ohne p='
        : !rua
          ? 'Ohne Berichtsadresse (rua) – Berichte helfen bei der Fehlersuche'
          : null,
  }

  return {
    ok: mxTeil.ok && spfTeil.ok && dkimTeil.ok && dmarcTeil.ok,
    mx: mxTeil,
    spf: spfTeil,
    dkim: dkimTeil,
    dmarc: dmarcTeil,
    geprueft_at: new Date().toISOString(),
  }
}

export type Eintrag = { typ: 'TXT' | 'MX' | 'CNAME'; name: string; wert: string; warum: string }

/** Einträge zum Kopieren beim Domain-Anbieter (IONOS, Strato …). DKIM erzeugt der Mail-Anbieter selbst. */
export function empfohleneEintraege(domain: string, anbieter: Anbieter): Eintrag[] {
  const d = domain.trim().toLowerCase()
  const include = SPF_INCLUDE[anbieter] ?? 'include:<Mail-Anbieter>'
  const liste: Eintrag[] = [
    {
      typ: 'TXT',
      name: d,
      wert: `v=spf1 ${include} ~all`,
      warum:
        'SPF sagt den Empfängern, welche Server für diese Domain senden dürfen. Ohne SPF landet fast alles im Spam.',
    },
    {
      typ: 'TXT',
      name: `_dmarc.${d}`,
      wert: `v=DMARC1; p=none; rua=mailto:dmarc@${d}; adkim=r; aspf=r`,
      warum:
        'DMARC verlangen Gmail, Yahoo und Microsoft. Erst „p=none“, nach 1–2 sauberen Wochen auf „p=quarantine“ stellen.',
    },
  ]
  if (anbieter === 'google')
    liste.push(
      {
        typ: 'MX',
        name: d,
        wert: 'smtp.google.com (Priorität 1)',
        warum: 'Damit Antworten ankommen. Google Workspace zeigt den Eintrag bei der Einrichtung an.',
      },
      {
        typ: 'TXT',
        name: `google._domainkey.${d}`,
        wert: 'Wert aus der Google Admin-Konsole → Gmail → E-Mails authentifizieren (2048 Bit)',
        warum:
          'DKIM unterschreibt jede Mail. Den Schlüssel erzeugt Google; danach dort „Authentifizierung starten“ klicken.',
      },
    )
  return liste
}

/** Links zu Blocklisten-Prüfungen (Spamhaus & Co. beantworten Abfragen über öffentliche Resolver nicht – deshalb Links). */
export function blocklistenLinks(domain: string): { label: string; url: string }[] {
  const d = encodeURIComponent(domain.trim().toLowerCase())
  return [
    { label: 'Spamhaus', url: `https://check.spamhaus.org/results/?query=${d}` },
    { label: 'Heatwave (Validity)', url: `https://lookup.validity.tools/?domain=${d}` },
    { label: 'MXToolbox', url: `https://mxtoolbox.com/SuperTool.aspx?action=blacklist%3a${d}` },
  ]
}
