import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { JSDOM } from 'jsdom'

export function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
}

/** Dokument wie im Browser-Tab: HTML + URL (location.href). */
export function dokument(name: string, url: string): Document {
  return new JSDOM(fixture(name), { url }).window.document
}
