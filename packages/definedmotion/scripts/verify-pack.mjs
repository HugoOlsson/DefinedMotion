import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

const packed = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  env: { ...process.env, npm_config_cache: join(tmpdir(), 'definedmotion-npm-cache') }
})
if (packed.status !== 0) throw new Error(packed.stderr || 'npm pack failed')

const result = JSON.parse(packed.stdout)[0]
const paths = result.files.map((file) => file.path)
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
if (manifest.bin?.definedmotion !== 'cli/index.mjs') {
  throw new Error('definedmotion package must publish the cli/index.mjs binary')
}
const forbidden = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)out\//,
  /^scripts\//,
  /(^|\/)\.DS_Store$/,
  /(^|\/)\.definedmotion\//,
  /(^|\/)(renders|rendered_videos|image_renders|audio_renders)\//
]
for (const file of paths) {
  if (forbidden.some((pattern) => pattern.test(file))) {
    throw new Error(`Forbidden path in definedmotion package: ${file}`)
  }
}

for (const required of [
  'AGENTS.md',
  'README.md',
  'cli/index.mjs',
  'src/public/index.ts',
  'types/public/index.d.ts',
  'types/public/rendering.d.ts',
  'assets/fonts/Montserrat-Medium.woff',
  'reference/INDEX.md',
  'reference/agent-workflow.md',
  'reference/catalog.json',
  'reference/examples/fourierSquareWave.scene.ts',
  'reference/tests/assets/test_asset_references.scene.ts'
]) {
  if (!paths.includes(required)) throw new Error(`Required package file is missing: ${required}`)
}

if (paths.includes('src/scenes/.gitkeep')) {
  throw new Error('Legacy framework scene placeholder must not be published')
}

const maximumUnpackedBytes = 150 * 1024 * 1024
if (result.unpackedSize > maximumUnpackedBytes) {
  throw new Error(`definedmotion unpacked size exceeds 150 MiB: ${result.unpackedSize} bytes`)
}

process.stdout.write(
  `definedmotion pack verified: ${result.entryCount} files, ` +
    `${(result.size / 1024 / 1024).toFixed(1)} MiB packed, ` +
    `${(result.unpackedSize / 1024 / 1024).toFixed(1)} MiB unpacked\n`
)
