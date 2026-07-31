import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = join(packageRoot, 'src/runtime')
const temporaryDirectory = await mkdtemp(join(packageRoot, '.timeline-beats-test-'))

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

  const beatsOutput = (await transpile(join(sourceRoot, 'animation/beats.ts')))
    .replace('./timeline', './timeline.mjs')
    .replace('../scene/sceneErrors', '../scene/sceneErrors.mjs')
  await writeFile(join(animationDirectory, 'beats.mjs'), beatsOutput)

  const [beatsModule, timelineModule, sceneErrorsModule] = await Promise.all([
    import(pathToFileURL(join(animationDirectory, 'beats.mjs')).href),
    import(pathToFileURL(join(animationDirectory, 'timeline.mjs')).href),
    import(pathToFileURL(join(sceneDirectory, 'sceneErrors.mjs')).href)
  ])
  return { ...beatsModule, ...timelineModule, ...sceneErrorsModule }
}

const expectCode = (operation, code) => {
  assert.throws(operation, (error) => error?.code === code)
}

try {
  const { AnimationTimeline, SceneTimeline } = await compileModules()
  const noop = (duration) => ({ duration, bind: () => ({ update() {} }) })

  // BEAT-01: all definitions are validated as non-overlapping end-exclusive ranges.
  {
    const runtime = new AnimationTimeline(10)
    const timeline = new SceneTimeline(runtime, 10, () => {})
    timeline.defineBeats({
      intro: { start: 0, end: 10 },
      action: { start: 12, end: 20 }
    })
    assert.equal(timeline.getDeclaredEndFrame(), 20)
    assert.equal(timeline.getBeatAtFrame(10), undefined)
    assert.equal(timeline.getBeatAtFrame(11), undefined)
    assert.equal(timeline.getBeatAtFrame(12)?.name, 'action')

    const overlapping = new SceneTimeline(new AnimationTimeline(10), 10, () => {})
    expectCode(
      () =>
        overlapping.defineBeats({
          first: { start: 0, end: 10 },
          second: { start: 9, end: 12 }
        }),
      'OVERLAPPING_BEATS'
    )
    const empty = new SceneTimeline(new AnimationTimeline(10), 10, () => {})
    expectCode(() => empty.defineBeats({}), 'EMPTY_BEAT_DEFINITIONS')
  }

  // BEAT-02: authoring order does not affect positions and the global pointer is restored.
  {
    const runtime = new AnimationTimeline(10)
    const timeline = new SceneTimeline(runtime, 10, () => {})
    timeline.defineBeats({ first: { start: 0, end: 10 }, second: { start: 10, end: 20 } })
    runtime.setPointer(4)
    timeline.beat('second', (beat) => {
      assert.equal(runtime.getPointer(), 10)
      assert.equal(beat.getLocalTimelinePointer(), 0)
      runtime.add(noop(0.5))
      assert.equal(beat.getLocalTimelinePointer(), 5)
    })
    timeline.beat('first', () => runtime.add(noop(0.5)))
    assert.equal(runtime.getPointer(), 4)
    assert.equal(runtime.getEndFrame(), 15)
  }

  // BEAT-03: pointer restoration also happens when authoring throws.
  {
    const runtime = new AnimationTimeline(10)
    const timeline = new SceneTimeline(runtime, 10, () => {})
    timeline.defineBeats({ only: { start: 5, end: 10 } })
    runtime.setPointer(2)
    assert.throws(() => timeline.beat('only', () => { throw new Error('stop') }), /stop/)
    assert.equal(runtime.getPointer(), 2)
  }

  // BEAT-04: nested and Promise-returning authoring callbacks are rejected.
  {
    const runtime = new AnimationTimeline(10)
    const timeline = new SceneTimeline(runtime, 10, () => {})
    timeline.defineBeats({ only: { start: 0, end: 10 } })
    expectCode(
      () => timeline.beat('only', () => timeline.beat('only', () => {})),
      'NESTED_BEAT_AUTHORING'
    )
    expectCode(() => timeline.beat('only', async () => {}), 'ASYNC_BEAT_AUTHORING')
  }

  // BEAT-05: work may exactly fill a beat but may not cross its end.
  {
    const runtime = new AnimationTimeline(10)
    const timeline = new SceneTimeline(runtime, 10, () => {})
    timeline.defineBeats({ only: { start: 5, end: 10 } })
    timeline.beat('only', () => runtime.add(noop(0.5)))
    expectCode(
      () => timeline.beat('only', () => runtime.add(noop(0.6))),
      'ANIMATION_OUTSIDE_BEAT'
    )
    expectCode(
      () => timeline.beat('only', () => runtime.setPointer(11)),
      'TIMELINE_POINTER_OUTSIDE_BEAT'
    )
  }

  // BEAT-06: tick coordinates have exact endpoints and use frame-derived time.
  {
    const dependencies = []
    const runtime = new AnimationTimeline(10)
    const timeline = new SceneTimeline(runtime, 10, (dependency) => {
      dependencies.push(dependency)
    })
    timeline.defineBeats({ multi: { start: 5, end: 8 }, single: { start: 10, end: 11 } })
    const multiTicks = []
    const singleTicks = []
    timeline.beat('multi', (beat) => beat.onEachTick((tick) => multiTicks.push(tick)))
    timeline.beat('single', (beat) => beat.onEachTick((tick) => singleTicks.push(tick)))
    for (let frame = 0; frame < 12; frame++) {
      for (const dependency of dependencies) await dependency(frame, frame * 100)
    }
    assert.deepEqual(multiTicks, [
      { localFrame: 0, globalFrame: 5, localTimeMs: 0, beatProgress: 0 },
      { localFrame: 1, globalFrame: 6, localTimeMs: 100, beatProgress: 0.5 },
      { localFrame: 2, globalFrame: 7, localTimeMs: 200, beatProgress: 1 }
    ])
    assert.deepEqual(singleTicks, [
      { localFrame: 0, globalFrame: 10, localTimeMs: 0, beatProgress: 1 }
    ])
  }

  // BEAT-07: frame inspection returns the same local coordinates as runtime ticks.
  {
    const timeline = new SceneTimeline(new AnimationTimeline(10), 10, () => {})
    timeline.defineBeats({ action: { start: 5, end: 8 } })
    assert.deepEqual(timeline.getBeatAtFrame(6), {
      name: 'action',
      startFrame: 5,
      endFrame: 8,
      localFrame: 1,
      beatProgress: 0.5
    })
    assert.equal(timeline.getBeatAtFrame(8), undefined)
  }

  console.log('timeline beats tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
