// Empfänger-Domains einem Mail-Anbieter zuordnen (MX per DNS-over-HTTPS, Mail-Motor 01.11.2026). Zweck: Domains ohne
// Mailserver gar nicht erst anschreiben (spart Bounces) und Kennzahlen je Anbieterklasse – T-Online, GMX/WEB.DE, IONOS und
// Strato filtern anders als Gmail (Recherche 02-zustellbarkeit § 12). Keine SMTP-Proben: Port 25 ist gesperrt, und Microsoft
// verbietet „namespace mining“.

export type MxKlasse =
  | 'google'
  | 'microsoft'
  | 'ionos'
  | 'strato'
  | 'tonline'
  | 'gmx_webde'
  | 'allinkl'
  | 'gateway'
  | 'sonstige'
  | 'kein_mx'

const REGELN: [MxKlasse, RegExp][] = [
  ['gateway', /(pphosted\.com|mimecast\.com|barracudanetworks\.com|iphmx\.com|messagelabs\.com|hornetsecurity\.com|antispameurope\.com|spamexperts\.|retarus\.|nospamproxy|expurgate\.net)$/],
  ['google', /(^|\.)(google\.com|googlemail\.com)$/],
  ['microsoft', /(^|\.)(outlook\.com|protection\.outlook\.com|hotmail\.com)$/],
  ['ionos', /(^|\.)(ionos\.[a-z.]+|kundenserver\.de|1and1\.[a-z.]+|schlund\.de|perfora\.net)$/],
  ['strato', /(^|\.)(rzone\.de|strato\.[a-z]+)$/],
  ['tonline', /(^|\.)t-online\.de$/],
  ['gmx_webde', /(^|\.)(gmx\.(net|de|com|at|ch)|web\.de|mail\.com|1und1\.de)$/],
  ['allinkl', /(^|\.)kasserver\.com$/],
]

/** MX-Hosts (ohne Punkt am Ende) → Klasse. Leere Liste oder Null-MX („.“) = kein Mailserver. */
export function mxKlasse(hosts: string[]): MxKlasse {
  const h = hosts.map((x) => x.toLowerCase().replace(/\.$/, '')).filter((x) => x && x !== '.')
  if (!h.length) return 'kein_mx'
  for (const [klasse, re] of REGELN) if (h.some((x) => re.test(x))) return klasse
  return 'sonstige'
}

type DohAntwort = { Status: number; Answer?: { type: number; data: string }[] }

/** MX abfragen; null = DNS gerade nicht erreichbar (später erneut). */
export async function mxAbfragen(domain: string, f: typeof fetch = fetch): Promise<{ klasse: MxKlasse; hosts: string[] } | null> {
  try {
    const r = await f(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const j = (await r.json()) as DohAntwort
    if (j.Status === 3) return { klasse: 'kein_mx', hosts: [] } // NXDOMAIN: Domain gibt es nicht
    if (j.Status !== 0) return null
    const hosts = (j.Answer ?? [])
      .filter((a) => a.type === 15)
      .map((a) => a.data.trim().split(/\s+/))
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map((x) => (x[1] ?? '').replace(/\.$/, '') || '.')
    return { klasse: mxKlasse(hosts), hosts: hosts.slice(0, 5) }
  } catch {
    return null
  }
}
