import { describe, expect, it } from 'vitest'
import {
  isWarmupRow,
  modeForEntry,
  modeForSet,
  normalizeMode,
  phaseForSet,
} from './workout-model.js'

describe('warm-up resolver', () => {
  it('uses explicit phase before the legacy boolean', () => {
    expect(phaseForSet({ warmup: true })).toBe('warmup')
    expect(phaseForSet({ phase: 'warmup' })).toBe('warmup')
    expect(phaseForSet({ phase: 'work', warmup: true })).toBe('work')
    expect(isWarmupRow({ phase: 'warm-up' })).toBe(true)
    expect(isWarmupRow({})).toBe(false)
  })
})

describe('mode resolver', () => {
  it('prefers a row mode, then target mode, then legacy row fields', () => {
    expect(modeForSet({ mode: 'reps', r: 8 }, { mode: 'time' })).toBe('reps')
    expect(modeForSet({ sec: 60 }, { mode: 'time' })).toBe('time')
    expect(modeForSet({ min: 20, speed: 8 })).toBe('cardio')
    expect(modeForSet({ r: 8 })).toBe('reps')
  })

  it('resolves one entry mode and rejects mixed work modes', () => {
    expect(modeForEntry({ target: { mode: 'time' }, sets: [{ sec: 60 }] })).toBe('time')
    expect(modeForEntry({ sets: [{ mode: 'reps', r: 8 }, { mode: 'time', sec: 60 }] })).toBeNull()
    expect(normalizeMode('unknown', 'time')).toBe('time')
  })
})
