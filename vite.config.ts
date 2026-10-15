import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// architektur § 2 (gilt wörtlich, BAUPLAN § 1.5 Nr. 44)
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null, // Registrierung in main.tsx → kein Inline-Script (CSP)
      manifest: {
        name: 'CRM · Steiner & Co.',
        short_name: 'CRM',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#07080d',
        theme_color: '#07080d',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
        globIgnores: ['**/xlsx-*.js'], // 400-kB-Chunk nicht vorab cachen
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false, // Nutzer entscheidet („Neue Version laden“)
        runtimeCaching: [], // keine API-Antworten cachen (Supabase bleibt live)
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 8768, strictPort: true, host: '127.0.0.1' },
  preview: { port: 8769 },
  build: {
    target: 'es2023',
    sourcemap: false,
    modulePreload: { polyfill: false }, // Zielbrowser (Safari ≥ 17, Chrome ≥ 120) können modulepreload
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase/ },
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'xlsx', test: /node_modules[\\/]xlsx/ },
          ],
        },
      },
    },
  },
})
