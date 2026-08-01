import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as THREE from 'three'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = join(packageRoot, 'src/runtime/visuals')
const temporaryDirectory = await mkdtemp(join(packageRoot, '.layout-test-'))

const transpile = async (inputPath, replacements = []) => {
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
  return replacements.reduce((output, [from, to]) => output.replaceAll(from, to), result.outputText)
}

const visual = (minX, minY, maxX, maxY) => {
  const root = new THREE.Group()
  let bounds = new THREE.Box2(new THREE.Vector2(minX, minY), new THREE.Vector2(maxX, maxY))
  root.getLocalBounds = () => bounds.clone()
  root.setTestBounds = (next) => {
    bounds = next.clone()
    root.userData.boundsVersion = (root.userData.boundsVersion ?? 0) + 1
  }
  return root
}

const roundedBounds = (value) => [value.min.x, value.min.y, value.max.x, value.max.y]

try {
  const visualsDirectory = join(temporaryDirectory, 'visuals')
  await mkdir(visualsDirectory)
  await writeFile(
    join(visualsDirectory, 'measurement.mjs'),
    await transpile(join(sourceRoot, 'measurement.ts'))
  )
  await writeFile(
    join(visualsDirectory, 'layout.mjs'),
    await transpile(join(sourceRoot, 'layout.ts'), [["'./measurement'", "'./measurement.mjs'"]])
  )
  const { layout, resetSceneLayouts, resolveSceneLayouts } = await import(
    pathToFileURL(join(visualsDirectory, 'layout.mjs')).href
  )

  // LAYOUT-01/02: automatic row size, padding, gap, anchors, and slot ownership.
  {
    const first = visual(-1, -1, 1, 1)
    first.position.set(7, 0, 3)
    const second = visual(0, -4, 4, 0)
    const row = layout.flex(
      {
        flexDirection: 'row',
        gap: 2,
        padding: 1,
        anchorX: 'left',
        anchorY: 'top'
      },
      [first, second]
    )
    assert.deepEqual(roundedBounds(row.getLocalBounds()), [0, -6, 10, 0])
    assert.deepEqual(first.parent.position.toArray(), [2, -2, 0])
    assert.deepEqual(second.parent.position.toArray(), [5, -1, 0])
    assert.deepEqual(first.position.toArray(), [7, 0, 3])
  }

  // LAYOUT-03: explicit main-axis space uses CSS-style justification.
  {
    const first = visual(0, 0, 2, 2)
    const second = visual(0, 0, 2, 2)
    const row = layout.flex(
      {
        flexDirection: 'row',
        width: 20,
        height: 6,
        padding: 1,
        gap: 2,
        justifyContent: 'space-between',
        alignItems: 'center',
        anchorX: 'left',
        anchorY: 'top'
      },
      [first, second]
    )
    assert.deepEqual(roundedBounds(row.getLocalBounds()), [0, -6, 20, 0])
    assert.deepEqual(first.parent.position.toArray(), [1, -4, 0])
    assert.deepEqual(second.parent.position.toArray(), [17, -4, 0])
  }

  // LAYOUT-04: grids derive independent column and row tracks.
  {
    const items = [
      visual(0, -2, 2, 0),
      visual(0, -4, 5, 0),
      visual(0, -3, 4, 0),
      visual(0, -1, 1, 0)
    ]
    const grid = layout.grid(
      {
        columns: 2,
        columnGap: 3,
        rowGap: 2,
        padding: 1,
        justifyItems: 'center',
        alignItems: 'center',
        anchorX: 'left',
        anchorY: 'top'
      },
      items
    )
    assert.deepEqual(roundedBounds(grid.getLocalBounds()), [0, -11, 14, 0])
    assert.deepEqual(items[0].parent.position.toArray(), [2, -2, 0])
    assert.deepEqual(items[3].parent.position.toArray(), [10, -8, 0])
  }

  // LAYOUT-05/06: append is synchronous and invalidation propagates through nesting.
  {
    const inner = layout.flex(
      { flexDirection: 'column', gap: 1, anchorX: 'left', anchorY: 'top' },
      []
    )
    const outer = layout.flex(
      { flexDirection: 'row', padding: 2, anchorX: 'left', anchorY: 'top' },
      [inner]
    )
    assert.deepEqual(roundedBounds(outer.getLocalBounds()), [0, -4, 4, 0])
    const item = visual(0, -3, 8, 0)
    inner.append(item)
    assert.deepEqual(roundedBounds(inner.getLocalBounds()), [0, -3, 8, 0])
    assert.deepEqual(roundedBounds(outer.getLocalBounds()), [0, -7, 12, 0])

    item.setTestBounds(new THREE.Box2(new THREE.Vector2(0, -5), new THREE.Vector2(10, 0)))
    const scene = new THREE.Scene()
    scene.add(outer)
    resolveSceneLayouts(scene)
    assert.deepEqual(roundedBounds(outer.getLocalBounds()), [0, -9, 14, 0])
    assert.throws(() => inner.append(item), /more than once/)
    assert.throws(() => layout.flex({ flexDirection: 'row' }, [item]), /unparented/)
  }

  // LAYOUT-07: explicit boxes remain fixed while oversized children visibly overflow.
  {
    const item = visual(0, -8, 20, 0)
    const fixed = layout.flex(
      {
        flexDirection: 'row',
        width: 6,
        height: 4,
        padding: 5,
        anchorX: 'center',
        anchorY: 'middle'
      },
      [item]
    )
    assert.deepEqual(roundedBounds(fixed.getLocalBounds()), [-3, -2, 3, 2])
    assert.equal(item.parent.position.x, 2)
  }

  // LAYOUT-08: reset restores initial membership and detaches runtime appends.
  {
    const initial = visual(0, -2, 4, 0)
    const appended = visual(0, -3, 8, 0)
    const list = layout.flex(
      { flexDirection: 'column', gap: 1, anchorX: 'left', anchorY: 'top' },
      [initial]
    )
    const scene = new THREE.Scene()
    scene.add(list)
    list.append(appended)
    assert.deepEqual(list.items, [initial, appended])

    resetSceneLayouts(scene)

    assert.deepEqual(list.items, [initial])
    assert.equal(appended.parent, null)
    assert.deepEqual(roundedBounds(list.getLocalBounds()), [0, -2, 4, 0])
    assert.doesNotThrow(() => list.append(appended))
  }

  console.log('primitive layout tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
