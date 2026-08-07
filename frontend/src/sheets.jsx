import { useEffect, useRef, useState } from 'react'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { EXDB, EXIDX, BODYPARTS, isCardio, isBodyweightEq, allExercises, equipmentOf } from './lib/exercises.js'
import { fmtDate, fmtNum, fmtVol, fmtDur, durPart, todayISO, uid, exCount, DAYN, MONTHS_LONG, ACCENTS } from './lib/format.js'
import { lastEntryFor, bestWeightFor, buildSets, effectiveRoutineId, workoutVolume, setsDone, setsDoneActive, lastBW, supersetUnits, unitOf, setLabel, defaultConfig, cleanupSg, modeOf, effortOf, isBw, isPerSide, sideReps, workSetsDone } from './lib/history.js'
import { beep, vibrate } from './lib/sound.js'
import { t, instrFor, getLang, INSTR_LANGS } from './lib/i18n.js'
import { nav } from './lib/nav.js'
import { starterRoutines } from './lib/starter.js'
import Media, { Thumb } from './components/Media.jsx'
import Stepper from './components/Stepper.jsx'
import Icon from './components/Icon.jsx'
import { Button, Slider, Switch, Segmented, SelectRow, Row } from './components/ui.jsx'
import { glyphOf, GLYPH_GROUPS, DEFAULT_GLYPH } from './lib/glyphs.js'
import BodyMap from './components/BodyMap.jsx'
import { loadOfWorkouts } from './lib/muscles.js'
import { parseImport, mergeImport } from './lib/import-csv.js'
import { buildPlanBundle, parsePlan, mergePlan, printPlan } from './lib/plan-share.js'
import { estimate1RM, best1RM, is1RMRecord, REP_CAP } from './lib/onerm.js'
import { nextPrescription, applyPrescription, policyFor, defaultIncrement, POLICIES_FOR, POLICY_NAME, POLICY_DESC, MAX_BW_SETS } from './lib/progression.js'
import { MOBILE, shareExport } from './lib/mobile.js'
  // Cardio keeps its own duration+speed form; the reps/time choice (issue #16) is offered for
  // everything else, which is where the gap was — planks, hangs, wall sits, loaded carries.
  const warmupRows = c.warmupRows || []
  const hasWarmup = warmupRows.length > 0
  const mode = cardio ? 'cardio' : modeOf({ ...c, id: ex.id })
  const greyskull = mode === 'reps' && policyFor({ ...c, id: ex.id }, routine, 'reps') === 'greyskull'
  // Greyskull defaults the final work row to AMRAP, but an explicit fixed target is a
  // deliberate override. This keeps the routine policy useful without making AMRAP mandatory.
  const effectiveAmrap = !cardio && (c.kind === 'amrap' || (c.kind == null && greyskull))
  // Both default from the dataset and are then whatever the config says — see isBw.
  const bw = !cardio && isBw({ ...c, id: ex.id })
  const perSide = isPerSide(c)
  // Keep whatever the other mode already had (sets, weight) and fill only what is missing.
  const setMode = m => setC(x => ({ ...defaultConfig(ex.id, m), ...x, mode: m }))
  const save = () => {
    close()
    if (phaseOnly === 'work') {
      const load = c.loadMode === 'percentage'
        ? { kind: 'percentage', percent: Math.max(1, Math.min(200, Math.round(Number(c.loadPercent)) || 50)), fallbackWeight: Math.max(0, Number(c.loadFallback) || 0) }
        : { kind: 'fixed', weight: Math.max(0, Number(c.weight) || 0) }
      onSave({
        sets: Math.max(1, Math.round(c.sets) || 3),
        mode: mode === 'time' ? 'time' : 'reps',
        ...(mode === 'time'
          ? { sec: Math.max(1, Math.round(c.sec) || 45), weight: load.weight }
          : { reps: Math.max(1, Math.round(c.reps) || 10), weight: load.weight, ...(c.loadMode === 'percentage' ? { weightPrescription: load } : {}) }),
        ...(c.restSec != null ? { restSec: Math.max(0, Math.round(c.restSec)) } : {})
      })
      return
    }
    if (phaseOnly) {
      onSave({
        warmup: warmupRowsFromEditor(c.warmupRows || []),
        ...(c.warmupRestSec != null ? { warmupRestSec: Math.max(0, Math.round(c.warmupRestSec)) } : {}),
        ...(c.workRestSec != null ? { workRestSec: Math.max(0, Math.round(c.workRestSec)) } : {})
      })
      return
    }
    const sets = Math.max(1, Math.round(c.sets) || (cardio ? 1 : 3))
    // Only carry progression settings that differ from the inherited default, so a plan file
    // stays readable and "follow the routine" keeps meaning exactly that.
    const prog = {}
    if (c.prog) prog.prog = c.prog
    if (c.inc > 0) prog.inc = c.inc
    if (c.amrapMissPolicy) prog.amrapMissPolicy = c.amrapMissPolicy
    // Written only when it differs from what the dataset already says, so a barbell config
    // stays exactly the shape it was before these flags existed.
    // `bodyweight` is true of a hold as much as of a set of reps; `side` is not — it counts
    // reps, and a timed hold has none. Switching an exercise to Time therefore drops it
    // rather than carrying a flag nothing downstream can read.
    const flags = {}
    if (bw !== isBodyweightEq(ex.id)) flags.bodyweight = bw
    const load = c.loadMode === 'percentage'
      ? { kind: 'percentage', percent: Math.max(1, Math.min(200, Math.round(c.loadPercent) || 50)), fallbackWeight: Math.max(0, c.loadFallback || 0) }
      : { kind: 'fixed', weight: Math.max(0, c.weight || 0) }
    const warmup = warmupRows.length ? warmupRowsFromEditor(warmupRows) : undefined
    const amrapMinimum = Math.max(1, Math.round(Number(c.amrapMinReps ?? c.minReps ?? c.reps) || 1))
    const common = {
      ...(effectiveAmrap
        ? { kind: 'amrap', ...(mode === 'reps'
          ? { amrapMinReps: amrapMinimum }
          : (c.amrapMaxSec > 0 ? { amrapMaxSec: Math.max(1, Math.round(c.amrapMaxSec)) } : {})) }
        : c.kind === 'fixed' ? { kind: 'fixed' } : {}),
      ...(warmup ? { warmup } : {}),
      ...(c.warmupRestSec != null ? { warmupRestSec: Math.max(0, Math.round(c.warmupRestSec)) } : {}),
      ...(c.workRestSec != null ? { workRestSec: Math.max(0, Math.round(c.workRestSec)) } : {})
    }
    if (cardio) onSave({ sets, min: Math.max(1, Math.round(c.min) || 20), speed: Math.max(0, c.speed || 8), ...common })
    else if (mode === 'time') onSave({ sets, mode: 'time', sec: Math.max(1, Math.round(c.sec) || 45), weight: Math.max(0, c.weight || 0), prepSec: Math.max(0, Math.round(c.prepSec ?? 5)), ...common, ...flags, ...prog })
    else {
      const reps = Math.max(1, Math.round(c.reps) || 10)
      const out = { sets, mode: 'reps', reps, weight: load.weight, ...(c.loadMode === 'percentage' ? { weightPrescription: load } : {}), ...common, ...flags, ...(perSide ? { side: true } : {}), ...prog }
      if (policyFor({ ...c, id: ex.id }, routine, 'reps') === 'double') out.repsMin = Math.min(reps, Math.max(1, Math.round(c.repsMin) || Math.max(1, reps - 2)))
      // A ceiling below the working reps would tell you to add a set on day one.
      if (bw && !(out.weight > 0) && c.repsMax > 0) out.repsMax = Math.max(reps, Math.round(c.repsMax))
      onSave(out)
    }
  }
  if (phaseOnly === 'work') return <>
    <h3>{t('Work settings')}</h3>
    <WorkPhaseFields c={c} setC={setC} mode={mode} unit={st.unit} ex={ex} routine={routine} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
  </>
  if (phaseOnly) return <>
    <h3>{t('Warm-up settings')}</h3>
    <WarmupFields c={c} setC={setC} mode={mode} unit={st.unit} phaseOnly />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
  </>
  return <>
    <h3 className="capitalize">{ex.n}</h3>
    <Media ex={ex} />
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '10px 0 14px' }}>
      {cardio && <span className="tag acc"><Icon name="figureRun" />{t('Cardio')}</span>}
      <span className="tag">{t(ex.tg || ex.bp)}</span><span className="tag">{t(ex.eq)}</span>
    </div>
    {ex.desc && <div className="exnote">{ex.desc}</div>}
    {!cardio && <div style={{ marginBottom: 14 }}>
      <Segmented className="seg-range" value={mode} onChange={setMode}
        options={[{ value: 'reps', label: t('Reps') }, { value: 'time', label: t('Time') }]} />
    </div>}
    <div className="row cfgrow" style={{ marginBottom: mode === 'time' ? 8 : 18 }}>
      {cardio ? <>
        <Stepper label={t('Intervals')} value={c.sets} step={1} decimal={false} onChange={v => setC(x => ({ ...x, sets: v }))} />
        <Stepper label={t('Minutes')} value={c.min} step={1} decimal={false} onChange={v => setC(x => ({ ...x, min: v }))} />
        <Stepper label={t('Speed (km/h)')} value={c.speed} step={0.5} onChange={v => setC(x => ({ ...x, speed: v }))} />
      </> : mode === 'time' ? <>
        <Stepper label={t('Sets')} value={c.sets} step={1} decimal={false} onChange={v => setC(x => ({ ...x, sets: v }))} />
        <Stepper label={t('Seconds')} value={c.sec} step={5} decimal={false} onChange={v => setC(x => ({ ...x, sec: v }))} />
        <Stepper label={t('Weight ({0})', st.unit)} value={c.weight} step={2.5} onChange={v => setC(x => ({ ...x, weight: v }))} />
      </> : <>
        <Stepper label={t('Sets')} value={c.sets} step={1} decimal={false} onChange={v => setC(x => ({ ...x, sets: v }))} />
        <Stepper label={t('Reps')} value={c.reps} step={perSide ? 2 : 1} decimal={false} onChange={v => setC(x => ({ ...x, reps: v }))} />
        {/* On bodyweight work the weight stepper is the click #32 is about, so it is not here
            until there is a belt to describe — see the added-weight row below. */}
        {!bw && <Stepper label={t('Weight ({0})', st.unit)} value={c.weight} step={2.5} onChange={v => setC(x => ({ ...x, weight: v }))} />}
      </>}
    </div>
    {mode === 'time' && <div className="row cfgrow" style={{ marginBottom: 12 }}>
      <Stepper label={t('Prep (s)')} value={c.prepSec ?? 5} step={1} decimal={false} onChange={v => setC(x => ({ ...x, prepSec: v }))} />
      <div className="small dim" style={{ alignSelf: 'center', lineHeight: 1.35 }}>{t('Countdown before the hold starts; 0 disables it.')}</div>
    </div>}
    {!cardio && <>
      <div className="sect-b" style={{ marginBottom: 10 }}>
        <SelectRow title={t('Target')} sheetTitle={t('Target')} value={effectiveAmrap ? 'amrap' : 'fixed'}
          onChange={v => setC(x => ({ ...x, kind: v }))}
          options={[{ value: 'fixed', label: t('Fixed target') }, { value: 'amrap', label: t('AMRAP') }]} />
      </div>
      {effectiveAmrap && <>
        {greyskull && <div className="small dim" style={{ marginBottom: 10 }}>{t('Greyskull uses the final work set as AMRAP.')}</div>}
        {mode === 'reps'
          ? <div className="row cfgrow" style={{ marginBottom: 12 }}>
            <Stepper label={t('Minimum reps')} value={c.amrapMinReps || c.reps || 1} step={1} decimal={false} onChange={v => setC(x => ({ ...x, amrapMinReps: v }))} />
          </div>
          : <div className="row cfgrow" style={{ marginBottom: 12 }}>
            <Stepper label={t('Maximum duration (optional)')} value={c.amrapMaxSec || 0} step={5} decimal={false} onChange={v => setC(x => ({ ...x, amrapMaxSec: v }))} />
            <div className="small dim" style={{ alignSelf: 'center', lineHeight: 1.35 }}>{t('The configured seconds are the minimum hold; this optional duration applies only to the final work AMRAP.')}</div>
          </div>}
      </>}
      {mode !== 'time' && <div className="sect-b" style={{ marginBottom: 10 }}>
        <SelectRow title={t('Load')} sheetTitle={t('Load')} value={c.loadMode === 'percentage' ? 'percentage' : 'fixed'}
          onChange={v => setC(x => ({ ...x, loadMode: v }))}
          options={[{ value: 'fixed', label: t('Fixed weight') }, { value: 'percentage', label: t('% of theoretical 1RM') }]} />
      </div>}
      {c.loadMode === 'percentage' && <div className="row cfgrow" style={{ marginBottom: 12 }}>
        <Stepper label={t('Percent')} value={c.loadPercent || 50} step={5} decimal={false} onChange={v => setC(x => ({ ...x, loadPercent: v }))} />
        <Stepper label={t('Fallback weight ({0})', st.unit)} value={c.loadFallback || 0} step={2.5} onChange={v => setC(x => ({ ...x, loadFallback: v }))} />
      </div>}
      <WarmupFields c={c} setC={setC} mode={mode} unit={st.unit} />
    </>}
    {cardio && <div className="row cfgrow" style={{ marginBottom: 18 }}>
      <Stepper label={t('Work rest (s)')} value={c.workRestSec ?? 90} step={15} decimal={false} onChange={v => setC(x => ({ ...x, workRestSec: v }))} />
    </div>}
    {mode === 'time' && <div className="small dim" style={{ marginBottom: 18 }}>
      {t('A timer runs while you hold the set. Leave the weight at 0 for bodyweight holds.')}
    </div>}
    {/* ---------- bodyweight + per side (issues #31/#32/#33) ---------- */}
    {!cardio && <div className="sect-b" style={{ marginBottom: 8 }}>
      <Row icon="figureStrength" iconTint="var(--acc)" title={t('Bodyweight')}
        subtitle={bw ? t('No weight to enter — just log the reps.') : t('Ask for a weight on every set.')}>
        <Switch checked={bw} onChange={v => setC(x => ({ ...x, bodyweight: v, weight: v ? 0 : x.weight }))} />
      </Row>
      {mode === 'reps' && <Row icon="shuffle" iconTint="var(--blue)" title={t('Reps per side')}
        subtitle={perSide ? t('You still log the total: {0} is {1} per side.', c.reps || 0, fmtNum(sideReps(c.reps))) : t('For lunges, single-arm rows and the like.')}>
        {/* Turning it on rounds the target up to an even number, since half of an odd
            total is a rep one side does not get. */}
        <Switch checked={perSide} onChange={v => setC(x => ({ ...x, side: v || undefined, reps: v ? Math.ceil((x.reps || 0) / 2) * 2 : x.reps }))} />
      </Row>}
    </div>}
    {/* A stepper is too wide to sit in a list row next to a label — it squeezes the text to
        one word per line — so added weight gets the same full-width treatment as sets and
        reps, with its explanation underneath. */}
    {bw && <>
      <div className="row cfgrow" style={{ marginBottom: 8 }}>
        <Stepper label={t('Added ({0})', st.unit)} value={c.weight || 0} step={2.5}
          onChange={v => setC(x => ({ ...x, weight: v }))} />
      </div>
      <div className="small dim" style={{ marginBottom: 18 }}>
        {t('For dips or pull-ups with a belt. Progression then follows the weight.')}
      </div>
    </>}
    {/* The rep ceiling only means something when there is no load to add instead. */}
    {mode === 'reps' && bw && !(c.weight > 0) && <div className="row cfgrow" style={{ marginBottom: 18 }}>
      <Stepper label={t('Top of the range')} value={c.repsMax || 0} step={1} decimal={false}
        onChange={v => setC(x => ({ ...x, repsMax: v }))} />
    </div>}
    {mode === 'reps' && bw && !(c.weight > 0) && <div className="small dim" style={{ marginTop: -10, marginBottom: 18 }}>
      {c.repsMax > 0
        ? t('Reps climb to {0}, then a set is added and the reps start over. At {1} sets it asks you to add weight instead.', c.repsMax, MAX_BW_SETS)
        : t('Reps climb by one whenever every set was clean. Set a ceiling to add sets instead of reps forever.')}
    </div>}
    <ProgressionFields ex={ex} mode={mode} c={c} setC={setC} routine={routine} unit={st.unit} />
    <Button variant="primary" onClick={save}>{existing ? t('Save') : t('Add to routine')}</Button>
    {ex.custom && <><div style={{ height: 8 }} /><Button icon="pencil" onClick={() => { close(); customExSheet(ex) }}>{t('Edit or delete this exercise')}</Button></>}
    {onDelete && <><div style={{ height: 8 }} /><Button variant="danger" onClick={() => { close(); onDelete() }}>{t('Remove from routine')}</Button></>}
  </>
}
export const exConfigSheet = (ex, existing, onSave, onDelete, routine, initial) => ui().openSheet(close => <ExConfig ex={ex} existing={existing} initial={initial} onSave={onSave} onDelete={onDelete} routine={routine} close={close} />)

