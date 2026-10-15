// Lese-Skript für die geöffnete LinkedIn-Seite: eine einzige IIFE-Datei ohne Imports (dist/lesen.js). Wird nur auf Klick bzw. bei
// geöffneter Seitenleiste per chrome.scripting.executeScript in den Tab gegeben – es gibt kein dauerhaftes Content-Script.
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const hier = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: hier('.'),
  publicDir: false,
  resolve: { alias: { '@': hier('../src') } },
  build: {
    outDir: hier('dist'),
    emptyOutDir: false,
    target: 'chrome120',
    sourcemap: false,
    lib: {
      entry: hier('src/lesen/einstieg.ts'),
      formats: ['iife'],
      name: 'SucoCrmLesen',
      fileName: () => 'lesen.js',
    },
  },
})
