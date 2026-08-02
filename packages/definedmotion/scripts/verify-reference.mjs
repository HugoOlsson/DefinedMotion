import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roots = [join(packageRoot, 'reference', 'examples'), join(packageRoot, 'reference', 'tests')]
const forbidden = [/\$renderer\//, /\bfrom\s+['"]\.\.?\//]

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
        source: relative(join(packageRoot, 'reference'), absolutePath).replaceAll('\\', '/')
      })
    }
  }
  return entries
}

const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) visit(absolutePath)
    else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const source = readFileSync(absolutePath, 'utf8')
      for (const pattern of forbidden) {
        if (pattern.test(source)) throw new Error(`Internal import in published reference: ${absolutePath}`)
      }
    }
  }
}

roots.forEach(visit)

const entries = [
  ...collect(roots[0], 'example'),
  ...collect(roots[1], 'test')
].sort((left, right) => left.id.localeCompare(right.id))
const expectedCatalog = `${JSON.stringify({ version: 1, scenes: entries }, null, 2)}\n`
const actualCatalog = readFileSync(join(packageRoot, 'reference', 'catalog.json'), 'utf8')
if (actualCatalog !== expectedCatalog) {
  throw new Error('Reference catalog is stale; run npm run reference:generate')
}

const rows = entries
  .map((entry) => `| ${entry.id} | ${entry.kind} | ${entry.name} | \`${entry.source}\` |`)
  .join('\n')
const expectedIndex =
  `# DefinedMotion reference\n\n` +
  `This corpus matches the installed DefinedMotion version. Read \`agent-workflow.md\` before ` +
  `authoring a scene. All examples and tests use the supported public package API.\n\n` +
  `## Scene catalog\n\n| ID | Kind | Name | Source |\n|---|---|---|---|\n${rows}\n`
const actualIndex = readFileSync(join(packageRoot, 'reference', 'INDEX.md'), 'utf8')
if (actualIndex !== expectedIndex) {
  throw new Error('Reference index is stale; run npm run reference:generate')
}

process.stdout.write(`Reference verified: ${entries.length} public-API scenes with current catalog\n`)
