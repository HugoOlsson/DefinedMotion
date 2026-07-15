import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const schedulerSource = readFileSync(
  new URL('../src/runtime/rendering/interactiveViewportScheduler.ts', import.meta.url),
  'utf8'
)
const { outputText } = ts.transpileModule(schedulerSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
})
const schedulerModuleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
const { InteractiveViewportScheduler } = await import(schedulerModuleUrl)

class FakeAnimationFrames {
  nextHandle = 1
  callbacks = new Map()

  driver = {
    request: (callback) => {
      const handle = this.nextHandle++
      this.callbacks.set(handle, callback)
      return handle
    },
    cancel: (handle) => {
      this.callbacks.delete(handle)
    }
  }

  get pending() {
    return this.callbacks.size
  }

  flush(timestamp = 0) {
    const callbacks = [...this.callbacks.values()]
    this.callbacks.clear()
    for (const callback of callbacks) callback(timestamp)
  }
}

class FakeControls {
  enabled = true
  updateResults = []
  updateCount = 0
  changeListeners = new Set()

  addEventListener(type, listener) {
    assert.equal(type, 'change')
    this.changeListeners.add(listener)
  }

  removeEventListener(type, listener) {
    assert.equal(type, 'change')
    this.changeListeners.delete(listener)
  }

  update() {
    this.updateCount++
    const changed = this.updateResults.shift() ?? false
    if (changed) this.emitChange()
    return changed
  }

  emitChange() {
    for (const listener of this.changeListeners) listener({ type: 'change' })
  }
}

const createFixture = () => {
  const frames = new FakeAnimationFrames()
  const controls = new FakeControls()
  let renderCount = 0
  const scheduler = new InteractiveViewportScheduler(
    controls,
    () => renderCount++,
    frames.driver
  )
  return { frames, controls, scheduler, renderCount: () => renderCount }
}

{
  const fixture = createFixture()
  fixture.scheduler.resume()
  assert.equal(fixture.frames.pending, 0, 'an idle viewport must not request animation frames')
  assert.equal(fixture.renderCount(), 0)

  for (let index = 0; index < 10; index++) fixture.scheduler.invalidate()
  assert.equal(fixture.frames.pending, 1, 'invalidations must coalesce into one animation frame')
  fixture.frames.flush()
  assert.equal(fixture.renderCount(), 1)
  assert.equal(fixture.frames.pending, 0, 'a stable viewport must sleep after rendering')
}

{
  const fixture = createFixture()
  fixture.scheduler.resume()
  fixture.controls.updateResults.push(true, true, false)
  fixture.controls.emitChange()

  fixture.frames.flush()
  assert.equal(fixture.renderCount(), 1)
  assert.equal(fixture.frames.pending, 1, 'damping must keep the scheduler awake')

  fixture.frames.flush()
  assert.equal(fixture.renderCount(), 2)
  assert.equal(fixture.frames.pending, 1)

  fixture.frames.flush()
  assert.equal(fixture.renderCount(), 2, 'the settling probe must not redraw an unchanged frame')
  assert.equal(fixture.frames.pending, 0, 'the scheduler must sleep when damping settles')
}

{
  const fixture = createFixture()
  fixture.scheduler.resume()
  fixture.scheduler.invalidate()
  fixture.scheduler.suspend()
  assert.equal(fixture.controls.enabled, false)
  assert.equal(fixture.frames.pending, 0, 'suspending must cancel pending viewport work')
  fixture.frames.flush()
  assert.equal(fixture.renderCount(), 0)

  fixture.controls.emitChange()
  assert.equal(fixture.frames.pending, 0, 'controls changes cannot wake a suspended viewport')

  fixture.scheduler.resume(true)
  fixture.scheduler.resume(true)
  assert.equal(fixture.controls.enabled, true)
  assert.equal(fixture.frames.pending, 1, 'repeated resume calls cannot create duplicate loops')
  fixture.frames.flush()
  assert.equal(fixture.renderCount(), 1)
}

{
  const fixture = createFixture()
  fixture.scheduler.resume()
  fixture.scheduler.invalidate()
  assert.equal(fixture.controls.changeListeners.size, 1)
  fixture.scheduler.dispose()
  assert.equal(fixture.frames.pending, 0)
  assert.equal(fixture.controls.changeListeners.size, 0, 'dispose must remove the controls listener')
  fixture.controls.emitChange()
  fixture.scheduler.resume(true)
  assert.equal(fixture.frames.pending, 0, 'a disposed scheduler cannot restart')
}

process.stdout.write('Interactive viewport scheduler tests passed\n')
