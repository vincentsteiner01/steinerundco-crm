#!/usr/bin/env node
// Erzeugt src/test/fixtures/seedKeys.json aus Migration 2 (Sequenz-Schlüssel) und supabase/seed-privat/vorlagen.sql
// (Vorlagen-Schlüssel) – nur Schlüssel, keine Texte; darf ins öffentliche Repo (BAUPLAN § 4.6, § 1.5 Nr. 24).
//   node tools/seed-keys.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vorlagen = readFileSync(resolve(root, 'supabase/seed-privat/vorlagen.sql'), 'utf8')
const migration2 = readFileSync(resolve(root, 'supabase/migrations/20261014100002_crm_stammdaten.sql'), 'utf8')

// Vorlagen: jede Zeile eines insert into crm.templates-Blocks beginnt mit ('<key>', '<channel>', …
const templates = new Set()
for (const block of vorlagen.split(/insert into crm\.templates\b/).slice(1)) {
  const body = block.split(/\non conflict/)[0]
  for (const m of body.matchAll(/\(\s*'((?:li|tel|em)_[a-z0-9_]+)',\s*'(?:linkedin|telefon|email)'/g)) templates.add(m[1])
}

// Sequenzen: Zeilen ('<key>', '<name>', '<channel>', in insert into crm.sequences-Blöcken
const sequences = new Set()
for (const block of migration2.split(/insert into crm\.sequences\b/).slice(1)) {
  const body = block.split(/\non conflict/)[0]
  for (const m of body.matchAll(/\(\s*'([a-z0-9_]+)',\s*'[^']*',\s*'(?:linkedin|telefon|email)'/g)) sequences.add(m[1])
}

const out = { templates: [...templates].sort(), sequences: [...sequences].sort() }
const target = resolve(root, 'src/test/fixtures/seedKeys.json')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, JSON.stringify(out, null, 2) + '\n')
console.log(`seedKeys.json: ${out.templates.length} Vorlagen, ${out.sequences.length} Sequenzen → ${target}`)
