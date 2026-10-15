import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// architektur § 2 (gilt wörtlich, BAUPLAN § 1.5 Nr. 44)
// CSP zusätzlich als <meta> im gebauten index.html: nginx auf dem Plesk-Server liefert „/“ und /index.html direkt aus,
// ohne die Header aus public/.htaccess (geprüft 15.10.2026). Nur im Build – der Dev-Server braucht Inline-HMR.
// frame-ancestors gilt nur als Header (bleibt in .htaccess), deshalb fehlt es hier.
const CSP_META =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
  "img-src 'self' data: blob: https://ekaqkfgvisdngsskzbai.supabase.co; " +
  "connect-src 'self' https://ekaqkfgvisdngsskzbai.supabase.co wss://ekaqkfgvisdngsskzbai.supabase.co; " +
  "worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; upgrade-insecure-requests"
const cspMeta = {
  name: 'csp-meta',
  apply: 'build' as const,
  transformIndexHtml(html: string) {
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP_META}" />`)
  },
}

export default defineConfig({
  plugins: [
    cspMeta,
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
