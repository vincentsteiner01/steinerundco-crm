// Kontext einer Meldung – im Moment des Öffnens festgehalten (vor dem Dialog): Seite, Fenster, Browser, Version, Konsole.
import { env } from '@/data/env'
import { konsolenEintraege, type KonsolenEintrag } from './konsoleText'

export type FeedbackKontext = {
  route: string
  url: string
  /** „1440×900 @2x“ – CSS-Pixel des Fensters, Pixeldichte */
  viewport: string
  breite: number
  user_agent: string
  app_version: string
  konsole: KonsolenEintrag[]
}

export function sammleKontext(w: Window = window): FeedbackKontext {
  const dpr = Math.round((w.devicePixelRatio || 1) * 100) / 100
  return {
    route: `${w.location.pathname}${w.location.search}`,
    url: w.location.href,
    viewport: `${w.innerWidth}×${w.innerHeight} @${dpr}x`,
    breite: w.innerWidth,
    user_agent: w.navigator.userAgent,
    app_version: env.VITE_APP_VERSION,
    konsole: konsolenEintraege(),
  }
}

/** „Chrome 141 · macOS“ aus dem User-Agent – nur für die Anzeige (gespeichert wird der volle String). */
export function kurzBrowser(ua: string | null | undefined): string {
  if (!ua) return '–'
  const treffer = (re: RegExp) => re.exec(ua)?.[1]
  const edge = treffer(/Edg\/(\d+)/)
  const chrome = treffer(/(?:Chrome|CriOS)\/(\d+)/)
  const firefox = treffer(/(?:Firefox|FxiOS)\/(\d+)/)
  const safari = treffer(/Version\/(\d+(?:\.\d+)?).*Safari/)
  const browser = edge
    ? `Edge ${edge}`
    : chrome
      ? `Chrome ${chrome}`
      : firefox
        ? `Firefox ${firefox}`
        : safari
          ? `Safari ${safari}`
          : 'Browser'
  const system = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return system ? `${browser} · ${system}` : browser
}
