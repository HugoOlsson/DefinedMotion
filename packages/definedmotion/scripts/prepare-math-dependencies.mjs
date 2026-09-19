import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const workspaceRequire = createRequire(new URL('../../../package.json', import.meta.url))
const destination = join(packageRoot, 'node_modules', 'mathjax-full')

// Build an isolated bundle from the versions already installed from our lockfile.
// npm does not reliably bundle hoisted workspace dependencies by itself.
function copyDependency(name, sourceRequire, target) {
  let sourceManifest
  try {
    sourceManifest = sourceRequire.resolve(`${name}/package.json`)
  } catch (error) {
    if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error
    let directory = dirname(sourceRequire.resolve(name))
    while (directory !== dirname(directory)) {
      const candidate = join(directory, 'package.json')
      if (existsSync(candidate) && JSON.parse(readFileSync(candidate, 'utf8')).name === name) {
        sourceManifest = candidate
        break
      }
      directory = dirname(directory)
    }
    if (!sourceManifest) throw new Error(`Cannot locate the manifest for ${name}`)
  }
  const source = dirname(sourceManifest)
  if (resolve(source) === resolve(target)) throw new Error('Bundle source overlaps its destination')
  const manifest = JSON.parse(readFileSync(sourceManifest, 'utf8'))
  mkdirSync(target, { recursive: true })
  cpSync(source, target, {
    recursive: true,
    filter: (path) => path === source ||
      (!path.startsWith(join(source, 'node_modules')) && !path.endsWith('/.DS_Store'))
  })
  const dependencyRequire = createRequire(sourceManifest)
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    copyDependency(dependency, dependencyRequire, join(target, 'node_modules', dependency))
  }
  if (name === 'speech-rule-engine') {
    // Upstream 4.1.4 pins 0.9.10. Keep its code unchanged and make the bundled
    // manifest agree with the patched dependency shipped alongside it.
    manifest.dependencies['@xmldom/xmldom'] = '^0.9.12'
    writeFileSync(join(target, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  }
  if (name === '@xmldom/xmldom' && !/^0\.9\.(1[2-9]|[2-9]\d|\d{3,})$/.test(manifest.version)) {
    throw new Error(`Refresh the workspace XML dependency before packing: ${manifest.version}`)
  }
}

rmSync(destination, { recursive: true, force: true })
copyDependency('mathjax-full', workspaceRequire, destination)
console.log('Prepared math-rendering dependency bundle')
