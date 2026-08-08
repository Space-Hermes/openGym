import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const routine = {
  id: 'phase-routine',
  name: 'Phase routine',
  phases: ['warmup', 'work'],
  warmupRestSec: 30,
  workRestSec: 90,
  ex: [{
    id: '0001',
    sets: 2,
    mode: 'reps',
    reps: 5,
    weight: 60,
    warmup: [{
      phase: 'warmup',
      mode: 'reps',
      reps: 8,
      weightPrescription: { kind: 'fixed', weight: 20 },
      restSec: 15
    }]
  }]
}

const clone = value => JSON.parse(JSON.stringify(value))

function installBrowserBoundary() {
  const listeners = new Map()
  const storage = new Map()
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => {
      if (listeners.get(name) === callback) listeners.delete(name)
    }
  })
  vi.stubGlobal('localStorage', {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear()
  })
}

describe('beginWorkout phase settings', () => {
  let beginWorkout
  let useStore
  let DEF
  let restSecondsFor

  beforeEach(async () => {
    vi.resetModules()
    installBrowserBoundary()
    ;({ beginWorkout } = await import('./sheets.jsx'))
    ;({ restSecondsFor } = await import('./lib/workout-runtime.js'))
    ;({ DEF, useStore } = await import('./store/useStore.js'))
    useStore.setState({
      S: { ...clone(DEF), routines: [clone(routine)], workouts: [], active: null },
      user: null,
      ready: true
    })
  })

  afterEach(() => {
    useStore?.setState({ S: clone(DEF), user: null, ready: true })
    vi.unstubAllGlobals()
  })

  it('builds configured warm-up rows before work rows and preserves phase-specific rest', () => {
    beginWorkout(routine.id, 70)
    const active = useStore.getState().S.active
    expect(active.entries[0].sets).toEqual([
      { phase: 'warmup', mode: 'reps', w: 20, r: 8, done: false, restSec: 15 },
      { phase: 'work', mode: 'reps', w: 60, r: 5, done: false },
      { phase: 'work', mode: 'reps', w: 60, r: 5, done: false }
    ])
    expect(active.entries[0].target).toMatchObject({
      phases: ['warmup', 'work']
    })
    expect(restSecondsFor(active.entries[0].sets[0], active.entries[0].target, routine, 90)).toBe(15)
    expect(restSecondsFor(active.entries[0].sets[1], active.entries[0].target, routine, 90)).toBe(90)
  })
})
