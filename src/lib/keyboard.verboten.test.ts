// Lint-Test (BAUPLAN § 3.1.8 / § 1.5 Nr. 23): kbd-Props gegen VERBOTEN; Literal-Scan src/features/** (§ 4.6).
// Die Registries (app/tasten.ts, app/befehle.ts) sind mit Palette und Tastenliste entfallen (Neustart 25.11.2026).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { anzeigeNachBinding, VERBOTEN } from './keyboard'

const wurzel = join(process.cwd(), 'src')

function dateien(dir: string, filter: (f: string) => boolean, acc: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) dateien(p, filter, acc)
    else if (filter(p)) acc.push(p)
  }
  return acc
}

describe('VERBOTEN', () => {
  it('enthält die Browser-Kombinationen aus § 1.5 Nr. 23', () => {
    for (const k of [
      'mod+n',
      'mod+r',
      'mod+1',
      'mod+0',
      'mod+shift+a',
      'mod+shift+b',
      'mod+shift+c',
      'mod+shift+d',
      'mod+shift+h',
      'mod+shift+i',
      'mod+shift+l',
      'mod+shift+m',
      'mod+shift+v',
    ]) {
      expect(VERBOTEN).toContain(k)
    }
  })

  it('kbd-Props in components/aktionen/* sind nicht verboten', () => {
    const dir = join(wurzel, 'components', 'aktionen')
    let files: string[] = []
    try {
      files = dateien(dir, (f) => /\.tsx?$/.test(f))
    } catch {
      files = []
    }
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/kbd\s*[=:]\s*["'`]([^"'`]+)["'`]/g)) {
        const t = m[1] ?? ''
        if (!/[⌘⌥⇧]|Ctrl/.test(t)) continue
        expect(VERBOTEN, `${f}: „${t}“`).not.toContain(anzeigeNachBinding(t))
      }
    }
  })

  it('src/features/** enthält keine Vorlagen-/Sequenz-Schlüssel als Literal (§ 4.6)', () => {
    const files = dateien(join(wurzel, 'features'), (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    const treffer: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      if (/['"`](li|tel|em)_[a-z0-9_]+['"`]/.test(src)) treffer.push(f)
      if (/enroll\(\s*['"`]/.test(src)) treffer.push(f)
    }
    expect(treffer).toEqual([])
  })
})
