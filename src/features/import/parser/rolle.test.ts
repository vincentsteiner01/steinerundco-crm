import { describe, expect, it } from 'vitest'
import { rolleAus } from './rolle'

describe('parser/rolle – Schlüsselwörter wie crm.import_leads', () => {
  it.each([
    ['Geschäftsführer', 'geschaeftsfuehrer'],
    ['CEO', 'geschaeftsfuehrer'],
    ['Managing Director', 'geschaeftsfuehrer'],
    ['GF', 'geschaeftsfuehrer'],
    ['Inhaber', 'inhaber'],
    ['Gründerin', 'inhaber'],
    ['Founder & Owner', 'inhaber'],
    ['Kundenbetreuerin', 'kundenbetreuer'],
    ['Kundenbetreuung', 'kundenbetreuer'],
    ['Innendienstleitung', 'innendienst'],
    ['Vertriebsleiterin', 'vertrieb'],
    ['Head of Sales', 'vertrieb'],
    ['Projektleiter', 'projektleiter'],
    ['Marketing Manager', 'sonstiges'],
    ['', 'unbekannt'],
    [null, 'unbekannt'],
  ])('%s → %s', (text, rolle) => {
    expect(rolleAus(text)).toBe(rolle)
  })
})