export const warmupConfigSheet = (ex, existing, onSave, routine) => ui().openSheet(close => <ExConfig ex={ex} existing={existing} onSave={onSave} routine={routine} phaseOnly close={close} />)
export const workConfigSheet = (ex, existing, onSave) => ui().openSheet(close => <ExConfig ex={ex} existing={existing} onSave={onSave} phaseOnly={'work'} close={close} />)

/* ============================ glyph picker ============================ */
// Grouped by what the glyph means for a training day, so picking one is a scan
// of four short rows rather than a hunt through twenty loose icons.
export const glyphPicker = (current, onPick) => {
  const cur = glyphOf(current)
  return ui().openSheet(close => <>
    <h3>{t('Pick an icon')}</h3>
    {GLYPH_GROUPS.map(g => (
      <div key={g.key} style={{ marginBottom: 14 }}>
        <div className="sect-t" style={{ padding: '0 2px 7px' }}>{t(g.key)}</div>
        <div className="glyph-grid">
          {g.items.map(n => (
            <button key={n} className={'glyph-cell' + (n === cur ? ' on' : '')}
              onClick={() => { close(); onPick(n) }} aria-label={n}>
              <Icon name={n} />
            </button>
          ))}
        </div>
      </div>
    ))}
    <div style={{ height: 4 }} />
  </>)
}

