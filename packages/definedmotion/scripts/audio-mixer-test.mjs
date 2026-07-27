import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourcePath = path.join(packageRoot, 'src/main/audioMixer.ts')
const temporaryDirectory = await mkdtemp(
  path.join(packageRoot, '.audio-mixer-test-')
)

const run = (command, arguments_, options = {}) => {
  const result = spawnSync(command, arguments_, {
    encoding: options.encoding ?? null,
    ...options
  })
  if (result.status !== 0) {
    throw new Error(
      result.stderr?.toString() ||
        result.error?.message ||
        `${command} exited with ${result.status}`
    )
  }
  return result
}

const compileAudioMixer = async () => {
  const source = await readFile(sourcePath, 'utf8')
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler
    },
    fileName: sourcePath,
    reportDiagnostics: true
  })
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  )
  assert.equal(errors.length, 0, errors.map((error) => error.messageText).join('\n'))

  const outputPath = path.join(temporaryDirectory, 'audioMixer.mjs')
  await writeFile(outputPath, result.outputText)
  return import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`)
}

const decodeFloatStereo = (inputPath) => {
  const result = run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-ar',
    '48000',
    '-ac',
    '2',
    '-f',
    'f32le',
    '-c:a',
    'pcm_f32le',
    'pipe:1'
  ])
  const bytes = result.stdout
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  )
  return new Float32Array(arrayBuffer)
}

const peak = (samples) => {
  let result = 0
  for (const sample of samples) result = Math.max(result, Math.abs(sample))
  return result
}

try {
  const { coalesceAudioMixEvents, mixAudioEvents } = await compileAudioMixer()
  const sourceAudio = path.join(temporaryDirectory, 'source tone.wav')
  run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=48000:duration=0.04',
    '-ac',
    '2',
    '-c:a',
    'pcm_f32le',
    sourceAudio
  ])

  const coalesced = coalesceAudioMixEvents([
    { sourcePath: sourceAudio, volume: 0.25, atFrame: 0 },
    { sourcePath: sourceAudio, volume: 0.75, atFrame: 0 },
    { sourcePath: sourceAudio, volume: 0.5, atFrame: 3 },
    { sourcePath: sourceAudio, volume: 0, atFrame: 5 }
  ])
  assert.deepEqual(
    coalesced.map(({ volume, atFrame }) => ({ volume, atFrame })),
    [
      { volume: 1, atFrame: 0 },
      { volume: 0.5, atFrame: 3 }
    ]
  )

  const mixedAudio = path.join(temporaryDirectory, 'mixed.wav')
  const mixResult = await mixAudioEvents({
    events: [
      { sourcePath: sourceAudio, volume: 0.25, atFrame: 0 },
      { sourcePath: sourceAudio, volume: 0.75, atFrame: 0 },
      { sourcePath: sourceAudio, volume: 0.5, atFrame: 3 }
    ],
    fps: 60,
    outputFile: mixedAudio,
    workingDirectory: temporaryDirectory,
    sampleRate: 48_000,
    chunkDurationSeconds: 0.02
  })
  assert.equal(mixResult.inputEventCount, 3)
  assert.equal(mixResult.coalescedEventCount, 2)
  assert.equal(mixResult.uniqueSourceCount, 1)
  assert.equal(mixResult.outputGain, 1)

  const sourceSamples = decodeFloatStereo(sourceAudio)
  const mixedSamples = decodeFloatStereo(mixedAudio)
  const secondEventOffset = Math.round((3 * 48_000) / 60) * 2
  const expected = new Float32Array(secondEventOffset + sourceSamples.length)
  for (let index = 0; index < sourceSamples.length; index++) {
    expected[index] += sourceSamples[index]
    expected[secondEventOffset + index] += sourceSamples[index] * 0.5
  }
  assert.equal(mixedSamples.length, expected.length)
  let maximumDifference = 0
  for (let index = 0; index < expected.length; index++) {
    maximumDifference = Math.max(
      maximumDifference,
      Math.abs(mixedSamples[index] - expected[index])
    )
  }
  assert.ok(
    maximumDifference < 1e-6,
    `mixed PCM differs from expected samples by ${maximumDifference}`
  )

  const limitedAudio = path.join(temporaryDirectory, 'limited.wav')
  const limitedResult = await mixAudioEvents({
    events: [{ sourcePath: sourceAudio, volume: 20, atFrame: 0 }],
    fps: 60,
    outputFile: limitedAudio,
    workingDirectory: temporaryDirectory
  })
  assert.ok(limitedResult.peakBeforeGain > 1)
  assert.ok(limitedResult.outputGain < 1)
  assert.ok(
    Math.abs(peak(decodeFloatStereo(limitedAudio)) - 0.98) < 1e-4,
    'peak protection should scale the output to 0.98'
  )

  process.stdout.write(
    `audio mixer verified: ${mixResult.inputEventCount} events -> ` +
      `${mixResult.coalescedEventCount} placements, chunk boundaries exact\n`
  )
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
