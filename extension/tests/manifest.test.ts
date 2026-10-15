// Die Nur-Lesen-Zusage als Test: kein Content-Script, keine web_accessible_resources, minimale Rechte.
import { describe, expect, it } from 'vitest'
import manifest from '../src/manifest.json'

describe('manifest.json', () => {
  it('läuft nie dauerhaft auf LinkedIn und legt nichts für Webseiten offen', () => {
    expect(manifest).not.toHaveProperty('content_scripts')
    expect(manifest).not.toHaveProperty('web_accessible_resources')
    expect(manifest).not.toHaveProperty('externally_connectable')
  })
  it('nur die nötigen Rechte und Hosts', () => {
    expect([...manifest.permissions].sort()).toEqual(['clipboardWrite', 'scripting', 'sidePanel', 'storage'])
    expect(manifest.host_permissions).toEqual(['https://www.linkedin.com/*', 'https://ekaqkfgvisdngsskzbai.supabase.co/*'])
    expect(manifest.content_security_policy.extension_pages).toContain("script-src 'self'")
  })
  it('⌥C öffnet die Seitenleiste', () => {
    expect(manifest.commands['seitenleiste-oeffnen'].suggested_key.default).toBe('Alt+C')
    expect(manifest.side_panel.default_path).toBe('sidepanel.html')
  })
})
