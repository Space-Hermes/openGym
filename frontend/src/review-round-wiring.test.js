import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const sheets = readFileSync(new URL('./sheets.jsx', import.meta.url), 'utf8')
const workout = readFileSync(new URL('./views/Workout.jsx', import.meta.url), 'utf8')

describe('review-round workout wiring', () => {
  it('lets an import preview reparse with the selected source unit', () => {
    expect(sheets).toContain("const UNKNOWN_WEIGHT_ROWS_MESSAGE = '{0} weighted rows omitted because their unit is unknown.'")
    expect(sheets).toContain('function ImportSummary({ parsed, close, raw })')
    expect(sheets).toContain('parseImport(raw, { unit: v })')
    expect(sheets).toContain("t('Weights in this file are in')")
    expect(sheets).toContain('<Segmented')
    expect(sheets).toContain('raw={String(rd.result)}')
  })

  it('uses full-target rows by default for TopWeight and auto-confirm', () => {
    expect(sheets).toContain('workRowsForMode')
    expect(sheets).toContain('bestFullSetWeight')
    expect(sheets).toMatch(/S\(\)\.fullSetsDefault === false[\s\S]*?bestFullSetWeight\(entry, entry\?\.target\)/)
    expect(sheets).toContain('export function autoConfirmTopWeight(entryIdx)')
    expect(sheets).toContain('const cur = s.exWeights[entry.id]')
    expect(sheets).toContain('s.exWeights[entry.id] = { w: Math.max(n, cur ? cur.w : 0), d: todayISO() }')
    expect(sheets).toMatch(/if \(unitDone\) \{[\s\S]*?if \(isLastUnit\) workoutCompleteSheet\(\)/)
  })

  it('triggers the top-weight flow only for confirmable completed exercises', () => {
    expect(workout).toContain('autoConfirmTopWeight')
    expect(workout).toContain('shouldConfirmWorkingWeight(e, m)')
    expect(workout).toContain('if (S.endSummary === false) autoConfirmTopWeight(idx)')
    expect(workout).toContain('else topWeightSheet(idx)')
  })
})
