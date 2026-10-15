// PapierkorbSeite.test.tsx (LE-13, ux § 4.1/§ 4.8): leer · Liste gelöschter Leads · Wiederherstellen · Endgültig löschen nur nach Dialog.
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { postgrestVorschau } from './filter'
import { ansichtNachKey } from './ansichten'
import { DB, erstesArg, rendern, taste, vollerLead, zugriffeMit, zuruecksetzen } from './_testHilfe'
import { Component as Papierkorb } from './PapierkorbSeite'

vi.mock('@/data/supabase', async () => (await import('./_supabaseM2')).supabaseM2())
vi.mock('@/components/toast', async (original) => ({
  ...(await original<typeof import('@/components/toast')>()),
  toast: vi.fn(),
  toastFehler: vi.fn(),
}))

const GELOESCHT = vollerLead(2, { full_name: 'Dora Dachs', deleted_at: '2026-10-10T12:00:00+02:00' })

describe('PapierkorbSeite', () => {
  beforeEach(() => zuruecksetzen())

  it('leer: „Papierkorb ist leer.“', async () => {
    rendern(<Papierkorb />, { route: '/leads/papierkorb' })
    expect(await screen.findByText('Papierkorb ist leer.')).toBeInTheDocument()
    expect(screen.getByText('Gelöschte Leads bleiben 30 Tage hier.')).toBeInTheDocument()
  })

  it('Papierkorb filtert deleted_at gesetzt, alle anderen Ansichten deleted_at leer (LE-13)', () => {
    expect(postgrestVorschau(ansichtNachKey('papierkorb').filter)).toContainEqual(['not', 'deleted_at', 'is', null])
    for (const key of ['alle', 'meine', 'beendet', 'anrufliste'])
      expect(postgrestVorschau(ansichtNachKey(key).filter)).toContainEqual(['is', 'deleted_at', null])
  })

  it('Wiederherstellen setzt deleted_at zurück', async () => {
    DB.leads = [GELOESCHT]
    rendern(<Papierkorb />, { route: '/leads/papierkorb' })
    expect(await screen.findByText('Dora Dachs')).toBeInTheDocument()
    taste('j')
    const leiste = await screen.findByRole('toolbar', { name: 'Papierkorb-Aktionen' })
    fireEvent.click(within(leiste).getByRole('button', { name: 'Wiederherstellen' }))
    await waitFor(() => expect(zugriffeMit('leads', 'update')).toHaveLength(1))
    expect(erstesArg(zugriffeMit('leads', 'update')[0] ?? [], 'update')).toEqual({ deleted_at: null })
  })

  it('Endgültig löschen fragt erst nach Bestätigung', async () => {
    DB.leads = [GELOESCHT]
    rendern(<Papierkorb />, { route: '/leads/papierkorb' })
    await screen.findByText('Dora Dachs')
    taste('j')
    fireEvent.click(await screen.findByRole('button', { name: /Endgültig löschen/ }))
    const dialog = await screen.findByRole('dialog')
    expect(zugriffeMit('leads', 'delete')).toHaveLength(0)
    const primaer = within(dialog)
      .getAllByRole('button')
      .filter((b) => !/Abbrechen|Schließen/.test(b.textContent ?? ''))
      .pop() as HTMLElement
    fireEvent.click(primaer)
    await waitFor(() => expect(zugriffeMit('leads', 'delete')).toHaveLength(1))
  })
})