/* ============================ share / print / import a plan ============================ */
export const planToolsSheet = () => ui().openSheet(close => <PlanTools close={close} />)

function PlanTools({ close }) {
  const st = useStore(s => s.S)
  const user = useStore(s => s.user)
  const fileRef = useRef(null)
  const hasRoutines = (st.routines || []).some(r => r.ex && r.ex.length)

  const exportFile = async () => {
    const bundle = buildPlanBundle(st, user?.name ? t('{0}’s plan', user.name) : '')
    const json = JSON.stringify(bundle, null, 2)
    const name = 'opengym-plan-' + todayISO() + '.json'
    if (MOBILE) { try { await shareExport(json, name) } catch (e) { /* dismissed */ } close(); return }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    close(); toast(t('Plan file saved — send it to a friend'))
  }
  const pickFile = ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return
    const rd = new FileReader()
    rd.onload = () => {
      try { const bundle = parsePlan(rd.result); close(); planImportSheet(bundle) }
      catch (e) { toast(t('Import failed: {0}', planErrorMessage(e))) }
    }
    rd.readAsText(f)
  }

  return <>
    <h3>{t('Share your plan')}</h3>
    <div className="muted small" style={{ marginBottom: 16 }}>{t('Send your routines to a friend, or put your week on paper.')}</div>
    <Button variant="primary" icon="upload" onClick={exportFile} disabled={!hasRoutines}>{t('Export plan file')}</Button>
    <div className="dim small" style={{ margin: '7px 2px 0', lineHeight: 1.4 }}>{t('A small file a friend imports into their own openGym — routines only, none of your workouts or weigh-ins.')}</div>
    {!MOBILE && <>
      <div style={{ height: 12 }} />
      <Button variant="tinted" icon="download" onClick={() => { close(); printPlan(st, user?.name || '') }} disabled={!hasRoutines}>{t('Print / Save as PDF')}</Button>
      <div className="dim small" style={{ margin: '7px 2px 0', lineHeight: 1.4 }}>{t('A clean one-page-per-plan printout — no exercise ever splits across a page.')}</div>
    </>}
    {!hasRoutines && <div className="dim small" style={{ margin: '12px 2px 0' }}>{t('Add an exercise to a routine first — an empty plan has nothing to share.')}</div>}
    <h4 className="sec">{t('Got a plan from a friend?')}</h4>
    <Button variant="ghost" icon="folder" onClick={() => fileRef.current?.click()}>{t('Import a plan file')}</Button>
    <input ref={fileRef} type="file" accept="application/json,.json" onChange={pickFile} hidden />
  </>
}

