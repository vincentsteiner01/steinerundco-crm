// Jeder Link `[Text](/pfad)` in den Hilfe-Themen zeigt auf eine echte Seite (25.11.2026). Vorher prüfte das niemand: nach dem
// Neustart standen Verweise auf /heute, /kpis, /feedback und entfernte Einstellungs-Bereiche im Handbuch. Geprüft wird gegen die
// Routentabelle (ROUTEN): Weiterleitungen alter Adressen und die Seite „nicht gefunden“ zählen nicht als Ziel.
// 26.11.2026: /kpis ist wieder eine echte Seite und ein gültiges Ziel.
import { matchRoutes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/data/supabase', async () => (await import('@/test/supabaseMock')).supabaseMock())
// Nur die Routentabelle zählt – Hülle und Anmeldung werden nicht geladen
vi.mock('@/features/auth/RequireAuth', () => ({ RequireAuth: () => null }))
vi.mock('@/app/shell/AppShell', () => ({ AppShell: () => null }))

import { ROUTEN } from '@/app/router'
import { linkZiele } from './markup'
import { HAEUFIGE_FRAGEN, THEMEN, themaRohtexte, themaVon } from './themen'

/** Die fünf Bereiche der Einstellungen nach dem Neustart – `/einstellungen/:bereich` nähme sonst jeden Namen an. */
const BEREICHE = ['profil', 'passcode', 'sperrliste', 'feiertage', 'export']

/** `null` = Ziel in Ordnung, sonst der Grund. */
function mangel(ziel: string): string | null {
  if (!ziel.startsWith('/') || ziel.startsWith('//')) return 'kein interner Pfad'
  const pfad = ziel.split(/[?#]/)[0]!
  const route = matchRoutes(ROUTEN, pfad)?.at(-1)?.route
  // Echte Seiten werden nachgeladen (`lazy`); Weiterleitungen sind feste Elemente, `*` ist „Seite nicht gefunden“
  if (!route?.lazy || route.path === '*') return 'keine Seite unter dieser Adresse'
  const [, erster, zweiter] = pfad.split('/')
  if (erster === 'einstellungen' && !BEREICHE.includes(zweiter ?? ''))
    return 'diesen Bereich der Einstellungen gibt es nicht'
  if (erster === 'hilfe' && zweiter && !themaVon(zweiter)) return 'dieses Hilfe-Thema gibt es nicht'
  return null
}

describe('Links in den Hilfe-Themen', () => {
  it('die Prüfung erkennt tote Ziele', () => {
    for (const gut of [
      '/leads',
      '/leitfaeden',
      '/email',
      '/email/kampagnen',
      '/kpis',
      '/team',
      '/hilfe',
      '/hilfe/leads',
      '/hilfe/kpis',
    ])
      expect(mangel(gut), gut).toBeNull()
    for (const b of BEREICHE) expect(mangel(`/einstellungen/${b}`), b).toBeNull()
    for (const tot of [
      '/heute',
      '/telefon',
      '/feedback',
      '/auftrag',
      '/leads/papierkorb',
      '/leads/abc', // nur noch Weiterleitung aufs Board
      '/leitfaeden/neu',
      '/einstellungen', // Weiterleitung aufs Profil
      '/einstellungen/ziele',
      '/einstellungen/sequenzen',
      '/einstellungen/verbindungen',
      '/einstellungen/verbindungen?tab=eingang',
      '/hilfe/dein-tag',
      '/hilfe/verbindungen',
      '/hilfe/kpis-team',
      '/gibt-es-nicht',
      'https://example.com',
    ])
      expect(mangel(tot), tot).not.toBeNull()
  })

  it('jeder Link passt auf eine Route aus ROUTEN', () => {
    const fehler: string[] = []
    let anzahl = 0
    for (const t of THEMEN)
      for (const person of [null, 'vincent', 'mike'] as const)
        for (const text of themaRohtexte(t, person))
          for (const ziel of linkZiele(text)) {
            anzahl += 1
            const grund = mangel(ziel)
            if (grund) fehler.push(`${t.key}: ${ziel} – ${grund}`)
          }
    expect(fehler).toEqual([])
    // die Prüfung läuft nicht ins Leere
    expect(anzahl).toBeGreaterThan(10)
  })

  it('die Hauptseiten und alle fünf Einstellungs-Bereiche sind aus der Hilfe erreichbar', () => {
    const ziele = new Set(THEMEN.flatMap((t) => themaRohtexte(t).flatMap(linkZiele)))
    for (const pfad of [
      '/leads',
      '/leitfaeden',
      '/email',
      '/email/kampagnen',
      '/email/antworten',
      '/email/postfaecher',
      '/kpis',
      '/team',
    ])
      expect(ziele, pfad).toContain(pfad)
    for (const b of BEREICHE) expect(ziele, b).toContain(`/einstellungen/${b}`)
  })

  it('häufige Fragen enthalten keine Links (die Übersicht zeigt sie als reinen Text)', () => {
    for (const f of HAEUFIGE_FRAGEN) expect(linkZiele(`${f.frage} ${f.antwort}`), f.frage).toEqual([])
  })
})
