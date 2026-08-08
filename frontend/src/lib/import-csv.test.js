import { describe, expect, it } from 'vitest'
import { mergeImport, parseBodyweight, parseWorkoutCSV } from './import-csv.js'

const LB_TO_KG = 0.45359237

const emptyState = () => ({
  bodyweight: [],
  workouts: [],
  customEx: [],
  exWeights: {},
})

describe('canonical workout import boundary', () => {
  it('converts kg and lb rows to canonical kilograms without unit stamps', () => {
    const csv = [
      'Date,Exercise,Weight,Weight Unit,Reps',
      '2026-08-08,Bench Press,100,lb,5',
      '2026-08-08,Bench Press,60,kg,5',
    ].join('\n')

    const parsed = parseWorkoutCSV(csv, { unit: 'lb' })
    const workout = parsed.workouts[0]
    const entry = workout.entries[0]

    expect(entry.sets.map(set => set.w)).toEqual([100 * LB_TO_KG, 60])
    expect(entry.sets.every(set => !('u' in set))).toBe(true)
    expect(entry.topW).toBe(60)
    expect(workout.vol).toBe(100 * LB_TO_KG * 5 + 60 * 5)
    expect(parsed.fileUnit).toBe('')
    expect(parsed.mixedUnits).toBe(true)
    expect(parsed.converted).toBe(true)
  })

  it('uses the selected profile unit only as the source for unannotated rows', () => {
    const csv = [
      'Date,Exercise,Weight,Reps',
      '2026-08-09,Bench Press,100,5',
    ].join('\n')

    const parsed = parseWorkoutCSV(csv, { unit: 'lb' })

    expect(parsed.workouts[0].entries[0].sets[0].w).toBe(100 * LB_TO_KG)
    expect(parsed.fileUnit).toBe('lb')
    expect(parsed.mixedUnits).toBe(false)
    expect(parsed.converted).toBe(true)
  })

  it('reports conversion for explicitly labelled pounds even when the profile is already lb', () => {
    const csv = [
      'Date,Exercise,Weight,Weight Unit,Reps',
      '2026-08-10,Bench Press,100,lb,5',
    ].join('\n')

    const parsed = parseWorkoutCSV(csv, { unit: 'lb' })

    expect(parsed.fileUnit).toBe('lb')
    expect(parsed.mixedUnits).toBe(false)
    expect(parsed.converted).toBe(true)
    expect(parsed.workouts[0].entries[0].sets[0].w).toBe(100 * LB_TO_KG)
  })

  it('keeps kg-only conversion metadata false even when the profile displays pounds', () => {
    const csv = [
      'Date,Exercise,Weight,Weight Unit,Reps',
      '2026-08-11,Bench Press,60,kg,5',
    ].join('\n')

    const parsed = parseWorkoutCSV(csv, { unit: 'lb' })

    expect(parsed.fileUnit).toBe('kg')
    expect(parsed.mixedUnits).toBe(false)
    expect(parsed.converted).toBe(false)
    expect(parsed.workouts[0].entries[0].sets[0].w).toBe(60)
  })
})

