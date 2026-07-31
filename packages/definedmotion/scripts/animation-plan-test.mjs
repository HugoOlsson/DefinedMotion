import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = join(packageRoot, 'src/runtime')
const temporaryDirectory = await mkdtemp(join(packageRoot, '.animation-plan-test-'))

const transpile = async (inputPath) => {
  const source = await readFile(inputPath, 'utf8')
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler
    },
    fileName: inputPath,
    reportDiagnostics: true
  })
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  )
  assert.equal(errors.length, 0, errors.map((error) => error.messageText).join('\n'))
  return result.outputText
}

const compileModules = async () => {
  const animationDirectory = join(temporaryDirectory, 'animation')
  const sceneDirectory = join(temporaryDirectory, 'scene')
  await mkdir(animationDirectory)
  await mkdir(sceneDirectory)

  await writeFile(
    join(sceneDirectory, 'sceneErrors.mjs'),
    await transpile(join(sourceRoot, 'scene/sceneErrors.ts'))
  )

  const planOutput = (await transpile(join(sourceRoot, 'animation/plan.ts'))).replace(
    '../scene/sceneErrors',
    '../scene/sceneErrors.mjs'
  )
  await writeFile(join(animationDirectory, 'plan.mjs'), planOutput)

  const timelineOutput = (await transpile(join(sourceRoot, 'animation/timeline.ts')))
    .replace('./plan', './plan.mjs')
    .replace('../scene/sceneErrors', '../scene/sceneErrors.mjs')
  await writeFile(join(animationDirectory, 'timeline.mjs'), timelineOutput)

  const [planModule, timelineModule, sceneErrorsModule] = await Promise.all([
    import(pathToFileURL(join(animationDirectory, 'plan.mjs')).href),
    import(pathToFileURL(join(animationDirectory, 'timeline.mjs')).href),
    import(pathToFileURL(join(sceneDirectory, 'sceneErrors.mjs')).href)
  ])
  return { ...planModule, ...timelineModule, ...sceneErrorsModule }
}

const approximately = (actual, expected, message) => {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `${message}: expected ${expected}, received ${actual}`
  )
}

