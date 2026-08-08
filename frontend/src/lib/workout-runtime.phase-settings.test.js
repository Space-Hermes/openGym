import { describe, expect, it } from 'vitest'
import {
  applyWarmupConfigToEntry,
  applyWorkConfigToEntry,
  hasSelectedWorkPhase,
  prependWarmupSets,
  sessionConfigFor,
  workRowsForMode
} from './workout-runtime.js'
import { normalizePhase } from './workout-model.js'

describe('session phase settings', () => {
  it('normalizes #48 warmup rows while an explicit phase remains authoritative', () => {
    expect(normalizePhase({ warmup: true })).toBe('warmup')
    expect(normalizePhase({ warmup: false })).toBe('work')
    expect(normalizePhase({ phase: 'work', warmup: true })).toBe('work')
  })

  it('prepends configured warm-up rows and keeps work rows in their phase', () => {
    const sets = prependWarmupSets({
      warmup: [{ mode: 'reps', reps: 8, weight: 20, restSec: 45 }],
      workRestSec: 90
    }, [{ mode: 'reps', w: 60, r: 5, done: false }])

    expect(sets).toEqual([
      { phase: 'warmup', mode: 'reps', w: 20, r: 8, done: false, restSec: 45 },
      { mode: 'reps', phase: 'work', w: 60, r: 5, done: false }
    ])
  })

  it('updates warm-up configuration without rewriting a completed legacy warm-up', () => {
    const updated = applyWarmupConfigToEntry({
      target: { sets: 1, mode: 'reps', reps: 5, weight: 60 },
      sets: [
        { warmup: true, w: 20, r: 8, done: true },
        { w: 60, r: 5, done: false }
      ]
    }, {
      warmup: [{ mode: 'reps', reps: 10, weight: 25, restSec: 30 }]
    })

    expect(updated.sets).toEqual([
      { warmup: true, phase: 'warmup', w: 20, r: 8, done: true },
      { w: 60, r: 5, phase: 'work', done: false }
    ])
    expect(updated.target.warmup[0].restSec).toBe(30)
  })

  it('updates only unfinished work rows and preserves configured warm-ups', () => {
    const updated = applyWorkConfigToEntry({
      target: { sets: 2, mode: 'reps', reps: 5, weight: 60 },
      sets: [
        { phase: 'warmup', w: 20, r: 8, done: false },
        { phase: 'work', w: 60, r: 5, done: true },
        { phase: 'work', w: 60, r: 5, done: false }
      ]
    }, { sets: 3, mode: 'reps', reps: 8, weight: 70, restSec: 120 })

    expect(updated.target).toMatchObject({ sets: 3, reps: 8, weight: 70, restSec: 120 })
    expect(updated.sets[0]).toEqual({ phase: 'warmup', w: 20, r: 8, done: false })
    expect(updated.sets[1]).toEqual({ phase: 'work', w: 60, r: 5, done: true })
    expect(updated.sets.slice(2)).toEqual([
      { phase: 'work', mode: 'reps', w: 70, r: 8, restSec: 120, done: false },
      { phase: 'work', mode: 'reps', w: 70, r: 8, restSec: 120, done: false }
    ])
  })

  it('keeps progression weight out of warm-up-only targets', () => {
    const target = sessionConfigFor({ phases: ['warmup'], mode: 'reps', reps: 8, weight: 20 }, {
      policy: 'linear', weight: 70, reps: 10
    })

    expect(hasSelectedWorkPhase(target)).toBe(false)
    expect(target).not.toHaveProperty('weight')
    expect(target.reps).toBe(10)
  })

  it('exposes only work rows for progression mode scans', () => {
    const entry = {
      target: { mode: 'reps', reps: 5 },
      sets: [
        { warmup: true, mode: 'reps', w: 20, r: 8, done: true },
        { phase: 'work', mode: 'time', sec: 30, done: true },
        { phase: 'work', mode: 'reps', w: 60, r: 5, done: true }
      ]
    }

    expect(workRowsForMode(entry, 'reps')).toHaveLength(1)
    expect(workRowsForMode(entry, 'time')).toHaveLength(1)
  })
})