export const planImportSheet = bundle => ui().openSheet(close => <PlanImport bundle={bundle} close={close} />)

function PlanImport({ bundle, close }) {
  const st = useStore(s => s.S)
  const [schedule, setSchedule] = useState(false)
  let unitError = null
  try { preparePlanForDestination(bundle, st.unit) } catch (e) { unitError = planErrorMessage(e) }
  const apply = () => {
    try {
      update(s => mergePlan(s, bundle, { schedule }))
    } catch (e) {
      toast(t('Import failed: {0}', planErrorMessage(e)))
      return
    }
    close()
    toast(t('Added {0} routines to your plan', bundle.routineCount))
    nav('/plan')
  }
  return <>
    <h3>{bundle.name ? t('Import “{0}”', bundle.name) : t('Import this plan')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>
      {t(bundle.routineCount === 1 ? '{0} routine' : '{0} routines', bundle.routineCount)}
      {' · ' + exCount(bundle.exerciseCount)}
      {bundle.scheduledDays > 0
        ? ' · ' + t(bundle.scheduledDays === 1 ? 'scheduled on {0} day' : 'scheduled on {0} days', bundle.scheduledDays)
        : ''}
    </div>
    <div className="dim small" style={{ marginBottom: 14, lineHeight: 1.4 }}>{t('These are added as new routines — nothing you already have is changed.')}</div>
    {unitError
      ? <div className="small" style={{ color: 'var(--red)', marginBottom: 14, lineHeight: 1.4 }}>{unitError}</div>
      : bundle.unit && bundle.unit !== st.unit
        ? <div className="small" style={{ color: 'var(--yellow)', marginBottom: 14, lineHeight: 1.4 }}>{t('This plan is in {0}; weights will be converted to your profile’s {1}.', bundle.unit, st.unit)}</div>
        : !bundle.unit
          ? <div className="small dim" style={{ marginBottom: 14, lineHeight: 1.4 }}>{t('This legacy plan does not declare a weight unit. Weighted values are accepted only when no conversion is needed.')}</div>
          : null}
    {bundle.dropped > 0 && <div className="small" style={{ color: 'var(--yellow)', marginBottom: 14, lineHeight: 1.4 }}>
      {t(bundle.dropped === 1
        ? '{0} exercise in the file isn’t in your library and was left out.'
        : '{0} exercises in the file aren’t in your library and were left out.', bundle.dropped)}
    </div>}
    {bundle.scheduledDays > 0 && <div className="row between" style={{ padding: '10px 2px', borderTop: '1px solid var(--sep)', borderBottom: '1px solid var(--sep)', marginBottom: 16, gap: 12 }}>
      <div><div className="tt" style={{ fontSize: 15 }}>{t('Use this weekly schedule')}</div><div className="small dim">{t('Replaces your current Mon–Sun assignments.')}</div></div>
      <Switch checked={schedule} onChange={setSchedule} />
    </div>}
    <Button variant="primary" onClick={apply} disabled={!!unitError}>{t('Add to my plan')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

/* ============================ day override / assign ============================ */
function DayOverride({ iso, close }) {
  const st = useStore(s => s.S)
  const wd = new Date(iso + 'T12:00:00').getDay()
  const weeklyR = st.routines.find(r => r.id === st.week[wd])
  const hasOvr = st.dayPlan[iso] !== undefined
  const effId = effectiveRoutineId(st, iso)
  const set = v => {
    update(s => { if (!v) delete s.dayPlan[iso]; else s.dayPlan[iso] = v })
    close()
    toast(v === '' ? t('Back to weekly plan') : v === 'rest' ? t('{0} set to rest', fmtDate(iso)) : t('{0} planned for {1}', (st.routines.find(r => r.id === v) || {}).name, fmtDate(iso)))
  }
  return <>
    <h3>{fmtDate(iso, true)}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Weekly plan:')} {weeklyR ? weeklyR.name : t('Rest')}{hasOvr && <span style={{ color: 'var(--orange)' }}> · {t('changed for this day')}</span>}<br />{t('Sick, missed a day or want a different session? Pick what to train instead.')}</div>
    <div className="list">
      {st.routines.map(r => <div key={r.id} className="item" onClick={() => set(r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        {effId === r.id && <Icon name="check" className="accent" />}</div>)}
      <div className="item" onClick={() => set('rest')}><span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="moon" /></span><div className="grow"><div className="tt">{t('Rest / skip this day')}</div></div>{effId === null && <Icon name="check" className="accent" />}</div>
      {hasOvr && <div className="item" onClick={() => set('')}><span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="reset" /></span><div className="grow"><div className="tt">{t('Back to weekly plan')}</div></div></div>}
    </div>
  </>
}
export const dayOverrideSheet = iso => ui().openSheet(close => <DayOverride iso={iso} close={close} />)

function DayAssign({ day, close }) {
  const st = useStore(s => s.S)
  const set = v => { update(s => { if (v) s.week[day] = v; else delete s.week[day] }); close() }
  return <>
    <h3>{t(DAYN[day])}</h3>
    <div className="list">
      <div className="item" onClick={() => set('')}><span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="moon" /></span><div className="grow"><div className="tt">{t('Rest day')}</div></div>{!st.week[day] && <Icon name="check" className="accent" />}</div>
      {st.routines.map(r => <div key={r.id} className="item" onClick={() => set(r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        {st.week[day] === r.id && <Icon name="check" className="accent" />}</div>)}
    </div>
  </>
}
export const dayAssignSheet = day => ui().openSheet(close => <DayAssign day={day} close={close} />)

/* ============================ workout detail ============================ */
function WorkoutDetail({ w, close }) {
  const st = useStore(s => s.S)
  return <>
    <h3>{w.name}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{[fmtDate(w.d, true), ...durPart(w.end - w.start), fmtVol(workoutVolume(w, st.unit), st.unit), ...(w.bw ? [fmtNum(w.bw) + ' ' + st.unit] : [])].join(' · ')}</div>
    {w.entries.map((e, i) => {
      const ex = EXIDX[e.id]
      return <div key={i} className="row" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
        {ex && <Thumb ex={ex} />}
        <div className="grow"><div className="tt capitalize" style={{ fontWeight: 600 }}>{ex ? ex.n : (e.n || e.id)} {w.prs && w.prs.includes(e.id) && <span className="pr"><Icon name="trophy" />PR</span>}</div>
          <div className="ss">{e.sets.some(s => s.done) ? ['warmup', 'work'].map(phase => {
            const phaseSets = e.sets.filter(s => s.done && normalizePhase(s.phase, 'work') === phase)
            return phaseSets.length ? <span key={phase} className="phase-summary"><b>{t(phase === 'warmup' ? 'Warm-up' : 'Work')}:</b> {phaseSets.map(s => setLabel(e.id, s, e.target)).join(' · ')}</span> : null
          }) : t('no sets')}</div>
          {(() => {
            const result = amrapResultFor(e)
            if (!result) return null
            const actual = result.mode === 'time' ? fmtSec(result.actual) : fmtNum(result.actual)
            const unit = result.mode === 'time' ? t('Seconds') : t('Reps')
            return <div className="small accent" style={{ marginTop: 3 }}>{t('AMRAP')}: {actual} {unit}{result.target ? ' · ≥ ' + result.target + ' ' + unit : ''}</div>
          })()}
        </div>
      </div>
    })}
    <Button variant="danger" onClick={() => confirmSheet({ title: t('Delete workout?'), message: t('This removes it from your history for good.'), confirmText: t('Delete'), danger: true, onConfirm: () => { update(s => { s.workouts = s.workouts.filter(x => x.id !== w.id) }); close(); toast(t('Workout deleted')) } })}>{t('Delete workout')}</Button>
  </>
}
export const workoutDetailSheet = w => ui().openSheet(close => <WorkoutDetail w={w} close={close} />)

/* ============================ calendar ============================ */
function Calendar({ start, close }) {
  const st = useStore(s => s.S)
  const [cur, setCur] = useState(() => { const d = start ? new Date(start) : new Date(); d.setDate(1); return d })
  const y = cur.getFullYear(), mo = cur.getMonth()
  const byDay = {}
  st.workouts.filter(w => historyUnitCompatible(w, st.unit)).forEach(w => (byDay[w.d] = byDay[w.d] || []).push(w))
  const startOffset = (new Date(y, mo, 1).getDay() + 6) % 7
  const daysIn = new Date(y, mo + 1, 0).getDate()
  const monthWs = st.workouts.filter(w => historyUnitCompatible(w, st.unit) && w.d.startsWith(y + '-' + String(mo + 1).padStart(2, '0')))
  const monthVol = monthWs.reduce((a, w) => a + workoutVolume(w, st.unit), 0)
  const monthMs = monthWs.reduce((a, w) => a + Math.max(0, (w.end || w.start) - w.start), 0)
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(<div key={'e' + i} />)
  for (let d = 1; d <= daysIn; d++) {
    const iso = y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    const ws = byDay[iso], effId = effectiveRoutineId(st, iso), ovr = st.dayPlan[iso] !== undefined
    const dotCls = ws ? 'done' : ovr && effId ? 'ovr' : effId ? 'plan' : ''
    cells.push(<button key={d} className={'cal-d' + (ws ? ' has' : '') + (iso === todayISO() ? ' today' : '')} onClick={() => {
      if (!ws) { close(); dayOverrideSheet(iso); return }
      if (ws.length === 1) { close(); workoutDetailSheet(ws[0]); return }
      close(); ui().openSheet(c2 => <><h3>{fmtDate(iso, true)}</h3><div className="list">{ws.map(w => <WorkoutRow key={w.id} w={w} onClick={() => { c2(); workoutDetailSheet(w) }} />)}</div></>)
    }}><span>{d}</span><i className={dotCls} /></button>)
  }
  return <>
    <div className="row between" style={{ marginBottom: 2 }}>
      <button className="iconbtn" onClick={() => setCur(new Date(y, mo - 1, 1))} aria-label="Previous month"><Icon name="chevronLeft" /></button>
      <h3 style={{ margin: 0 }}>{t(MONTHS_LONG[mo])} {y}</h3>
      <button className="iconbtn" onClick={() => setCur(new Date(y, mo + 1, 1))} aria-label="Next month"><Icon name="chevronRight" /></button>
    </div>
    <div className="small muted" style={{ textAlign: 'center' }}>{monthWs.length ? `${t(monthWs.length === 1 ? '{0} workout' : '{0} workouts', monthWs.length)} · ${fmtDur(monthMs)} · ${fmtVol(monthVol, st.unit)}` : t('No workouts this month')}</div>
    <div className="cal-grid">{['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(l => <div key={l} className="cal-h">{t(l)}</div>)}{cells}</div>
    <div className="cal-legend">
      <span><i style={{ background: 'var(--acc)' }} />{t('Trained')}</span>
      <span><i style={{ background: 'var(--label-3)' }} />{t('Planned')}</span>
      <span><i style={{ background: 'var(--orange)' }} />{t('Rescheduled')}</span>
    </div>
    <div className="small dim" style={{ textAlign: 'center', marginTop: 10 }}>{t('Tap a trained day for details · tap any other day to plan a session')}</div>
  </>
}
export const calendarSheet = start => ui().openSheet(close => <Calendar start={start} close={close} />)

/* shared small workout row (used in lists) */
export function WorkoutRow({ w, onClick }) {
  const st = useStore(s => s.S)
  const glyph = glyphOf((st.routines.find(r => r.id === w.routineId) || {}).emoji)
  return <div className="item" onClick={onClick}>
    <span className="lrow-i" style={{ width: 34, height: 34, borderRadius: 8, fontSize: 19 }}><Icon name={glyph} /></span>
    <div className="grow"><div className="tt">{w.name}</div>
      <div className="ss">{[fmtDate(w.d, true), ...durPart(w.end - w.start), t('{0} sets', setsDone(w)), fmtVol(workoutVolume(w, st.unit), st.unit)].join(' · ')}</div></div>
    {w.prs && w.prs.length > 0 && <span className="pr"><Icon name="trophy" />{w.prs.length} PR</span>}
    <Icon name="chevronRight" className="chev" />
  </div>
}

/* ============================ active-workout rest settings ============================ */
function RestSettings({ close }) {
  const st = useStore(s => s.S)
  const active = st.active
  if (!active) return <div className="empty">{t('No active workout')}</div>
  const routine = st.routines.find(r => r.id === active.routineId) || {}
  const phases = [
    { key: 'warmup', field: 'warmupRestSec', label: t('Warm-up') },
    { key: 'work', field: 'workRestSec', label: t('Work') }
  ].filter(phase => active.entries.some(e => e.sets.some(s => normalizePhase(s.phase, 'work') === phase.key)))
  const phaseValue = phase => {
    const entry = active.entries.find(e => e.sets.some(s => normalizePhase(s.phase, 'work') === phase.key))
    return entry?.target?.[phase.field] ?? routine[phase.field] ?? st.restSec
  }
  const setPhase = (phase, value) => update(s => {
    const n = Number(value)
    const seconds = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
    s.active.entries.forEach(e => {
      if (!e.sets.some(set => normalizePhase(set.phase, 'work') === phase.key)) return
      e.target = { ...(e.target || {}), [phase.field]: seconds }
    })
  })
  const resetPhase = phase => update(s => {
    s.active.entries.forEach(e => { if (e.target) delete e.target[phase.field] })
  })
  const setOverride = (entryIdx, setIdx, value) => update(s => {
    const n = Number(value)
    s.active.entries[entryIdx].sets[setIdx].restSec = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
  })
  const resetOverride = (entryIdx, setIdx) => update(s => { delete s.active.entries[entryIdx].sets[setIdx].restSec })
  return <>
    <h3>{t('Rest settings')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Set phase defaults for this workout, or override an individual set. Changes apply immediately.')}</div>
    <h4 className="sec">{t('Phase defaults')}</h4>
    <div className="list" style={{ marginBottom: 16 }}>
      {phases.map(phase => {
        const inherited = !active.entries.some(e => e.target?.[phase.field] != null)
        return <div key={phase.key} className="item" style={{ alignItems: 'flex-end' }}>
          <div className="grow"><div className="tt">{phase.label}</div><div className="ss">{inherited ? t('Inherited from routine or global setting') : t('Active workout override')}</div></div>
          <Stepper label={t('Seconds')} value={phaseValue(phase)} step={15} decimal={false} onChange={v => setPhase(phase, v)} />
          {!inherited && <Button size="sm" icon="reset" onClick={() => resetPhase(phase)} aria-label={t('Reset')} />}
        </div>
      })}
    </div>
    <h4 className="sec">{t('Individual sets')}</h4>
    <div className="list">
      {active.entries.map((entry, entryIdx) => <div key={entryIdx} className="card" style={{ margin: 0 }}>
        <div className="tt capitalize" style={{ marginBottom: 8 }}>{exOr(entry.id).n}</div>
        {entry.sets.map((set, setIdx) => {
          const phase = normalizePhase(set.phase, 'work')
          const resolved = restSecondsFor(set, entry.target || {}, routine, st.restSec)
          return <div key={setIdx} className="row between" style={{ padding: '7px 0', borderTop: setIdx ? '1px solid var(--sep)' : 0, alignItems: 'flex-end', gap: 8 }}>
            <div className="grow"><div className="tt" style={{ fontSize: 14 }}>{t('Set {0}', setIdx + 1)} · {t(phase === 'warmup' ? 'Warm-up' : 'Work')}</div><div className="ss">{set.restSec != null ? t('Set override') : t('Inherited: {0}s', resolved)}</div></div>
            <Stepper label={t('Seconds')} value={set.restSec ?? resolved} step={15} decimal={false} onChange={v => setOverride(entryIdx, setIdx, v)} />
            {set.restSec != null && <Button size="sm" icon="reset" onClick={() => resetOverride(entryIdx, setIdx)} aria-label={t('Reset')} />}
          </div>
        })}
      </div>)}
    </div>
    <div style={{ height: 12 }} /><Button variant="ghost" className="dim" onClick={close}>{t('Done')}</Button>
  </>
}
export const restSettingsSheet = () => ui().openSheet(close => <RestSettings close={close} />)

/* ============================ workout lifecycle ============================ */
export function startFlow(routineId) {
  bwSheet({ required: true, onDone: bw => beginWorkout(routineId, bw) })
}
export function discardWorkout() {
  if (!S().active) return false
  useUI.getState().stopTimers()
  update(s => { s.active = null })
  nav('/home')
  return true
}
export function beginWorkout(routineId, bw) {
  const st = S()
  if (st.active) return
  const sourceUnit = normalizeWeightUnit(st.unit) || 'kg'
  const sourceState = { ...st, unit: sourceUnit }
  useUI.getState().stopTimers()
  const r = routineId ? st.routines.find(x => x.id === routineId) : null
  // right weight already on the screen instead of being told about it afterwards.
  // `plan` is
  // kept on the entry purely so the workout can explain the number it chose.
  const entries = (r ? r.ex : []).map(cfg => {
    const phaseConfig = { ...cfg, ...(r?.phases ? { phases: r.phases } : {}) }
    const hasWork = hasSelectedWorkPhase(phaseConfig)
    const previous = lastEntryFor(sourceState, cfg.id)
    const increment = cfg.inc > 0 ? cfg.inc : defaultIncrement(cfg.id, sourceUnit)
    const resolvedWeight = hasWork ? resolveTargetLoad(cfg, previous || [], increment) : 0
    const percentage = hasWork && cfg.weightPrescription?.kind === 'percentage'
    const resolved = percentage ? { ...cfg, weight: resolvedWeight, resolvedWeight } : { ...cfg }
    const plan = hasWork ? nextPrescription(sourceState, resolved, r) : { policy: 'off', kind: 'off' }
    const sessionCfg = sessionConfigFor({ ...resolved, ...(r?.phases ? { phases: r.phases } : {}) }, plan)
    const workSets = hasWork ? applyPrescription(buildSets(sourceState, sessionCfg), sessionPlanFor(resolved, plan)) : []
    return { id: cfg.id, sg: cfg.sg, target: { ...sessionCfg, unit: sourceUnit }, plan, sets: prependWarmupSets(sessionCfg, workSets, previous || [], increment) }
  })
  update(s => {
    s.active = { id: uid(), d: todayISO(), start: Date.now(), routineId, name: r ? r.name : t('Freestyle'), bw: bw || null, cur: 0, unit: sourceUnit, sourceUnit, entries }
  })
  nav('/workout')
}
function TopWeight({ entryIdx, close }) {
  const st = useStore(s => s.S)
  const A = st.active
  const activeUnit = A?.unit || A?.sourceUnit || st.unit
  // The workout can end underneath this sheet: finishing from the last exercise clears
  // `active`, and this re-renders before the sheet is torn down. Everything below is
  // read defensively and the sheet dismisses itself — reading A.entries straight took
  // the whole app down with it. Hooks still run unconditionally, so the bail-out has
  // to sit after every one of them.
  const entry = A ? A.entries[entryIdx] : null
  const ex = entry && EXIDX[entry.id]
  const canConfirm = !!entry && shouldConfirmWorkingWeight(entry, 'reps')
  const repsWorkRows = entry ? workRowsForMode(entry, 'reps').filter(s => s.done) : []
  const maxSet = S().fullSetsDefault === false
    ? Math.max(0, ...repsWorkRows.map(s => s.w || 0))
    : bestFullSetWeight(entry, entry?.target)
  const prevBest = entry ? Math.max(cachedWeightFor(st.exWeights?.[entry.id], activeUnit), bestWeightFor({ ...st, unit: activeUnit }, entry.id)) : 0
  const [v, setV] = useState(entry ? (Math.max(maxSet, prevBest) || entry.target.weight || 0) : 0)
  useEffect(() => { if (!entry || !canConfirm) close() }, [!entry, canConfirm])

  const units = supersetUnits(A ? A.entries : [])
  const unit = entry ? unitOf(units, entryIdx) : []
  const unitDone = !!entry && unit.every(i => A.entries[i].sets.every(s => s.done))
  const unitIdx = units.findIndex(u => u === unit)
  const isLastUnit = unitIdx === units.length - 1
  if (!entry || !ex || !canConfirm) return null

  const commit = advance => {
    const n = Math.round((v || 0) * 10) / 10
    if (!isFinite(n) || n < 0) { toast(t('Enter a valid weight')); return }
    update(s => {
      s.active.entries[entryIdx].topW = n
      const unit = s.active?.unit || s.active?.sourceUnit || activeUnit
      if (workRowsForMode(entry, 'reps').some(s => s.done)) {
        const cur = cachedWeightFor(s.exWeights?.[entry.id], unit)
        const cache = weightCacheEntry(Math.max(n, cur), todayISO(), unit)
        if (cache) s.exWeights[entry.id] = cache
      }
    })
    close()
    if (advance && unitDone) {
      if (isLastUnit) workoutCompleteSheet()               // whole workout done → finish/continue prompt
      else update(s => { s.active.cur = units[unitIdx + 1][0] })
    } else toast(t('Tracked — next time starts at {0}', fmtNum(cachedWeightFor(S().exWeights?.[entry.id], activeUnit)) + ' ' + activeUnit))
  }
  return <>
    <h3 className="capitalize row" style={{ gap: 8 }}><Icon name="checkCircle" style={{ color: 'var(--acc)' }} />{t('{0} done', ex.n)}</h3>
    <div className="muted small">{t('Confirm the weight you worked with — your highest becomes the default next time.')}{!unitDone && unit.length > 1 ? ' ' + t('Then finish the superset partner.') : ''}</div>
    <WeightInput value={v} setValue={setV} unit={activeUnit} />
    <div style={{ height: 10 }} />
    {prevBest > 0 ? <div className="small dim" style={{ textAlign: 'center', marginBottom: 12 }}>{t('Previous best:')} {fmtNum(prevBest)} {activeUnit}{maxSet > prevBest && <span style={{ color: 'var(--yellow)' }}> — {t('new record!')}</span>}</div> : <div style={{ height: 4 }} />}
    {unitDone ? <>
      <Button variant="primary" trailingIcon={isLastUnit ? null : 'chevronRight'} onClick={() => commit(true)}>{isLastUnit ? t('Save') : t('Save & next exercise')}</Button>
      <div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={() => commit(false)}>{t('Just close')}</Button>
    </> : <Button variant="primary" onClick={() => commit(false)}>{t('Save weight')}</Button>}
  </>
}
export const topWeightSheet = entryIdx => ui().openSheet(close => <TopWeight entryIdx={entryIdx} close={close} />)

// End-of-exercise summary disabled: confirm the working weight automatically (heaviest
// done set, else previous best, else the target) and advance exactly like TopWeight's
// "Save & next exercise" would - so the weight cache still updates without the popup.
export function autoConfirmTopWeight(entryIdx) {
  const st = useStore.getState().S
  const A = st.active
  if (!A) return
  const activeUnit = A.unit || A.sourceUnit || st.unit
  const entry = A.entries[entryIdx]
  if (!entry) return
  const units = supersetUnits(A.entries)
  const unit = unitOf(units, entryIdx)
  const unitDone = unit.every(i => A.entries[i].sets.every(x => x.done))
  const unitIdx = units.findIndex(u => u === unit)
  const isLastUnit = unitIdx === units.length - 1
  const repsWorkRows = workRowsForMode(entry, 'reps').filter(x => x.done)
  const maxSet = st.fullSetsDefault === false
    ? Math.max(0, ...repsWorkRows.map(x => x.w || 0))
    : bestFullSetWeight(entry, entry?.target)
  const prevBest = Math.max(cachedWeightFor(st.exWeights?.[entry.id], activeUnit), bestWeightFor({ ...st, unit: activeUnit }, entry.id))
  const n = Math.round((Math.max(maxSet, prevBest) || entry.target.weight || 0) * 10) / 10
  update(s => {
    s.active.entries[entryIdx].topW = n
    if (workRowsForMode(entry, 'reps').some(x => x.done)) {
      const cur = cachedWeightFor(s.exWeights?.[entry.id], activeUnit)
      const cache = weightCacheEntry(Math.max(n, cur), todayISO(), activeUnit)
      if (cache) s.exWeights[entry.id] = cache
    }
  })
  if (isLastUnit) workoutCompleteSheet()
  else update(s => { s.active.cur = units[unitIdx + 1][0] })
}

// Shown when the last exercise's last set is checked — finish, or keep going.
function WorkoutComplete({ close }) {
  return <div style={{ textAlign: 'center', padding: '8px 0' }}>
    <div style={{ fontSize: 44, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="checkCircle" /></div>
    <h3 style={{ margin: '8px 0' }}>{t("That's the whole workout!")}</h3>
    <div className="muted small" style={{ marginBottom: 16 }}>{t('Every exercise done — great work. Finish up, or keep going and add another exercise.')}</div>
    <Button variant="primary" icon="flag" onClick={() => { close(); finishWorkout() }}>{t('Finish workout')}</Button>
    <div style={{ height: 8 }} />
    <Button onClick={() => { close(); useUI.getState().toast(t('Keep going — tap “+ Add exercise” below')) }}>{t('Continue workout')}</Button>
  </div>
}
export const workoutCompleteSheet = () => ui().openSheet(close => <WorkoutComplete close={close} />, { kind: 'center' })

function FinishSummary({ w, prs, e1prs = [], close }) {
  const st = useStore(s => s.S)
  const unit = normalizeWeightUnit(w.unit) || st.unit
  const phaseVol = volumeByPhase(w, unit)
  const phaseSets = setsByPhase(w, unit)
  const amraps = w.entries.map(e => ({ entry: e, result: amrapResultFor(e) })).filter(x => x.result)
  return <div style={{ textAlign: 'center', padding: '8px 0' }}>
    <div style={{ fontSize: 44, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="trophy" /></div>
    <h3 style={{ margin: '8px 0' }}>{t('Workout complete!')}</h3>
    <div className="tiles" style={{ textAlign: 'left' }}>
      <div className="tile"><div className="l">{t('Duration')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{fmtDur(w.end - w.start)}</div></div>
      <div className="tile"><div className="l">{t('Volume')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{fmtVol(workoutVolume(w, unit), unit)}</div></div>
      <div className="tile"><div className="l">{t('Sets')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{setsDone(w)}</div></div>
      <div className="tile"><div className="l">{t('PRs')}</div><div className="v" style={{ fontSize: 20 }}>{prs.length || '—'}</div></div>
    </div>
    <div className="small dim" style={{ textAlign: 'left', margin: '10px 0 14px' }}>
      {t('Warm-up')}: {phaseSets.warmup} {t('sets')} · {fmtVol(phaseVol.warmup, unit)} &nbsp;|&nbsp; {t('Work')}: {phaseSets.work} {t('sets')} · {fmtVol(phaseVol.work, unit)}
    </div>
    {amraps.length > 0 && <div style={{ textAlign: 'left', marginBottom: 12 }}>
      <h4 className="sec" style={{ marginBottom: 6 }}>{t('AMRAP')}</h4>
      {amraps.map(({ entry, result }) => {
        const ex = EXIDX[entry.id]
        const actual = result.mode === 'time' ? fmtSec(result.actual) : fmtNum(result.actual)
        const unit = result.mode === 'time' ? t('Seconds') : t('Reps')
        return <div key={entry.id} className="small accent row" style={{ gap: 5 }}>
          <Icon name="arrowUp" style={{ fontSize: 13 }} />{ex ? ex.n : (entry.n || entry.id)} · {actual} {unit}{result.target ? ' · ≥ ' + result.target + ' ' + unit : ''}
        </div>
      })}
    </div>}
    {(prs.length > 0 || e1prs.length > 0) && <div style={{ textAlign: 'left', marginBottom: 12 }}>
      {prs.map(id => <div key={id} className="small accent capitalize row" style={{ gap: 5 }}><Icon name="trophy" style={{ fontSize: 13 }} />{t('New PR:')} {(EXIDX[id] || {}).n || id}</div>)}
      {e1prs.map(p => <div key={p.id} className="small accent capitalize row" style={{ gap: 5 }}><Icon name="chartLine" style={{ fontSize: 13 }} />{t('Best estimated 1RM:')} {(EXIDX[p.id] || {}).n || p.id} · {fmtNum(p.est)} {unit}</div>)}
    </div>}
    <h4 className="sec" style={{ textAlign: 'left' }}>{t('What you just trained')}</h4>
    <BodyMap load={loadOfWorkouts([w])} body={st.body} />
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={() => { close(); nav('/home') }}>{t('Nice!')}</Button>
  </div>
}
export function finishWorkout() {
  const A = S().active
  if (!A) return
  const done = setsDoneActive(A)
  const total = A.entries.reduce((n, e) => n + e.sets.length, 0)
  if (!done) { confirmSheet({ title: t('Nothing logged yet'), message: t('You haven’t checked off any sets. Finish the workout anyway?'), confirmText: t('Finish anyway'), onConfirm: doFinishWorkout }); return }
  if (done < total) { confirmSheet({ title: t('Finish early?'), message: t(total - done === 1 ? '{0} set still unchecked. Finish the workout now?' : '{0} sets still unchecked. Finish the workout now?', total - done), confirmText: t('Finish workout'), onConfirm: doFinishWorkout }); return }
  doFinishWorkout()
}
function doFinishWorkout() {
  const st = S()
  const A = st.active
  if (!A) return
  const workoutUnit = normalizeWeightUnit(A.unit ?? A.sourceUnit)
  const historyState = workoutUnit ? { ...st, unit: workoutUnit } : null
  useUI.getState().stopTimers()
  const prs = []
  const e1prs = []
  A.entries.forEach(e => {
    const repsWorkRows = workRowsForMode(e, 'reps').filter(s => s.done)
    const mx = Math.max(0, ...repsWorkRows.map(s => s.w || 0))
    if (mx > 0 && historyState && mx > bestWeightFor(historyState, e.id)) prs.push(e.id)
    // A heavier estimate without a heavier top set is its own kind of progress —
    // same weight for more reps. Reported separately so it can't be read as a load PR.
    const completionEntry = historyState
      ? stampCompletedWorkout({ entries: [e] }, workoutUnit).entries[0]
      : null
    const rec = historyState ? is1RMRecord(historyState, e.id, completionEntry) : null
    if (rec && !prs.includes(e.id)) e1prs.push({ id: e.id, ...rec })
  })
  const w = stampCompletedWorkout({
    id: A.id, d: A.d, start: A.start, end: Date.now(), routineId: A.routineId, name: A.name, bw: A.bw,
    // `target` (what the session prescribed) is kept alongside the sets: without it a
    // finished workout cannot say whether it hit its reps, and a timed session reads back
    // as "0 reps". It is what the progression engine works from.
    entries: A.entries.map(e => ({
      id: e.id,
      ...exerciseMuscleSnapshot(exOr(e.id)),
      sets: e.sets,
      topW: e.topW || null,
      target: e.target || null
    })).filter(e => e.sets.some(s => s.done)),
    prs
  }, workoutUnit)
  w.vol = workoutUnit ? workoutVolume(w, workoutUnit) : 0
  update(s => {
    w.entries.forEach(e => {
      const repsWorkRows = workRowsForMode(e, 'reps').filter(s => s.done)
      const mx = Math.max(0, ...repsWorkRows.map(x => x.w || 0))
      if (workoutUnit && repsWorkRows.length > 0 && mx > 0) {
        const cur = cachedWeightFor(s.exWeights?.[e.id], workoutUnit)
        if (mx > cur) {
          const cache = weightCacheEntry(mx, w.d, workoutUnit)
          if (cache) s.exWeights[e.id] = cache
        }
      }
    })
    s.workouts.push(w)
    s.active = null
  })
  beep(snd(), 880, 0.15); beep(snd(), 1100, 0.15, 0.18); beep(snd(), 1320, 0.3, 0.36)
  ui().openSheet(close => <FinishSummary w={w} prs={prs} e1prs={e1prs} close={close} />, { kind: 'center', locked: true })
}
