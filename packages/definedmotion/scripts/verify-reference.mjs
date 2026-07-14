import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roots = [join(packageRoot, 'reference', 'examples'), join(packageRoot, 'reference', 'tests')]
const forbidden = [/\$renderer\//, /\bfrom\s+['"]\.\.?\//]

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
process.stdout.write('Reference imports use public package entry points\n')
