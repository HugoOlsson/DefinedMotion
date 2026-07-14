import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

const packageRoot = new URL('..', import.meta.url)
const packed = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: packageRoot,
  encoding: 'utf8',
  env: { ...process.env, npm_config_cache: join(tmpdir(), 'definedmotion-npm-cache') }
})
if (packed.status !== 0) throw new Error(packed.stderr || 'npm pack failed')

const result = JSON.parse(packed.stdout)[0]
const paths = result.files.map((file) => file.path)
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
if (manifest.bin?.['create-definedmotion'] !== 'bin/create-definedmotion.js') {
  throw new Error(
    'create-definedmotion package must publish the bin/create-definedmotion.js binary'
  )
}
const forbidden = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)out\//,
  /(^|\/)\.DS_Store$/,
  /(^|\/)\.definedmotion\//,
  /(^|\/)(renders|rendered_videos|image_renders|audio_renders)\//
]
for (const file of paths) {
  if (forbidden.some((pattern) => pattern.test(file))) {
    throw new Error(`Forbidden path in create-definedmotion package: ${file}`)
  }
}
for (const required of [
  'README.md',
  'bin/create-definedmotion.js',
  'template/AGENTS.md',
  'template/README.md',
  'template/package.json',
  'template/definedmotion.config.ts',
  'template/src/scenes/my-first-scene.scene.ts'
]) {
  if (!paths.includes(required)) throw new Error(`Required scaffold file is missing: ${required}`)
}
if (result.unpackedSize > 2 * 1024 * 1024) {
  throw new Error(`create-definedmotion must remain below 2 MiB unpacked: ${result.unpackedSize}`)
}
process.stdout.write(
  `create-definedmotion pack verified: ${result.entryCount} files, ` +
    `${(result.unpackedSize / 1024).toFixed(1)} KiB unpacked\n`
)
