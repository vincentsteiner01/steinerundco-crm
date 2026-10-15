// „Noch nicht anrufbar“ nach Grund (Runde 3, echte Daten: 119 ohne Nummer + 2 Firma gesperrt hießen „121 warten auf einen
// Anrufgrund“ mit dem Knopf „Anrufgrund setzen“).
import { describe, expect, it, vi } from 'vitest'
import type { GesperrtZeile } from './anrufliste'
import { hauptGruppe, NICHT_AKTION, nichtFiltern, nichtGruppe, nichtSatz, nichtZaehlen } from './nichtAnrufbar'
import { LEAD_A } from './_testHilfe'

const zeile = (grund: GesperrtZeile['grund'], i: number): GesperrtZeile => ({
  lead: { ...LEAD_A, id: `lead-${grund}-${i}` },
  grund,
})
const viele = (grund: GesperrtZeile['grund'], n: number) => Array.from({ length: n }, (_, i) => zeile(grund, i))

describe('nichtAnrufbar', () => {
  it('echte Daten: 119 ohne Nummer + 2 Firma gesperrt → Satz nach Grund, Knopf „Nummern ergänzen“', () => {
    const z = nichtZaehlen([...viele('firma_gesperrt', 2), ...viele('keine_nummer', 119)])
    expect(z).toEqual({ keine_nummer: 119, kein_anrufgrund: 0, gesperrt: 2 })
    expect(hauptGruppe(z)).toBe('keine_nummer')
    expect(nichtSatz(z)).toBe('119 Leads ohne Telefonnummer · 2 gesperrt.')
    expect(NICHT_AKTION.keine_nummer).toBe('Nummern ergänzen')
  })

  it('Sperrliste, Widerspruch und Firmensperre zählen als „gesperrt“', () => {
    expect(nichtGruppe('sperrliste')).toBe('gesperrt')
    expect(nichtGruppe('widerspruch')).toBe('gesperrt')
    expect(nichtGruppe('firma_gesperrt')).toBe('gesperrt')
    expect(nichtGruppe('keine_nummer')).toBe('keine_nummer')
    expect(nichtGruppe('kein_anrufgrund')).toBe('kein_anrufgrund')
  })

  it('Hauptgrund zuerst; Gleichstand → Anrufgrund (schnellste Lösung); Einzahl „1 Lead“', () => {
    const gleich = { keine_nummer: 1, kein_anrufgrund: 1, gesperrt: 0 }
    expect(hauptGruppe(gleich)).toBe('kein_anrufgrund')
    expect(nichtSatz(gleich)).toBe('1 Lead ohne Anrufgrund · 1 ohne Telefonnummer.')
    expect(nichtSatz({ keine_nummer: 0, kein_anrufgrund: 0, gesperrt: 3 })).toBe('3 Leads gesperrt.')
    expect(hauptGruppe({ keine_nummer: 0, kein_anrufgrund: 0, gesperrt: 0 })).toBeNull()
    expect(nichtSatz({ keine_nummer: 0, kein_anrufgrund: 0, gesperrt: 0 })).toBe('')
  })

  it('Filter je Gruppe', () => {
    const alle = [...viele('keine_nummer', 2), zeile('sperrliste', 0), zeile('kein_anrufgrund', 0)]
    expect(nichtFiltern(alle, 'alle')).toHaveLength(4)
    expect(nichtFiltern(alle, 'keine_nummer').map((z) => z.grund)).toEqual(['keine_nummer', 'keine_nummer'])
    expect(nichtFiltern(alle, 'gesperrt').map((z) => z.grund)).toEqual(['sperrliste'])
  })

  it('Link „In Leads öffnen“ nur, wenn die System-Ansicht „ohne_nummer“ existiert (Wunsch an M2)', async () => {
    const mitAnsichten = async (keys: string[]) => {
      vi.resetModules()
      vi.doMock('@/app/ansichten', () => ({ SYSTEM_ANSICHTEN: keys.map((key) => ({ key, name: key })) }))
      const m = await import('./nichtAnrufbar')
      vi.doUnmock('@/app/ansichten')
      return m.leadsOhneNummerPfad
    }
    expect((await mitAnsichten(['alle', 'anrufliste']))('me')).toBeNull()
    const pfad = await mitAnsichten(['alle', 'ohne_nummer'])
    expect(pfad('me')).toBe('/leads?ansicht=ohne_nummer&zustaendig=me')
    expect(pfad('alle')).toBe('/leads?ansicht=ohne_nummer')
  })
})
