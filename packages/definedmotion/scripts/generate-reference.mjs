import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const referenceRoot = join(packageRoot, 'reference')

const collect = (directory, kind) => {
  const entries = []
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, item.name)
    if (item.isDirectory()) entries.push(...collect(absolutePath, kind))
    else if (item.isFile() && item.name.endsWith('.scene.ts')) {
      const source = readFileSync(absolutePath, 'utf8')
      const id = /\bid:\s*['"]([^'"]+)['"]/.exec(source)?.[1]
      const name = /\bname:\s*['"]([^'"]+)['"]/.exec(source)?.[1] ?? id
      if (!id) throw new Error(`Reference scene has no static id: ${absolutePath}`)
      entries.push({
        id,
        name,
        kind,
        source: relative(referenceRoot, absolutePath).replaceAll('\\', '/')
      })
    }
  }
  return entries
}

const entries = [
  ...collect(join(referenceRoot, 'examples'), 'example'),
  ...collect(join(referenceRoot, 'tests'), 'test')
].sort((a, b) => a.id.localeCompare(b.id))

const ids = new Set()
for (const entry of entries) {
  if (ids.has(entry.id)) throw new Error(`Duplicate reference scene id: ${entry.id}`)
  ids.add(entry.id)
}

mkdirSync(referenceRoot, { recursive: true })
writeFileSync(
  join(referenceRoot, 'catalog.json'),
  `${JSON.stringify({ version: 1, scenes: entries }, null, 2)}\n`
)

const rows = entries
  .map((entry) => `| ${entry.id} | ${entry.kind} | ${entry.name} | \`${entry.source}\` |`)
  .join('\n')
writeFileSync(
  join(referenceRoot, 'INDEX.md'),
  `# DefinedMotion reference\n\n` +
    `This corpus matches the installed DefinedMotion version. Read \`agent-workflow.md\` before ` +
    `authoring a scene. All examples and tests use the supported public package API.\n\n` +
    `## Scene catalog\n\n| ID | Kind | Name | Source |\n|---|---|---|---|\n${rows}\n`
)

process.stdout.write(`Generated reference catalog for ${entries.length} scenes\n`)
