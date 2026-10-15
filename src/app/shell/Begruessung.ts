// Voice-Zeile nach Tageszeit (ux § 3.1.1): „Guten Morgen, Vincent.“ / „Guten Tag, …“ / „Guten Abend, …“
const TZ = 'Europe/Berlin'

export function stundeBerlin(d: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: 'numeric', hour12: false }).format(d).replace(/\D/g, ''),
  )
}

export function begruessung(name: string, d: Date = new Date()): string {
  const h = stundeBerlin(d)
  const gruss = h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : 'Guten Abend'
  return `${gruss}, ${name}.`
}
