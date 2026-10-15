// LeadForm.test.tsx (BAUPLAN § 3.3, LE-11): Dublette blockiert, Telefon E.164, Rolle aus Freitext, Pflichtfelder, ⌘Enter / ⌘⇧Enter.
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DB,
  FIRMA_GESPERRT,
  FIRMA_GESPERRT_ID,
  MEMBER_M,
  NEUE_FIRMA_ID,
  erstesArg,
  rendern,
  zugriffeMit,
  zuruecksetzen,
} from './_testHilfe'
import { rolleAusFreitext } from './detailLogik'
import { LeadForm } from './LeadForm'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())

function formular(onGespeichert = vi.fn(), vorbelegung = {}) {
  rendern(<LeadForm vorbelegung={vorbelegung} onGespeichert={onGespeichert} onAbbrechen={vi.fn()} />)
  return onGespeichert
}
const feld = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement

describe('rolleAusFreitext', () => {
  it.each([
    ['Geschäftsführer', 'geschaeftsfuehrer'],
    ['CEO & Founder', 'geschaeftsfuehrer'],
    ['Inhaber', 'inhaber'],
    ['Key Account Manager', 'kundenbetreuer'],
    ['Innendienst Vertrieb', 'innendienst'],
    ['Head of Sales', 'vertrieb'],
    ['Projektleiter PV', 'projektleiter'],
    ['Elektromeister', 'sonstiges'],
    ['', 'unbekannt'],
  ])('„%s“ → %s', (text, rolle) => {
    expect(rolleAusFreitext(text)).toBe(rolle)
  })
})

