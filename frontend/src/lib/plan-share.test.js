import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises.js'
import { planPrintHTML } from './plan-share.js'

const LIFT = EXDB.find(ex => ex.bp !== 'cardio' && ex.eq !== 'body weight')

describe('planPrintHTML unit boundary', () => {
  it('renders canonical weights in the selected display unit', () => {
    const html = planPrintHTML({
      unit: 'lb',
      week: {},
      routines: [{ id: 'r1', name: 'Strength', ex: [{ id: LIFT.id, sets: 3, reps: 5, weight: 60 }] }],
      customEx: [],
    }, '')

    expect(html).toContain('132.3 lb')
    expect(html).not.toContain('60 lb')
  })
})
