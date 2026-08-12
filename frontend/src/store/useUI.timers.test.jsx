import { MemoryRouter } from 'react-router-dom'
import Workout from '../views/Workout.jsx'
import { beginWorkout, finishWorkout } from '../sheets.jsx'
  it("announces Time's up once without making the ticking overtime region live", () => {
    useUI.getState().startWork(1, 'Plank', vi.fn())
    vi.advanceTimersByTime(1000)

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => root.render(<RestTimer />))

    const timer = container.querySelector('#timer')
    const status = timer.querySelector('[role="status"]')
    expect(timer.hasAttribute('role')).toBe(false)
    expect(timer.hasAttribute('aria-live')).toBe(false)
    expect(timer.hasAttribute('aria-atomic')).toBe(false)
    expect(status.classList.contains('sr-only')).toBe(true)
    expect(status.textContent).toBe("Time's up!")
    act(() => vi.advanceTimersByTime(3000))
    expect(status.textContent).toBe("Time's up!")

    act(() => root.unmount())
    container.remove()
  })

  it('logs a displaced finished hold at its planned time before starting rest', () => {
    expect(useUI.getState().work).toBeNull()
    expect(useUI.getState().timer).toMatchObject({ left: 15, total: 15 })
    expect(logged).toHaveBeenCalledOnce()
    expect(logged).toHaveBeenCalledWith(1)
  })

  it('silently abandons a still-running hold when another timer displaces it', () => {
    const logged = vi.fn()
    useUI.getState().startWork(30, 'Hold', logged)

    useUI.getState().startRest(15)


  it('logs a displaced finished hold at its planned time before starting another hold', () => {
    const firstLogged = vi.fn()
    const secondLogged = vi.fn()
    useUI.getState().startWork(1, 'First hold', firstLogged)
    vi.advanceTimersByTime(1000)

    useUI.getState().startWork(30, 'Second hold', secondLogged)

    expect(firstLogged).toHaveBeenCalledOnce()
    expect(firstLogged).toHaveBeenCalledWith(1)
    expect(secondLogged).not.toHaveBeenCalled()
    expect(useUI.getState().work).toMatchObject({ left: 30, total: 30, label: 'Second hold' })
  })

  it('keeps the planned hold when checking a normal set starts rest', () => {
    const S = clone(DEF)
    S.active = {
      id: 'mixed-session', d: '2026-08-11', start: Date.now(), routineId: null,
      name: 'Mixed timer test', bw: null, cur: 0,
      entries: [
        { id: '3544', sg: 'pair-1', target: { mode: 'time', sec: 1, sets: 1 }, sets: [{ sec: 1, w: 0, done: false }] },
        { id: '1001', sg: 'pair-1', target: { mode: 'reps', reps: 1, sets: 1 }, sets: [{ w: 0, r: 1, done: false }] }
      ]
    }
    useStore.setState({ S })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => root.render(<MemoryRouter initialEntries={['/workout']}><Workout /></MemoryRouter>))
    act(() => container.querySelector('.setgo').click())
    act(() => vi.advanceTimersByTime(1000))
    expect(useUI.getState().work.done).toBe(true)

    const checks = container.querySelectorAll('[role="checkbox"]')
    act(() => checks[1].click())

    const active = useStore.getState().S.active
    expect(active.entries[0].sets[0]).toMatchObject({ sec: 1, done: true })
    expect(active.entries[1].sets[0].done).toBe(true)
    expect(useUI.getState().work).toBeNull()
    expect(useUI.getState().timer).toMatchObject({ left: DEF.restSec, total: DEF.restSec })

    act(() => root.unmount())
    container.remove()
  })

  it('stops work when starting a replacement session or replacing all state', () => {
    const S = clone(DEF)
    S.active = { id: 'old-session', entries: [] }
    useStore.setState({ S })
    const oldLogged = vi.fn()
    useUI.getState().startWork(1, 'Old hold', oldLogged)
    vi.advanceTimersByTime(1000)

    beginWorkout(null, null)

    expect(useStore.getState().S.active.id).not.toBe('old-session')
    expect(useUI.getState().work).toBeNull()
    expect(oldLogged).not.toHaveBeenCalled()

    const importedLogged = vi.fn()
    useUI.getState().startWork(1, 'Imported hold', importedLogged)
    vi.advanceTimersByTime(1000)
    useStore.getState().replaceState(clone(DEF))
    expect(useStore.getState().S.active).toBeNull()
    expect(useUI.getState().work).toBeNull()
    expect(importedLogged).not.toHaveBeenCalled()
  })

  it('stops work when sign-out clears the local session', async () => {
    const logged = vi.fn()
    useUI.getState().startWork(1, 'Signed-in hold', logged)
    vi.advanceTimersByTime(1000)

    await useStore.getState().signOut()

    expect(useStore.getState().S.active).toBeNull()
    expect(useUI.getState().work).toBeNull()
    expect(logged).not.toHaveBeenCalled()
  })

  it('stops work when the active workout is discarded', () => {
    const S = clone(DEF)
    S.active = {
      id: 'discarded-session', d: '2026-08-11', start: Date.now(), routineId: null,
      name: 'Discard timer test', bw: null, cur: 0,
      entries: [{ id: '3544', target: { mode: 'time', sec: 30, sets: 1 }, sets: [{ sec: 30, w: 0, done: false }] }]
    }
    useStore.setState({ S })
    const logged = vi.fn()
    useUI.getState().startWork(1, 'Discarded hold', logged)
    vi.advanceTimersByTime(1000)

    const workoutContainer = document.createElement('div')
    document.body.appendChild(workoutContainer)
    const workoutRoot = createRoot(workoutContainer)
    act(() => workoutRoot.render(<MemoryRouter initialEntries={['/workout']}><Workout /></MemoryRouter>))
    act(() => workoutContainer.querySelector('button[aria-label="Discard"]').click())

    const sheet = useUI.getState().sheets.at(-1)
    const dialogContainer = document.createElement('div')
    document.body.appendChild(dialogContainer)
    const dialogRoot = createRoot(dialogContainer)
    const close = () => useUI.getState().closeSheet(sheet.id)
    act(() => dialogRoot.render(sheet.render(close)))
    const confirm = [...dialogContainer.querySelectorAll('button')].find(button => button.textContent === 'Discard')
    act(() => confirm.click())

    expect(useStore.getState().S.active).toBeNull()
    expect(useUI.getState().work).toBeNull()
    expect(logged).not.toHaveBeenCalled()

    act(() => dialogRoot.unmount())
    act(() => workoutRoot.unmount())
    dialogContainer.remove()
    workoutContainer.remove()
  })

  it('refuses a timed-set callback after the active session changes', () => {
    const S = clone(DEF)
    S.active = {
      id: 'first-session', d: '2026-08-11', start: Date.now(), routineId: null,
      name: 'First session', bw: null, cur: 0,
      entries: [{ id: '3544', target: { mode: 'time', sec: 1, sets: 1 }, sets: [{ sec: 1, w: 0, done: false }] }]
    }
    useStore.setState({ S })

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => root.render(<MemoryRouter initialEntries={['/workout']}><Workout /></MemoryRouter>))
    act(() => container.querySelector('.setgo').click())

    const replacement = clone(useStore.getState().S)
    replacement.active = {
      id: 'second-session', d: '2026-08-11', start: Date.now(), routineId: null,
      name: 'Second session', bw: null, cur: 0,
      entries: [{ id: '3544', target: { mode: 'time', sec: 99, sets: 1 }, sets: [{ sec: 99, w: 0, done: false }] }]
    }
    act(() => useStore.setState({ S: replacement }))
    act(() => vi.advanceTimersByTime(1000))
    act(() => useUI.getState().logWorkPlanned())

    expect(useStore.getState().S.active.id).toBe('second-session')
    expect(useStore.getState().S.active.entries[0].sets[0]).toMatchObject({ sec: 99, done: false })

    act(() => root.unmount())
    container.remove()
  })
