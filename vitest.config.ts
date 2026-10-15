import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    globals: false,
    env: { TZ: 'UTC' },
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Erster Import von supabase-js im Worker dauert auf belasteten Maschinen > 5 s
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})