describe('canonical bodyweight import boundary', () => {
  it('converts mixed Apple Health rows independently to kilograms', () => {
    const xml = [
      '<HealthData>',
      '<Record type="HKQuantityTypeIdentifierBodyMass" value="180" unit="lb" startDate="2026-01-01 08:00:00"/>',
      '<Record type="HKQuantityTypeIdentifierBodyMass" value="70" unit="kg" startDate="2026-01-02 08:00:00"/>',
      '</HealthData>',
    ].join('')

    const parsed = parseBodyweight(xml, { unit: 'lb' })

    expect(parsed.bodyweight.map(row => row.w)).toEqual([180 * LB_TO_KG, 70])
    expect(parsed.bodyweight.every(row => !('unit' in row))).toBe(true)
  })

  it('converts per-row units in weight-only CSV exports', () => {
    const csv = [
      'Date,Weight,Weight Unit',
      '2026-01-01,180,lb',
      '2026-01-02,70,kg',
    ].join('\n')

    const parsed = parseBodyweight(csv, { unit: 'kg' })

    expect(parsed.bodyweight.map(row => row.w)).toEqual([180 * LB_TO_KG, 70])
  })

  it('reports pounds conversion for an Apple Health file even when the profile is already lb', () => {
    const xml = '<HealthData><Record type="HKQuantityTypeIdentifierBodyMass" value="180" unit="lb" startDate="2026-01-03 08:00:00"/></HealthData>'

    const parsed = parseBodyweight(xml, { unit: 'lb' })

    expect(parsed.fileUnit).toBe('lb')
    expect(parsed.mixedUnits).toBe(false)
    expect(parsed.converted).toBe(true)
  })

  it('uses an lb profile as the source hint for a unitless bodyweight CSV', () => {
    const csv = [
      'Date,Weight',
      '2026-01-06,180',
    ].join('\n')

    const parsed = parseBodyweight(csv, { unit: 'lb' })

    expect(parsed.fileUnit).toBe('lb')
    expect(parsed.mixedUnits).toBe(false)
    expect(parsed.converted).toBe(true)
    expect(parsed.bodyweight[0].w).toBe(180 * LB_TO_KG)
  })

  it('reports mixed Apple Health units as both mixed and converted', () => {
    const xml = [
      '<HealthData>',
      '<Record type="HKQuantityTypeIdentifierBodyMass" value="180" unit="lb" startDate="2026-01-04 08:00:00"/>',
      '<Record type="HKQuantityTypeIdentifierBodyMass" value="70" unit="kg" startDate="2026-01-05 08:00:00"/>',
      '</HealthData>',
    ].join('')

    const parsed = parseBodyweight(xml, { unit: 'lb' })

    expect(parsed.fileUnit).toBe('')
    expect(parsed.mixedUnits).toBe(true)
    expect(parsed.converted).toBe(true)
  })
})

describe('canonical merge boundary', () => {
  it('normalizes legacy stamped workout and bodyweight records before storing them', () => {
    const state = emptyState()
    const parsed = {
      kind: 'workouts',
      customEx: [],
      workouts: [{
        id: 'legacy-workout', d: '2026-08-10', unit: 'lb', bw: 180,
        entries: [{
          id: '0025', unit: 'lb', topW: 200,
          sets: [{ u: 'lb', w: 200, r: 5, done: true }],
        }],
      }],
    }

    mergeImport(state, parsed)
    const workout = state.workouts[0]
    const entry = workout.entries[0]
    const set = entry.sets[0]

    expect(workout.bw).toBe(180 * LB_TO_KG)
    expect(entry.topW).toBe(200 * LB_TO_KG)
    expect(set.w).toBe(200 * LB_TO_KG)
    expect(workout.vol).toBe(200 * LB_TO_KG * 5)
    expect(workout.unit).toBeUndefined()
    expect(entry.unit).toBeUndefined()
    expect(set.u).toBeUndefined()
    expect(state.exWeights['0025']).toEqual({ w: 200 * LB_TO_KG, d: '2026-08-10' })
  })

  it('keeps unitless kg-era workout and weigh-in values unchanged', () => {
    const state = emptyState()

    mergeImport(state, {
      kind: 'bodyweight',
      bodyweight: [{ d: '2026-01-01', w: 70 }],
    })
    mergeImport(state, {
      kind: 'workouts',
      customEx: [],
      workouts: [{
        id: 'kg-workout', d: '2026-01-02',
        entries: [{ id: '0025', sets: [{ w: 60, r: 5, done: true }] }],
      }],
    })

    expect(state.bodyweight[0].w).toBe(70)
    expect(state.workouts[0].entries[0].sets[0].w).toBe(60)
    expect(state.workouts[0].vol).toBe(300)
  })
})
