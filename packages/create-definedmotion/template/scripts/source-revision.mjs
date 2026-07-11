/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * Hashes the complete source tree so a persistent renderer can prove which
 * uncommitted project version it has loaded. Generated output is outside src.
 */
export function computeSourceRevision(projectRoot) {
  const root = resolve(projectRoot)
  const sourceRoot = join(root, 'src')
  const files = collectFiles(sourceRoot).sort()
  const hash = createHash('sha256')

  for (const file of files) {
    hash.update(relative(root, file))
    hash.update('\0')
    hash.update(readFileSync(file))
    hash.update('\0')
  }

  return `sha256:${hash.digest('hex')}`
}

function collectFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(absolutePath))
    else if (entry.isFile()) files.push(absolutePath)
  }
  return files
}
