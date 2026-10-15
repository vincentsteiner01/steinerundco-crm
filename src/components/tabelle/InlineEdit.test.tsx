// InlineEdit: text/select/datum/textarea/phase/zustaendig – Enter speichert, Esc verwirft, Tab springt, Presets (ux § 3.2.2, LE-06)
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { heuteBerlin } from '@/lib/format'
import { monatePlus, tagPlus } from '@/lib/zeit'
import { InlineEdit } from './InlineEdit'

describe('InlineEdit', () => {
  it('text: fokussiert, Enter speichert, Esc verwirft, Tab speichert und springt', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    const onTab = vi.fn()
    const { unmount } = render(
      <InlineEdit art="text" wert="Solar GmbH" onSave={onSave} onCancel={onCancel} onTab={onTab} />,
    )
    const feld = screen.getByRole('textbox') as HTMLInputElement
    expect(feld).toHaveFocus()
    expect(feld.value).toBe('Solar GmbH')
    fireEvent.change(feld, { target: { value: 'Solar Neu GmbH' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('Solar Neu GmbH')
    expect(onCancel).not.toHaveBeenCalled()
    unmount()

    render(<InlineEdit art="text" wert="x" onSave={onSave} onCancel={onCancel} onTab={onTab} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('text: Tab speichert und meldet die Richtung; leerer Text wird null', () => {
    const onSave = vi.fn()
    const onTab = vi.fn()
    render(<InlineEdit art="text" wert="" onSave={onSave} onCancel={() => {}} onTab={onTab} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Tab', shiftKey: true })
    expect(onSave).toHaveBeenCalledWith(null)
    expect(onTab).toHaveBeenCalledWith(-1)
  })

  it('text: Blur speichert genau einmal', () => {
    const onSave = vi.fn()
    render(<InlineEdit art="text" wert="a" onSave={onSave} onCancel={() => {}} />)
    const feld = screen.getByRole('textbox')
    fireEvent.change(feld, { target: { value: 'b' } })
    fireEvent.blur(feld)
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('b')
  })

  it('datum: „+3“ + Enter speichert heute + 3 Tage mit Vorschau; Presets speichern direkt (LE-06)', () => {
    const heute = heuteBerlin()
    const onSave = vi.fn()
    const { unmount } = render(<InlineEdit art="datum" wert="2026-10-12" onSave={onSave} onCancel={() => {}} />)
    const feld = screen.getByLabelText('Datum') as HTMLInputElement
    expect(feld.value).toBe('2026-10-12')
    fireEvent.change(feld, { target: { value: '+3' } })
    expect(screen.getByText(/^→ /)).toBeInTheDocument()
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith(tagPlus(heute, 3))
    unmount()

    const onSave2 = vi.fn()
    render(<InlineEdit art="datum" wert={null} onSave={onSave2} onCancel={() => {}} />)
    const presets = screen.getByRole('group', { name: 'Presets' })
    expect(presets).toHaveTextContent('Heute')
    expect(presets).toHaveTextContent('+3 T')
    expect(presets).toHaveTextContent('+7 T')
    expect(presets).toHaveTextContent('+14 T')
    expect(presets).toHaveTextContent('+3 Mo')
    expect(presets).toHaveTextContent('Kalender')
    fireEvent.click(screen.getByRole('button', { name: '+3 Mo' }))
    expect(onSave2).toHaveBeenCalledWith(monatePlus(heute, 3))
  })

  it('datum: unverständliche Eingabe zeigt „?“ und Enter behält den alten Wert', () => {
    const onSave = vi.fn()
    render(<InlineEdit art="datum" wert="2026-10-12" onSave={onSave} onCancel={() => {}} />)
    const feld = screen.getByLabelText('Datum')
    fireEvent.change(feld, { target: { value: 'xyz' } })
    expect(screen.getByText('?')).toBeInTheDocument()
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('2026-10-12')
  })

  it('phase: Select über alle 16 Stufen in 10 Phasen-Gruppen, Wechsel speichert sofort', () => {
    const onSave = vi.fn()
    render(<InlineEdit art="phase" wert="vernetzt" onSave={onSave} onCancel={() => {}} />)
    const select = screen.getByLabelText('Phase') as HTMLSelectElement
    expect(select.value).toBe('vernetzt')
    expect(select.querySelectorAll('optgroup')).toHaveLength(10)
    expect(select.querySelectorAll('option')).toHaveLength(16)
    expect(screen.getByRole('option', { name: 'Wiedervorlage' })).toHaveValue('langfristig')
    fireEvent.change(select, { target: { value: 'kunde' } })
    expect(onSave).toHaveBeenCalledWith('kunde')
  })

  it('zustaendig: Mitglieder + „Frei“, Frei speichert null', () => {
    const onSave = vi.fn()
    render(
      <InlineEdit
        art="zustaendig"
        wert="m1"
        optionen={[
          { value: 'm1', label: 'Vincent' },
          { value: 'm2', label: 'Mike' },
        ]}
        onSave={onSave}
        onCancel={() => {}}
      />,
    )
    const select = screen.getByLabelText('Zuständig') as HTMLSelectElement
    expect(select.querySelectorAll('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: 'Frei' })).toHaveValue('')
    fireEvent.change(select, { target: { value: '' } })
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('select: Optionen aus Props, Esc verwirft', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(
      <InlineEdit
        art="select"
        wert="kb"
        optionen={[
          { value: 'gf', label: 'GF' },
          { value: 'kb', label: 'KB' },
        ]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )
    const select = screen.getByLabelText('Auswahl') as HTMLSelectElement
    expect(select.value).toBe('kb')
    fireEvent.keyDown(select, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('textarea: Enter macht eine neue Zeile, ⌘Enter speichert', () => {
    const onSave = vi.fn()
    render(<InlineEdit art="textarea" wert="Notiz" onSave={onSave} onCancel={() => {}} />)
    const feld = screen.getByLabelText('Notiz')
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(feld, { target: { value: 'Notiz\nZeile 2' } })
    fireEvent.keyDown(feld, { key: 'Enter', metaKey: true })
    expect(onSave).toHaveBeenCalledWith('Notiz\nZeile 2')
  })

  it('Speichern lässt die umgebende Zelle Sage blinken (flash-done)', () => {
    const onSave = vi.fn()
    render(
      <table>
        <tbody>
          <tr>
            <td data-testid="zelle">
              <InlineEdit art="text" wert="a" onSave={onSave} onCancel={() => {}} />
            </td>
          </tr>
        </tbody>
      </table>,
    )
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(screen.getByTestId('zelle')).toHaveClass('animate-flash-done')
  })
})
