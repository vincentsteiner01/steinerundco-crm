import { describe, expect, it } from 'vitest'
import { peekLeadId } from './peekParam'

describe('peekLeadId (Runde 2)', () => {
  it('liest den Lead des Lead-Blatts aus ?lead= – auf jeder Seite', () => {
    expect(peekLeadId('/leads', new URLSearchParams('lead=abc'))).toBe('abc')
    expect(peekLeadId('/email', new URLSearchParams('tab=gesendet&lead=abc'))).toBe('abc')
    expect(peekLeadId('/leads', new URLSearchParams(''))).toBeNull()
    expect(peekLeadId('/leads', new URLSearchParams('lead='))).toBeNull()
  })
  it('ignoriert ?lead= im Composer – dort meint lead den Empfänger, kein zweites Sheet', () => {
    expect(peekLeadId('/email/verfassen', new URLSearchParams('lead=abc'))).toBeNull()
  })
})
