// Tests für ablauf.ts mit einer Datenbank-Attrappe – nur erfundene Namen.  Aufruf: deno test supabase/functions/linkedin-eingang
import assert from 'node:assert/strict'
import { ablauf, type EingangDb, SpeicherFehler } from './ablauf.ts'
import { type EingangZeile, parseMail, zeileBauen } from './parser.ts'

type Zeile = EingangZeile & { id: string }

function attrappe(start: Zeile[] = [], verarbeite: (z: Zeile) => string = () => 'verarbeitet') {
  const tabelle = new Map<string, Zeile>(start.map((z) => [z.external_id, z]))
  const aufrufe = { verarbeitet: [] as string[], aufraeumen: 0, anlegen: 0 }
  let n = start.length
  const db: EingangDb = {
    profil: () => Promise.resolve({ linkedinUrl: 'https://www.linkedin.com/in/test-eigen/', namen: ['Testmitglied'] }),
    anlegen(zeilen) {
      aufrufe.anlegen++
      const neu: { id: string; status: string }[] = []
      for (const z of zeilen) {
        if (tabelle.has(z.external_id)) continue
        const zeile = { ...z, id: `id-${++n}` }
        tabelle.set(z.external_id, zeile)
        neu.push({ id: zeile.id, status: zeile.status })
      }
      return Promise.resolve({ data: neu, error: null })
    },
    offene(memberId, ids) {
      const daten = [...tabelle.values()]
        .filter((z) => z.member_id === memberId && z.status === 'neu' && ids.includes(z.external_id))
        .map((z) => ({ id: z.id, art: z.art, ergebnis: z.ergebnis }))
      return Promise.resolve({ data: daten, error: null })
    },
    verarbeiten(id) {
      aufrufe.verarbeitet.push(id)
      const z = [...tabelle.values()].find((x) => x.id === id)!
      z.status = verarbeite(z) as Zeile['status']
      if (z.status === 'neu') z.ergebnis = 'Einladung von diesem Lead'
      return Promise.resolve({ data: { status: z.status }, error: null })
    },
    aufraeumen() {
      aufrufe.aufraeumen++
      return Promise.resolve({ data: 0, error: null })
    },
  }
  return { db, tabelle, aufrufe }
}

const annahme = (id: string) => ({
  id,
  datum: '2026-10-15T08:30:00.000Z',
  betreff: 'Anna Beispiel hat Ihre Einladung angenommen',
  von: '"Anna Beispiel über LinkedIn" <invitations@linkedin.com>',
  text: '',
  links: ['https://www.linkedin.com/comm/in/test-eigen?trk=kopf', 'https://www.linkedin.com/comm/in/anna-beispiel-1'],
})
const werbung = (id: string) => ({ id, datum: '2026-10-15T08:30:00.000Z', betreff: 'LinkedIn Premium testen', von: 'LinkedIn <linkedin@e.linkedin.com>', text: '', links: [] })

Deno.test('A1 · neue Annahme wird angelegt und verbucht, eigener Slug ausgeschlossen, Löschfrist läuft', async () => {
  const t = attrappe()
  const z = await ablauf(t.db, 'm1', [annahme('a1'), werbung('w1'), { id: 'kaputt mit leerzeichen' }])
  assert.deepEqual(z, { neu: 2, doppelt: 0, verarbeitet: 1, unbekannt: 0, ignoriert: 1, offen: 0, fehler: 1 })
  assert.equal(t.tabelle.get('a1')?.linkedin_slug, 'anna-beispiel-1')
  assert.equal(t.aufrufe.verarbeitet.length, 1)
  assert.equal(t.aufrufe.aufraeumen, 1)
})

Deno.test('A2 · Abbruch nach dem Anlegen: beim nächsten Aufruf werden die liegengebliebenen „neu“-Zeilen verbucht', async () => {
  const t = attrappe()
  // Erster Aufruf bricht nach dem Anlegen ab (Timeout) – simuliert: Zeile liegt als „neu“ in der Tabelle
  await t.db.anlegen([zeileBauen(annahme('a2'), parseMail(annahme('a2')), 'm1')])
  assert.equal(t.tabelle.get('a2')?.status, 'neu')
  const z = await ablauf(t.db, 'm1', [annahme('a2')])
  assert.equal(z.neu, 0)
  assert.equal(z.doppelt, 1)
  assert.equal(z.verarbeitet, 1, 'liegengebliebene Annahme wird doch noch verbucht')
  assert.equal(t.tabelle.get('a2')?.status, 'verarbeitet')
  // dritter Aufruf: nichts mehr offen, nichts doppelt verbucht
  const z3 = await ablauf(t.db, 'm1', [annahme('a2')])
  assert.equal(z3.verarbeitet, 0)
  assert.equal(t.aufrufe.verarbeitet.length, 1)
})

Deno.test('A3 · Einladung eines Leads bleibt „neu“, wird aber nur einmal verbucht; fremde Mitglieder bleiben unberührt', async () => {
  const einladung = { ...annahme('e1'), betreff: 'Anna Beispiel möchte sich mit Ihnen vernetzen' }
  const t = attrappe([], () => 'neu')
  const z1 = await ablauf(t.db, 'm1', [einladung])
  assert.equal(z1.offen, 1)
  const z2 = await ablauf(t.db, 'm1', [einladung])
  assert.equal(z2.offen, 0)
  assert.equal(t.aufrufe.verarbeitet.length, 1)
  const z3 = await ablauf(t.db, 'm2', [einladung])
  assert.equal(z3.verarbeitet + z3.offen, 0, 'Zeile von m1 wird für m2 nicht verbucht')
})

Deno.test('A4 · Speichern schlägt fehl → SpeicherFehler (Apps Script versucht es später erneut)', async () => {
  const t = attrappe()
  t.db.anlegen = () => Promise.resolve({ data: null, error: { message: 'kaputt' } })
  await assert.rejects(() => ablauf(t.db, 'm1', [annahme('x1')]), SpeicherFehler)
})
