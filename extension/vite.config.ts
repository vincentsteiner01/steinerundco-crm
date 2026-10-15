// Build der Erweiterungsseiten (Popup, Seitenleiste, Optionen, Eingang) und des Service Workers – ES-Module, ein Ausgabeordner dist/.
// Das Lese-Skript für LinkedIn (dist/lesen.js) baut vite.lesen.config.ts separat als IIFE (ohne Imports, für scripting.executeScript).
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const hier = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: hier('.'),
  base: './',
  // Publishable Key + URL aus ../.env.production (öffentlich, RLS schützt die Daten – wie im CRM)
  envDir: hier('..'),
  publicDir: hier('static'),
  plugins: [react()],
  resolve: { alias: { '@': hier('../src') } },
  build: {
    outDir: hier('dist'),
    emptyOutDir: true,
    target: 'chrome120',
    sourcemap: false,
    modulePreload: false,
    rolldownOptions: {
      input: {
        popup: hier('popup.html'),
        sidepanel: hier('sidepanel.html'),
        optionen: hier('optionen.html'),
        eingang: hier('eingang.html'),
        background: hier('src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
})
