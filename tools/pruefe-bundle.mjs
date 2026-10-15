#!/usr/bin/env node
// Performance-Budget (BAUPLAN E22, architektur § 7.2): summiert gzip-Größen der in index.html
// referenzierten Assets und bricht mit Exit 1 ab, wenn ein Budget überschritten ist.
//   node tools/pruefe-bundle.mjs dist
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { gzipSync } from 'node:zlib'

const KB = 1024
const BUDGET = { initialJs: 220 * KB, initialCss: 30 * KB, routenChunk: 80 * KB, xlsx: 450 * KB, fonts: 180 * KB }

const dist = process.argv[2] ?? 'dist'
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const gz = (p) => gzipSync(readFileSync(p)).length
const fmt = (n) => `${(n / KB).toFixed(1)} kB`

const refs = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+)"/g)].map((m) => m[1])
const initialJs = refs.filter((r) => r.endsWith('.js'))
const initialCss = refs.filter((r) => r.endsWith('.css'))

let fehler = 0
const pruefe = (label, ist, soll) => {
  const ok = ist <= soll
  if (!ok) fehler++
  console.log(`${ok ? 'ok  ' : 'ZU GROSS'}  ${label.padEnd(34)} ${fmt(ist).padStart(10)}  (Budget ${fmt(soll)})`)
}

const jsSum = initialJs.reduce((s, r) => s + gz(join(dist, r)), 0)
const cssSum = initialCss.reduce((s, r) => s + gz(join(dist, r)), 0)
pruefe('Initiales JS (gzip)', jsSum, BUDGET.initialJs)
pruefe('Initiales CSS (gzip)', cssSum, BUDGET.initialCss)

const assets = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'))
for (const f of assets) {
  const rel = `assets/${f}`
  if (initialJs.includes(rel)) continue
  const size = gz(join(dist, rel))
  if (/^xlsx-/.test(f)) pruefe(`xlsx-Chunk ${f}`, size, BUDGET.xlsx)
  else pruefe(`Routen-Chunk ${basename(f)}`, size, BUDGET.routenChunk)
}

let fontSum = 0
try {
  for (const f of readdirSync(join(dist, 'fonts')))
    if (f.endsWith('.woff2')) fontSum += statSync(join(dist, 'fonts', f)).size
  pruefe('Fonts (woff2, roh)', fontSum, BUDGET.fonts)
} catch {
  /* keine Fonts im Build */
}

if (fehler) {
  console.error(`\n${fehler} Budget-Verstoß/-Verstöße – Build abgebrochen.`)
  process.exit(1)
}
console.log('\nBundle-Budget eingehalten.')
