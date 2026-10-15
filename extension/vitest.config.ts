import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const hier = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: hier('.'),
  plugins: [react()],
  resolve: { alias: { '@': hier('../src') } },
  test: {
    environment: 'node',
    globals: false,
    env: { TZ: 'Europe/Berlin' },
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    testTimeout: 20_000,
  },
})
