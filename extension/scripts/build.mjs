// Baut die Erweiterung nach dist/ (Seiten + Service Worker, dann das Lese-Skript), schreibt manifest.json und packt
// steinerundco-crm-erweiterung.zip. Aufruf: npm run build (prüft vorher die Typen) oder node scripts/build.mjs.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const hier = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const DIST = hier('dist')
const ZIP = hier('steinerundco-crm-erweiterung.zip')

await build({ configFile: hier('vite.config.ts'), mode: 'production', logLevel: 'warn' })
await build({ configFile: hier('vite.lesen.config.ts'), mode: 'production', logLevel: 'warn' })

const pkg = JSON.parse(readFileSync(hier('package.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(hier('src/manifest.json'), 'utf8'))
manifest.version = pkg.version

// Supabase-Host aus dem Build muss zu host_permissions passen; nur der öffentliche Publishable Key darf im Bundle stehen.
const js = [`${DIST}/background.js`, ...readdirSync(`${DIST}/assets`).filter((d) => d.endsWith('.js')).map((d) => `${DIST}/assets/${d}`)]
  .map((d) => readFileSync(d, 'utf8'))
  .join('\n')
const url = /https:\/\/[a-z0-9]{20}\.supabase\.co/.exec(js)?.[0]
if (!url) throw new Error('Supabase-URL fehlt im Build – ../.env.production prüfen.')
if (!manifest.host_permissions.includes(`${url}/*`)) throw new Error(`host_permissions passen nicht zu ${url}`)
if (!/sb_publishable_/.test(js)) throw new Error('Publishable Key fehlt im Build.')
if (/sb_secret_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}/.test(js)) throw new Error('Schlüssel/JWT im Bundle – Abbruch.')

writeFileSync(`${DIST}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)

for (const datei of ['manifest.json', 'background.js', 'lesen.js', 'popup.html', 'sidepanel.html', 'optionen.html', 'eingang.html', 'icons/icon-128.png', 'fonts/geist-latin.woff2', 'avatars/vincent.webp']) {
  if (!existsSync(`${DIST}/${datei}`)) throw new Error(`dist/${datei} fehlt`)
}
const lesen = readFileSync(`${DIST}/lesen.js`, 'utf8')
if (/^\s*import\s|\bimport\(/m.test(lesen)) throw new Error('lesen.js darf keine Imports enthalten (executeScript)')

rmSync(ZIP, { force: true })
execFileSync('zip', ['-r', '-X', '-q', ZIP, '.'], { cwd: DIST })
console.log(`dist/ fertig (Version ${manifest.version}) · ${ZIP.split('/').pop()}`)
