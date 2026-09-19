import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// Check the copy actually used by MathJax's transitive dependency.
const require = createRequire(import.meta.url)
const requireMathJax = createRequire(require.resolve('mathjax-full/package.json'))
const requireSpeechEngine = createRequire(requireMathJax.resolve('speech-rule-engine'))
const { DOMImplementation, XMLSerializer } = requireSpeechEngine('@xmldom/xmldom')
const serializer = new XMLSerializer()

// GHSA-c7q8-3ch8-vqpv: ill-formed processing-instruction targets must not
// bypass the serializer's explicit well-formedness checks.
for (const target of ['a>', 'a?', 'a b', 'a?><injected/><?b']) {
  const doc = new DOMImplementation().createDocument(null, 'root', null)
  doc.documentElement.appendChild(doc.createProcessingInstruction(target, 'data'))
  assert.throws(
    () => serializer.serializeToString(doc, { requireWellFormed: true }),
    { name: 'InvalidStateError' },
    `Serializer must reject target ${JSON.stringify(target)}`
  )
}

const doc = new DOMImplementation().createDocument(null, 'root', null)
doc.documentElement.appendChild(doc.createProcessingInstruction('valid-target', 'data'))
assert.equal(
  serializer.serializeToString(doc, { requireWellFormed: true }),
  '<root><?valid-target data?></root>'
)
console.log('xmldom processing-instruction security regression passed')
