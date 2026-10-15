import { act, renderHook } from '@testing-library/react'
import { createElement, StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blobUrlsStubben } from './_testHilfe'
import { ObjektUrls, useObjektUrl } from './objektUrl'

const widerrufen = () => vi.mocked(URL.revokeObjectURL).mock.calls.map((c) => c[0])
const strict = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children)

beforeEach(() => {
  vi.useFakeTimers()
  blobUrlsStubben()
})
afterEach(() => vi.useRealTimers())

describe('ObjektUrls', () => {
  it('eine URL je Blob, freigeben behält nur den genannten', () => {
    const o = new ObjektUrls()
    const a = new Blob(['a'])
    const b = new Blob(['b'])
    const ua = o.url(a)
    expect(o.url(a)).toBe(ua)
    const ub = o.url(b)
    o.freigeben(b)
    expect(widerrufen()).toEqual([ua])
    expect(o.anzahl).toBe(1)
    expect(o.url(b)).toBe(ub)
  })
})

describe('useObjektUrl', () => {
  it('StrictMode: die angezeigte URL bleibt gültig, solange der Dialog steht (Runde 3: kein Widerruf im Doppellauf)', () => {
    const blob = new Blob(['bild'])
    const { result, unmount } = renderHook(() => useObjektUrl(blob), { wrapper: strict })
    act(() => void vi.runAllTimers())
    const url = result.current
    expect(url).toMatch(/^blob:test\//)
    expect(widerrufen()).not.toContain(url)
    unmount()
    act(() => void vi.runAllTimers())
    expect(widerrufen()).toContain(url)
  })

  it('ersetztes oder entferntes Bild: die alte URL wird freigegeben, die neue nicht', () => {
    const a = new Blob(['a'])
    const b = new Blob(['b'])
    const { result, rerender } = renderHook(({ blob }: { blob: Blob | null }) => useObjektUrl(blob), {
      initialProps: { blob: a as Blob | null },
      wrapper: strict,
    })
    const ua = result.current
    rerender({ blob: b })
    const ub = result.current
    expect(ub).not.toBe(ua)
    expect(widerrufen()).toContain(ua)
    expect(widerrufen()).not.toContain(ub)
    rerender({ blob: null })
    expect(result.current).toBeNull()
    expect(widerrufen()).toContain(ub)
  })
})
