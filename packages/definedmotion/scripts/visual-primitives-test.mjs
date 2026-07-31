import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as THREE from 'three'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = join(packageRoot, 'src/runtime')
const temporaryDirectory = await mkdtemp(join(packageRoot, '.visual-primitives-test-'))

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

try {
  const visualsDirectory = join(temporaryDirectory, 'visuals')
  await mkdir(visualsDirectory)
  await writeFile(
    join(visualsDirectory, 'measurement.mjs'),
    await transpile(join(sourceRoot, 'visuals/measurement.ts'))
  )
  const { anchorOffset, getObjectLocalBounds } = await import(
    pathToFileURL(join(visualsDirectory, 'measurement.mjs')).href
  )

  // VISUAL-01: intrinsic bounds include descendants but ignore the root's authored transform.
  {
    const root = new THREE.Group()
    root.position.set(100, 200, 0)
    root.scale.setScalar(7)
    const child = new THREE.Mesh(new THREE.PlaneGeometry(4, 2))
    child.position.set(3, -1, 0)
    root.add(child)
    const bounds = getObjectLocalBounds(root)
    assert.deepEqual(
      bounds && [bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y],
      [1, -2, 5, 0]
    )
  }

  // VISUAL-02: nested child transforms are accumulated in root-local coordinates.
  {
    const root = new THREE.Group()
    const nested = new THREE.Group()
    nested.position.set(2, 3, 0)
    nested.scale.set(2, 3, 1)
    const child = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    nested.add(child)
    root.add(nested)
    const bounds = getObjectLocalBounds(root)
    assert.deepEqual(
      bounds && [bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y],
      [0, 0, 4, 6]
    )
  }

  // VISUAL-03: text and LaTeX share identical anchor offset semantics.
  {
    const bounds = new THREE.Box2(new THREE.Vector2(-2, -1), new THREE.Vector2(6, 3))
    assert.deepEqual(anchorOffset(bounds, 'left', 'top').toArray(), [2, -3])
    assert.deepEqual(anchorOffset(bounds, 'center', 'middle').toArray(), [-2, -1])
    assert.deepEqual(anchorOffset(bounds, 'right', 'bottom').toArray(), [-6, 1])
  }

  // Empty groups have no intrinsic visual bounds.
  assert.equal(getObjectLocalBounds(new THREE.Group()), null)

  console.log('visual primitive measurement tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
