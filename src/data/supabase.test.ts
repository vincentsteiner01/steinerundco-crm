// BAUPLAN § 3.1.7: bleibenStorage schreibt nach crm.bleiben in den richtigen Speicher; Fallback ohne Storage wirft nicht.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bleibenStorage, liesBleiben, setzeBleiben } from './supabase'

describe('bleibenStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('schreibt in localStorage, wenn „Angemeldet bleiben“ an ist (Standard)', async () => {
    setzeBleiben(true)
    bleibenStorage.setItem('sb-token', 'abc')
    expect(localStorage.getItem('sb-token')).toBe('abc')
    expect(sessionStorage.getItem('sb-token')).toBeNull()
    expect(bleibenStorage.getItem('sb-token')).toBe('abc')
    bleibenStorage.removeItem('sb-token')
    expect(localStorage.getItem('sb-token')).toBeNull()
  })

  it('schreibt in sessionStorage, wenn crm.bleiben = nein', async () => {
    setzeBleiben(false)
    expect(localStorage.getItem('crm.bleiben')).toBe('nein')
    expect(liesBleiben()).toBe(false)
    bleibenStorage.setItem('sb-token', 'xyz')
    expect(sessionStorage.getItem('sb-token')).toBe('xyz')
    expect(localStorage.getItem('sb-token')).toBeNull()
    expect(bleibenStorage.getItem('sb-token')).toBe('xyz')
  })

  it('wechselt den Speicher, sobald die Checkbox umgeschaltet wird (kein zweiter Client, kein Reload)', async () => {
    setzeBleiben(false)
    bleibenStorage.setItem('k', '1')
    setzeBleiben(true)
    bleibenStorage.setItem('k', '2')
    expect(sessionStorage.getItem('k')).toBe('1')
    expect(localStorage.getItem('k')).toBe('2')
  })

  it('wirft nicht, wenn Web Storage nicht verfügbar ist (In-Memory-Fallback)', async () => {
    const kaputt = new Proxy({} as Storage, {
      get() {
        throw new Error('SecurityError')
      },
    })
    vi.stubGlobal('localStorage', kaputt)
    vi.stubGlobal('sessionStorage', kaputt)
    expect(() => setzeBleiben(false)).not.toThrow()
    expect(() => bleibenStorage.setItem('a', 'b')).not.toThrow()
    expect(bleibenStorage.getItem('a')).toBe('b')
    expect(() => bleibenStorage.removeItem('a')).not.toThrow()
    expect(bleibenStorage.getItem('a')).toBeNull()
  })
})