describe('LeadForm', () => {
  beforeEach(() => zuruecksetzen())

  it('Pflichtfelder Vorname/Nachname: ohne sie wird nichts angelegt', async () => {
    const fertig = formular()
    fireEvent.click(screen.getByRole('button', { name: /Lead anlegen/ }))
    expect(await screen.findAllByText('Pflichtfeld')).toHaveLength(2)
    expect(zugriffeMit('leads', 'insert')).toHaveLength(0)
    expect(fertig).not.toHaveBeenCalled()
  })

  it('Rolle wird aus dem Freitext erkannt und gespeichert', async () => {
    const fertig = formular()
    fireEvent.change(feld('Vorname'), { target: { value: 'Mara' } })
    fireEvent.change(feld('Nachname'), { target: { value: 'Brandt' } })
    fireEvent.change(feld('Rolle (Freitext)'), { target: { value: 'Key Account Managerin' } })
    expect(screen.getByText('erkannt: Kundenbetreuer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Lead anlegen/ }))
    await waitFor(() => expect(fertig).toHaveBeenCalled())
    const insert = erstesArg(zugriffeMit('leads', 'insert')[0] ?? [], 'insert') as Record<string, unknown>
    expect(insert).toMatchObject({
      first_name: 'Mara',
      last_name: 'Brandt',
      role: 'kundenbetreuer',
    })
  })

  it('Insert ohne generierte Spalten: full_name und linkedin_url_norm berechnet die DB (Review-Blocker)', async () => {
    const fertig = formular()
    fireEvent.change(feld('Vorname'), { target: { value: 'Mara' } })
    fireEvent.change(feld('Nachname'), { target: { value: 'Brandt' } })
    fireEvent.change(feld('LinkedIn-URL'), { target: { value: 'https://www.linkedin.com/in/mara-brandt/' } })
    fireEvent.click(screen.getByRole('button', { name: /Lead anlegen/ }))
    await waitFor(() => expect(fertig).toHaveBeenCalled())
    const insert = erstesArg(zugriffeMit('leads', 'insert')[0] ?? [], 'insert') as Record<string, unknown>
    expect(insert.linkedin_url).toBe('https://www.linkedin.com/in/mara-brandt/')
    expect(insert).not.toHaveProperty('full_name')
    expect(insert).not.toHaveProperty('linkedin_url_norm')
  })

  it('Unternehmen verknüpft die Firma (company_id); gesperrte Firma zeigt den Chip „Firma gesperrt“ (§ 1.5 Nr. 27)', async () => {
    DB.companies = [{ ...FIRMA_GESPERRT, name_norm: 'sperrfirma energie' }]
    const fertig = formular()
    fireEvent.change(feld('Vorname'), { target: { value: 'Mara' } })
    fireEvent.change(feld('Nachname'), { target: { value: 'Brandt' } })
    fireEvent.change(feld('Unternehmen'), { target: { value: '  Sperrfirma   Energie ' } })
    expect(await screen.findByText('Firma gesperrt')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Lead anlegen/ }))
    await waitFor(() => expect(fertig).toHaveBeenCalled())
    const insert = erstesArg(zugriffeMit('leads', 'insert')[0] ?? [], 'insert') as Record<string, unknown>
    expect(insert).toMatchObject({ company_id: FIRMA_GESPERRT_ID, company_name: 'Sperrfirma Energie' })
    expect(zugriffeMit('companies', 'insert')).toHaveLength(0)
  })

  it('Neue Firma wird angelegt und verknüpft', async () => {
    const fertig = formular()
    fireEvent.change(feld('Vorname'), { target: { value: 'Mara' } })
    fireEvent.change(feld('Nachname'), { target: { value: 'Brandt' } })
    fireEvent.change(feld('Unternehmen'), { target: { value: 'Neue Solar GmbH' } })
    expect(screen.queryByText('Firma gesperrt')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Lead anlegen/ }))
    await waitFor(() => expect(fertig).toHaveBeenCalled())
    expect(erstesArg(zugriffeMit('companies', 'insert')[0] ?? [], 'insert')).toEqual({ name: 'Neue Solar GmbH' })
    const insert = erstesArg(zugriffeMit('leads', 'insert')[0] ?? [], 'insert') as Record<string, unknown>
    expect(insert).toMatchObject({ company_id: NEUE_FIRMA_ID, company_name: 'Neue Solar GmbH' })
  })

  it('Telefon wird als E.164 gespeichert, unvollständige Nummer zeigt Hinweis', async () => {
    const fertig = formular()
    fireEvent.change(feld('Vorname'), { target: { value: 'Mara' } })
    fireEvent.change(feld('Nachname'), { target: { value: 'Brandt' } })
    fireEvent.change(screen.getByLabelText('Telefon') as HTMLInputElement, { target: { value: '040 1' } })
    expect(screen.getByText('Nummer unvollständig')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Telefon') as HTMLInputElement, { target: { value: '040 12345678' } })
    expect(screen.getByText('gespeichert als +494012345678')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Lead anlegen/ }))
    await waitFor(() => expect(fertig).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000090', false))
    const insert = erstesArg(zugriffeMit('leads', 'insert')[0] ?? [], 'insert') as Record<string, unknown>
    expect(insert.phone_e164).toBe('+494012345678')
    expect(typeof insert.phone_collected_at).toBe('string')
  })

  it('Phase vorbelegt: Vernetzt mit URL, sonst Neu ohne LinkedIn', () => {
    formular()
    expect(screen.getByText('vorbelegt: Neu ohne LinkedIn')).toBeInTheDocument()
    fireEvent.change(feld('LinkedIn-URL'), { target: { value: 'https://www.linkedin.com/in/mara-brandt/' } })
    expect(screen.getByText('vorbelegt: Vernetzt')).toBeInTheDocument()
  })

  it('LE-11: vorhandene LinkedIn-URL → „Bereits vorhanden: … – öffnen“ und Anlegen gesperrt', async () => {
    DB.dubletten = [
      {
        id: '10000000-0000-4000-8000-000000000077',
        full_name: 'Jonas Bergfeld',
        company_name: 'Bergfeld Photovoltaik',
        stage: 'beendet',
        owner_id: MEMBER_M,
        linkedin_url: 'https://www.linkedin.com/in/jonas-bergfeld',
        deleted_at: null,
      },
    ]
    const fertig = formular()
    fireEvent.change(feld('Vorname'), { target: { value: 'Jonas' } })
    fireEvent.change(feld('Nachname'), { target: { value: 'Bergfeld' } })
    fireEvent.change(feld('LinkedIn-URL'), { target: { value: 'linkedin.com/in/jonas-bergfeld/' } })
    const alarm = await screen.findByRole('alert', {}, { timeout: 1500 })
    expect(alarm).toHaveTextContent('Bereits vorhanden: Jonas Bergfeld · Beendet · Mike')
    expect(screen.getByRole('button', { name: 'öffnen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lead anlegen/ })).toBeDisabled()
    fireEvent.keyDown(feld('Nachname'), { key: 'Enter', metaKey: true })
    await new Promise((r) => setTimeout(r, 20))
    expect(zugriffeMit('leads', 'insert')).toHaveLength(0)
    expect(fertig).not.toHaveBeenCalled()
  })

  it('Telefon-/E-Mail-Treffer sind nur eine Warnung – Anlegen bleibt möglich', async () => {
    DB.dubletten = [
      { id: 'x', full_name: 'Mara Brandt', stage: 'pitch', owner_id: null, linkedin_url: null, deleted_at: null },
    ]
    formular()
    fireEvent.change(feld('E-Mail'), { target: { value: 'mara@beispiel.de' } })
    expect(await screen.findByText(/Möglicherweise bereits vorhanden/, {}, { timeout: 1500 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lead anlegen/ })).not.toBeDisabled()
  })

  it('⌘⇧Enter speichert und meldet „weiter“ (nächster Lead)', async () => {
    const fertig = formular()
    fireEvent.change(feld('Vorname'), { target: { value: 'Mara' } })
    fireEvent.change(feld('Nachname'), { target: { value: 'Brandt' } })
    fireEvent.keyDown(feld('Nachname'), { key: 'Enter', metaKey: true, shiftKey: true })
    await waitFor(() => expect(fertig).toHaveBeenCalledWith(expect.any(String), true))
  })

  it('Vorbelegung aus der Route (?vorname=&nachname=&unternehmen=&url=)', () => {
    formular(vi.fn(), {
      first_name: 'Jana',
      last_name: 'Ost',
      company_name: 'Ost Solar',
      linkedin_url: 'https://linkedin.com/in/jana-ost',
    })
    expect(feld('Vorname').value).toBe('Jana')
    expect(feld('Unternehmen').value).toBe('Ost Solar')
    expect(feld('LinkedIn-URL').value).toBe('https://linkedin.com/in/jana-ost')
  })
})
