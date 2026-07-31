import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(packageRoot, '..', '..')
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const packageJson = await readJson(resolve(packageRoot, 'package.json'))
const repositoryJson = await readJson(resolve(repositoryRoot, 'package.json'))

for (const name of [
  'test:unit',
  'test:scenes',
  'test:viewer',
  'test:documentation',
  'test:proposal',
  'test:integration',
  'test:full'
]) {
  assert.equal(typeof packageJson.scripts[name], 'string', `[TEST-01] missing package script ${name}`)
}

assert.doesNotMatch(packageJson.scripts.test, /test:scenes|test:viewer/, '[TEST-03] npm test must remain Electron-free')
assert.match(repositoryJson.scripts['test:full'], /test:scenes/, '[TEST-03] full gate must run scene automation')
assert.match(repositoryJson.scripts['test:full'], /test:viewer/, '[TEST-03] full gate must run viewer integration')
assert.match(repositoryJson.scripts['test:full'], /test:package/, '[TEST-05] full gate must run the packed consumer')

const proposalRouter = await readFile(resolve(packageRoot, 'scripts/test-proposal.mjs'), 'utf8')
for (const proposal of [
  'new-animation-api',
  'timeline-beats',
  'scene-verifications',
  'text-and-latex',
  'primitive-layout',
  'core-animation-effects',
  'documentation-system',
  'viewer-preview',
  'viewer-scene-selection',
  'implementation-testing',
  'legacy-deletion'
]) {
  assert.match(proposalRouter, new RegExp(`['\"]${proposal}['\"]`), `[TEST-01] missing proposal route ${proposal}`)
}

const integrationRouter = await readFile(resolve(packageRoot, 'scripts/test-integration.mjs'), 'utf8')
assert.match(integrationRouter, /test:scenes/, '[TEST-02] integration router must support scene contracts')
assert.match(integrationRouter, /test:viewer/, '[TEST-02] integration router must support viewer contracts')

console.log('implementation testing contracts passed')
