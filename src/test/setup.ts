// Vitest-Setup (BAUPLAN § 3.1.11): jest-dom, matchMedia, ResizeObserver, IntersectionObserver, navigator.clipboard, Umgebung.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://ekaqkfgvisdngsskzbai.supabase.co')
vi.stubEnv('VITE_SUPABASE_KEY', 'sb_publishable_test_0000000000000000000000')
vi.stubEnv('VITE_APP_VERSION', 'test')

afterEach(() => cleanup())

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class IO {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
if (!('ResizeObserver' in globalThis))
  Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: RO })
if (!('IntersectionObserver' in globalThis))
  Object.defineProperty(globalThis, 'IntersectionObserver', { writable: true, value: IO })

if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async () => {}), readText: vi.fn(async () => '') },
  })
}
// Radix/cmdk brauchen in jsdom diese DOM-APIs
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
