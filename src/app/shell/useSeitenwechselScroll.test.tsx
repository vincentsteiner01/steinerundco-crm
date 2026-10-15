import { act, render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { useSeitenwechselScroll } from './useSeitenwechselScroll'

function Seite() {
  useSeitenwechselScroll()
  return null
}

describe('useSeitenwechselScroll (Runde 2)', () => {
  it('springt beim Pfadwechsel nach oben, nicht bei ?lead= oder Filtern', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const router = createMemoryRouter([{ path: '*', element: <Seite /> }], { initialEntries: ['/leads'] })
    render(<RouterProvider router={router} />)
    expect(scrollTo).not.toHaveBeenCalled()
    await act(() => router.navigate('/leads?lead=abc'))
    expect(scrollTo).not.toHaveBeenCalled()
    await act(() => router.navigate('/pipeline'))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    scrollTo.mockRestore()
  })
})
