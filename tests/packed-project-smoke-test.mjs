import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const definedMotionRoot = join(repositoryRoot, 'packages', 'definedmotion')
const creatorEntry = join(
  repositoryRoot,
  'packages',
  'create-definedmotion',
  'bin',
  'create-definedmotion.js'
)
const temporaryRoot = mkdtempSync(join(tmpdir(), 'definedmotion-packed-project-'))
const npmEnvironment = {
  ...process.env,
  npm_config_cache: join(tmpdir(), 'definedmotion-npm-cache'),
  npm_config_fund: 'false',
  npm_config_audit: 'false'
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: npmEnvironment,
    ...options
  })
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed\n${result.stdout ?? ''}\n${result.stderr ?? ''}`
    )
  }
  return result.stdout
}

const hashFile = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

const processTree = (pid) => {
  if (process.platform === 'win32') return [pid]
  const result = spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' })
  const children = (result.stdout ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isInteger)
  return [pid, ...children.flatMap(processTree)]
}

const verifyDevelopmentStartup = (cwd, sceneFile) => new Promise((resolvePromise, rejectPromise) => {
  const child = spawn('npm', ['run', 'dev'], {
    cwd,
    env: { ...npmEnvironment, DEFINEDMOTION_DEV_SMOKE: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  let settled = false
  let readyCount = 0
  let hotReloadApplied = false
  let sceneChanged = false
  let timeout

  const finish = (error) => {
    if (settled) return
    settled = true
    if (timeout) clearTimeout(timeout)
    if (child.pid === undefined) {
      if (error) rejectPromise(error)
      else resolvePromise()
      return
    }
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'])
      if (error) rejectPromise(error)
      else resolvePromise()
      return
    }
    const pids = processTree(child.pid).reverse()
    for (const pid of pids) {
      try { process.kill(pid, 'SIGTERM') } catch { /* Process already stopped. */ }
    }
    setTimeout(() => {
      for (const pid of pids) {
        try { process.kill(pid, 'SIGKILL') } catch { /* Process already stopped. */ }
      }
      if (error) rejectPromise(error)
      else resolvePromise()
    }, 500)
  }
  const inspect = (chunk) => {
    const text = chunk.toString()
    output += text
    readyCount += text.match(/DEFINEDMOTION_RENDERER_READY/g)?.length ?? 0
    if (text.includes('DEFINEDMOTION_HOT_RELOAD_APPLIED')) hotReloadApplied = true
    if (
      output.includes('error while updating dependencies') ||
      output.includes('No loader is configured for ".glsl"') ||
      output.includes('Could not resolve "virtual:definedmotion-config"') ||
      output.includes('Top-level await is not available') ||
      output.includes('does not provide an export named') ||
      output.includes('DEFINEDMOTION_RENDERER_EMPTY') ||
      output.includes('DEFINEDMOTION_RENDERER_CHECK_FAILED')
    ) {
      finish(new Error(`Packed consumer development startup failed\n${output}`))
      return
    }
    if (readyCount === 1 && !sceneChanged) {
      sceneChanged = true
      appendFileSync(sceneFile, '\nconsole.log("DEFINEDMOTION_HOT_RELOAD_APPLIED")\n')
    }
    if (readyCount >= 2 && hotReloadApplied) finish()
  }
  child.stdout.on('data', inspect)
  child.stderr.on('data', inspect)
  child.once('error', (error) => finish(error))
  child.once('exit', (code, signal) => {
    if (!settled) {
      finish(new Error(
        `Packed consumer development process exited before verification ` +
        `(code ${code ?? 'none'}, signal ${signal ?? 'none'})\n${output}`
      ))
    }
  })
  timeout = setTimeout(() => {
    finish(new Error(`Packed consumer development startup timed out\n${output}`))
  }, 45_000)
})

try {
  const packedOutput = run(
    'npm',
    ['pack', definedMotionRoot, '--json', '--pack-destination', temporaryRoot],
    { cwd: repositoryRoot }
  )
  const packageJsonStart = packedOutput.lastIndexOf('\n[')
  if (packageJsonStart === -1) throw new Error(`npm pack returned unexpected output: ${packedOutput}`)
  const tarball = join(temporaryRoot, JSON.parse(packedOutput.slice(packageJsonStart + 1))[0].filename)
  if (!existsSync(tarball)) throw new Error('DefinedMotion tarball was not created')

  run(process.execPath, [creatorEntry, 'consumer'], { cwd: temporaryRoot })
  const consumerRoot = join(temporaryRoot, 'consumer')
  const packagePath = join(consumerRoot, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  packageJson.dependencies.definedmotion = `file:${tarball}`
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

  run('npm', ['install', '--prefer-offline'], { cwd: consumerRoot })
  run('npm', ['run', 'typecheck'], { cwd: consumerRoot })

  for (const required of [
    'node_modules/definedmotion/cli/index.mjs',
    'node_modules/definedmotion/assets/fonts/Montserrat-Medium.woff',
    'node_modules/definedmotion/reference/INDEX.md',
    'node_modules/definedmotion/reference/catalog.json',
    'node_modules/definedmotion/types/public/index.d.ts',
    'node_modules/definedmotion/reference/examples/tutorials/easy1.scene.ts',
    'node_modules/definedmotion/reference/tests/assets/test_asset_references.scene.ts'
  ]) {
    if (!existsSync(join(consumerRoot, required))) {
      throw new Error(`Packed consumer is missing ${required}`)
    }
  }

  for (const forbidden of [
    'node_modules/definedmotion/build',
    'node_modules/definedmotion/scripts',
    'node_modules/definedmotion/src/scenes'
  ]) {
    if (existsSync(join(consumerRoot, forbidden))) {
      throw new Error(`Packed consumer contains legacy structure ${forbidden}`)
    }
  }

  const userScene = join(consumerRoot, 'src', 'scenes', 'my-first-scene.scene.ts')
  run('npm', ['run', 'build'], { cwd: consumerRoot })
  await verifyDevelopmentStartup(consumerRoot, userScene)
  const userSceneBeforeUpgrade = hashFile(userScene)
  const scenesOutput = run(
    'npm',
    ['run', 'dm', '--', 'scenes', '--no-build', '--json'],
    { cwd: consumerRoot }
  )
  const jsonStart = scenesOutput.indexOf('{')
  const result = JSON.parse(scenesOutput.slice(jsonStart))
  const ids = new Set(result.scenes.map((scene) => scene.id))
  for (const id of ['my-first-scene', 'tutorial-easy-1', 'test-asset-references']) {
    if (!ids.has(id)) throw new Error(`Packed consumer did not discover ${id}`)
  }

  run('npm', ['install', `definedmotion@file:${tarball}`, '--prefer-offline'], {
    cwd: consumerRoot
  })
  if (hashFile(userScene) !== userSceneBeforeUpgrade) {
    throw new Error('Updating DefinedMotion modified the user scene')
  }

  process.stdout.write(
    `Packed consumer verified production, development startup, and hot reload with ` +
      `${result.scenes.length} packaged and project scenes; ` +
      `dependency reinstall preserved the user scene\n`
  )
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
