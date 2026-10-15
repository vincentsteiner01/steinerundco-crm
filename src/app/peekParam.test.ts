import { describe, expect, it } from 'vitest'
import { peekLeadId } from './peekParam'

describe('peekLeadId (Runde 2)', () => {
  it('öffnet den Peek aus ?lead= auf Listen', () => {
    expect(peekLeadId('/leads', new URLSearchParams('lead=abc'))).toBe('abc')
    expect(peekLeadId('/heute', new URLSearchParams(''))).toBeNull()
  })
  it('ignoriert ?lead= im Composer – dort meint lead den Empfänger, kein zweites Sheet', () => {
    expect(peekLeadId('/email/verfassen', new URLSearchParams('lead=abc'))).toBeNull()
  })
})
