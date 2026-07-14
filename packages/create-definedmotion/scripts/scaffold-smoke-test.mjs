import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const temporaryRoot = mkdtempSync(join(tmpdir(), 'create-definedmotion-'))
try {
  const result = spawnSync(process.execPath, [new URL('../bin/create-definedmotion.js', import.meta.url).pathname, 'smoke-project'], {
    cwd: temporaryRoot,
    encoding: 'utf8'
  })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  const project = join(temporaryRoot, 'smoke-project')
  for (const required of [
    'package.json',
    'definedmotion.config.ts',
    'AGENTS.md',
    'src/scenes/my-first-scene.scene.ts'
  ]) {
    if (!existsSync(join(project, required))) throw new Error(`Scaffold is missing ${required}`)
  }
  const packageJson = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'))
  if (packageJson.name !== 'smoke-project') throw new Error('Scaffold package name was not updated')
  if (packageJson.scripts?.typecheck !== 'tsc --noEmit') {
    throw new Error('Scaffold is missing its TypeScript validation command')
  }
  if (packageJson.devDependencies?.['@types/three'] !== '^0.175.0') {
    throw new Error('Scaffold is missing declarations matching its Three.js dependency')
  }
  if (!packageJson.devDependencies?.typescript) {
    throw new Error('Scaffold is missing a project-local TypeScript compiler')
  }
  if (existsSync(join(project, 'src', 'renderer'))) throw new Error('Scaffold contains framework source')
  process.stdout.write('Thin project scaffold verified\n')
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
