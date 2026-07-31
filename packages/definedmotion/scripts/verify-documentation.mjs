import { access, readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const documentationRoot = join(packageRoot, 'documentation')
const required = [
  'index.md',
  'getting-started.md',
  'scenes-and-timeline.md',
  'animation-effects.md',
  'beats.md',
  'text-and-latex.md',
  'latex-effects.md',
  'layout.md',
  'verification.md',
  'camera-and-3d.md',
  'assets-and-audio.md',
  'cli.md',
  'advanced/custom-animations.md'
]

const markdownFiles = async (directory) => {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...(await markdownFiles(path)))
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(path)
  }
  return result
}

for (const path of required) await access(join(documentationRoot, path))

const files = [
  join(packageRoot, 'README.md'),
  join(packageRoot, 'AGENTS.md'),
  ...(await markdownFiles(documentationRoot))
]
const forbidden = [
  'HotReloadSetting',
  'addDeferredAnims',
  'addSequentialBackgroundAnims',
  'insertAnimsAt'
]

for (const file of files) {
  const source = await readFile(file, 'utf8')
  if (file.startsWith(documentationRoot)) {
    for (const name of forbidden) {
      if (source.includes(name)) {
        throw new Error(`${relative(packageRoot, file)} documents legacy API ${name}`)
      }
    }
  }
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0]
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue
    await access(resolve(dirname(file), decodeURIComponent(target))).catch(() => {
      throw new Error(`${relative(packageRoot, file)} has a broken link to ${match[1]}`)
    })
  }
}

const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
if (!packageJson.files?.includes('documentation')) {
  throw new Error('package.json must publish the documentation directory')
}

console.log(`documentation verified: ${required.length} canonical files`)