try {
  const {
    AnimationTimeline,
    SceneRuntimeError,
    compileAnimationPlan,
    millisecondsToFrames,
    secondsToFrames
  } = await compileModules()

  // ANIM-08: seconds compile once to an end-exclusive integer frame range.
  assert.equal(secondsToFrames(0.6, 30), 18)
  assert.equal(millisecondsToFrames(600, 30), 18)
  const compiled = compileAnimationPlan(
    { duration: 0.6, bind: () => ({ update() {} }) },
    12,
    30
  )
  assert.deepEqual(
    {
      startFrame: compiled.startFrame,
      durationFrames: compiled.durationFrames,
      endFrame: compiled.endFrame
    },
    { startFrame: 12, durationFrames: 18, endFrame: 30 }
  )

  // ANIM-01 and ANIM-02: mutable endpoints are captured when the occurrence starts.
  {
    const timeline = new AnimationTimeline(3)
    let value = 0
    let target = 10
    const plan = {
      duration: 1,
      bind() {
        const from = value
        const to = target
        return {
          update({ easedProgress }) {
            value = from + (to - from) * easedProgress
          }
        }
      }
    }
    timeline.add(plan)
    value = 4
    target = 20
    await timeline.runFrame(0)
    assert.equal(value, 4)
    target = 30
    await timeline.runFrame(2)
    assert.equal(value, 20)
  }

  // ANIM-03 and ANIM-04: all same-frame plans bind before registration-ordered updates.
  {
    const timeline = new AnimationTimeline(2)
    const captures = []
    let value = 0
    const plan = (result) => ({
      duration: 1,
      bind() {
        captures.push(value)
        return { update: () => (value = result) }
      }
    })
    timeline.add(plan(1), plan(2))
    await timeline.runFrame(0)
    assert.deepEqual(captures, [0, 0])
    assert.equal(value, 2)
  }

  // ANIM-05: a one-frame plan receives only the exact final state.
  {
    const timeline = new AnimationTimeline(20)
    const updates = []
    timeline.add({
      duration: 0.05,
      easing: () => 500,
      bind: () => ({ update: (update) => updates.push(update) })
    })
    await timeline.runFrame(0)
    assert.deepEqual(updates, [
      {
        easedProgress: 1,
        linearProgress: 1,
        isFirstFrame: true,
        isLastFrame: true
      }
    ])
  }

  // ANIM-08: pointer restoration schedules overlaps without changing prior work or duration.
  {
    const timeline = new AnimationTimeline(10)
    const noop = (duration) => ({ duration, bind: () => ({ update() {} }) })
    timeline.add(noop(1))
    const resumeAt = timeline.getPointer()
    timeline.setPointer(0)
    timeline.add(noop(0.5))
    timeline.setPointer(resumeAt)
    timeline.add(noop(1))
    timeline.setPointer(100)
    assert.equal(timeline.getPointer(), 100)
    assert.equal(timeline.getEndFrame(), 20)
  }

  // ANIM-09: eased and linear progress remain distinct and endpoints stay exact.
  {
    const timeline = new AnimationTimeline(3)
    const updates = []
    timeline.add({
      duration: 1,
      easing: 'ease-in',
      bind: () => ({ update: (update) => updates.push(update) })
    })
    await timeline.runFrame(0)
    await timeline.runFrame(1)
    await timeline.runFrame(2)
    assert.equal(updates[0].easedProgress, 0)
    approximately(updates[1].linearProgress, 0.5, 'middle linear progress')
    approximately(updates[1].easedProgress, 0.25, 'middle eased progress')
    assert.equal(updates[2].easedProgress, 1)
  }

  // Reset discards bound occurrences and causes runtime state to be captured again.
  {
    const timeline = new AnimationTimeline(2)
    let binds = 0
    const plan = {
      duration: 1,
      bind() {
        binds++
        return { update() {} }
      }
    }
    timeline.add(plan)
    await timeline.runFrame(0)
    timeline.reset()
    timeline.add(plan)
    await timeline.runFrame(0)
    assert.equal(binds, 2)
  }

  // Legacy arrays remain schedulable during migration through the same timeline.
  {
    const timeline = new AnimationTimeline(30)
    const values = []
    timeline.add({
      interpolation: [2, 4],
      updater(value, frame, isLast) {
        values.push({ value, frame, isLast })
      }
    })
    await timeline.runFrame(0)
    await timeline.runFrame(1)
    assert.deepEqual(values, [
      { value: 2, frame: 0, isLast: false },
      { value: 4, frame: 1, isLast: true }
    ])
  }

  // ANIM-09: invalid plans fail with stable, actionable runtime codes.
  assert.throws(
    () => compileAnimationPlan({ duration: 0.001, bind: () => ({ update() {} }) }, 0, 30),
    (error) =>
      error instanceof SceneRuntimeError && error.code === 'ANIMATION_DURATION_BELOW_ONE_FRAME'
  )
  assert.throws(
    () =>
      compileAnimationPlan(
        { duration: 1, easing: 'ease-otu', bind: () => ({ update() {} }) },
        0,
        30
      ),
    (error) => error instanceof SceneRuntimeError && error.code === 'UNKNOWN_EASING'
  )

  await assert.rejects(
    async () => {
      const timeline = new AnimationTimeline(30)
      timeline.add({ duration: 1, bind: async () => ({ update() {} }) })
      await timeline.runFrame(0)
    },
    (error) => error instanceof SceneRuntimeError && error.code === 'ASYNC_ANIMATION_BIND'
  )

  await assert.rejects(
    async () => {
      const timeline = new AnimationTimeline(30)
      timeline.add({
        duration: 1,
        bind: () => ({ update: async () => {} })
      })
      await timeline.runFrame(0)
    },
    (error) => error instanceof SceneRuntimeError && error.code === 'ASYNC_ANIMATION_UPDATE'
  )

  await assert.rejects(
    async () => {
      const timeline = new AnimationTimeline(3)
      timeline.add({
        duration: 1,
        easing: () => Number.NaN,
        bind: () => ({ update() {} })
      })
      await timeline.runFrame(1)
    },
    (error) => error instanceof SceneRuntimeError && error.code === 'INVALID_EASING_RESULT'
  )

  process.stdout.write('Animation plan tests passed\n')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
