import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(packageRoot, '..', '..')
const textExtensions = new Set(['.ts', '.js', '.mjs', '.svelte', '.md'])
const forbiddenIdentifiers = [
  'HotReloadSetting',
  'addDeferredAnims',
  'addSequentialBackgroundAnims',
  'insertAnimsAt',
  'addWait',
  'doAt',
  'UserAnimation',
  'DefinedAnimation',
  'createAnim',
  'createAnimNamed',
  'createFastText',
  'createMeshText',
  'createChars',
  'updateText',
  'millisToTicks',
  'moveRotateCameraAnimation3D',
  'moveCameraAnimation3D',
  'moveCameraToAnim',
  'rotateCameraToAnim',
  'flyCameraToAnim',
  'zoomCameraToAnim',
  'fadeInTowardsEnd'
]
const deletedFiles = [
  'src/runtime/animation/animations.ts',
  'src/runtime/animation/interpolations.ts',
  'src/runtime/animation/protocols.ts'
]

const collectFiles = async (path) => {
  const entries = await readdir(path, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.definedmotion') continue
    const child = resolve(path, entry.name)
    if (entry.isDirectory()) files.push(...(await collectFiles(child)))
    else if (textExtensions.has(extname(entry.name))) files.push(child)
  }
  return files
}

for (const relativePath of deletedFiles) {
  let exists = true
  try {
    await access(resolve(packageRoot, relativePath))
  } catch {
    exists = false
  }
  assert.equal(exists, false, `[DELETE-01] obsolete implementation remains: ${relativePath}`)
}

const roots = [
  resolve(packageRoot, 'src'),
  resolve(packageRoot, 'types'),
  resolve(packageRoot, 'documentation'),
  resolve(packageRoot, 'reference'),
  resolve(repositoryRoot, 'packages/create-definedmotion/template'),
  resolve(repositoryRoot, 'playground/src'),
  resolve(repositoryRoot, 'docs')
]
const files = (await Promise.all(roots.map(collectFiles))).flat()
const violations = []
for (const path of files) {
  const source = await readFile(path, 'utf8')
  for (const identifier of forbiddenIdentifiers) {
    const pattern = new RegExp(`\\b${identifier}\\b`)
    if (pattern.test(source)) {
      violations.push(`${path.slice(repositoryRoot.length + 1)}: ${identifier}`)
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `[DELETE-02] legacy identifiers remain in supported source, docs, or examples:\n${violations.join('\n')}`
)

const animationBarrel = await readFile(resolve(packageRoot, 'src/public/animation.ts'), 'utf8')
assert.match(animationBarrel, /cameraEffects/, '[DELETE-03] canonical camera namespace is not public')
assert.match(animationBarrel, /animation\/effects/, '[DELETE-03] canonical effects are not public')
assert.doesNotMatch(
  animationBarrel,
  /animation\/(animations|interpolations|protocols)/,
  '[DELETE-03] public animation barrel reaches a removed module'
)

console.log('legacy deletion contracts passed')
