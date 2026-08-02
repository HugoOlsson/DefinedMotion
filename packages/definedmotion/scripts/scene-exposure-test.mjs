import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = join(packageRoot, 'src/runtime')
const temporaryDirectory = await mkdtemp(join(packageRoot, '.scene-exposure-test-'))

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
  await writeFile(
    join(temporaryDirectory, 'sceneErrors.mjs'),
    await transpile(join(sourceRoot, 'scene/sceneErrors.ts'))
  )
  await writeFile(
    join(temporaryDirectory, 'sceneExposure.mjs'),
    (await transpile(join(sourceRoot, 'scene/sceneExposure.ts'))).replace(
      './sceneErrors',
      './sceneErrors.mjs'
    )
  )

  const { normalizeExposedMetadata } = await import(
    pathToFileURL(join(temporaryDirectory, 'sceneExposure.mjs')).href
  )

  // EXPOSE-01: runtime validation accepts only finite flat primitive data.
  assert.deepEqual(
    normalizeExposedMetadata(
      { data: { label: 'result', count: 4, active: true, optional: null } },
      'valid'
    ).data,
    { label: 'result', count: 4, active: true, optional: null }
  )
  assert.throws(
    () => normalizeExposedMetadata({ data: { parts: ['weight', 'odd'] } }, 'array'),
    /finite JSON primitive values/
  )
  assert.throws(
    () => normalizeExposedMetadata({ data: { nested: { role: 'result' } } }, 'nested'),
    /finite JSON primitive values/
  )
  assert.throws(
    () => normalizeExposedMetadata({ data: { invalid: Number.NaN } }, 'nan'),
    /finite JSON primitive values/
  )

  // EXPOSE-02: public TypeScript metadata rejects arrays and nested objects before runtime.
  const typeFixture = join(temporaryDirectory, 'metadata-contract.ts')
  await writeFile(
    typeFixture,
    `import type { ExposedObjectMetadata } from '../src/runtime/scene/sceneExposure'\n` +
      `const valid: ExposedObjectMetadata = {\n` +
      `  tags: ['weight', 'odd'],\n` +
      `  data: { label: 'formula', count: 2, active: true, optional: null }\n` +
      `}\n` +
      `// @ts-expect-error arrays belong in tags, not exposed data\n` +
      `const arrayData: ExposedObjectMetadata = { data: { parts: ['weight', 'odd'] } }\n` +
      `// @ts-expect-error exposed data is deliberately flat\n` +
      `const nestedData: ExposedObjectMetadata = { data: { formula: { role: 'result' } } }\n` +
      `void valid\nvoid arrayData\nvoid nestedData\n`
  )
  const program = ts.createProgram([typeFixture], {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.equal(
    diagnostics.length,
    0,
    diagnostics
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
      .join('\n')
  )

  console.log('scene exposure metadata tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
