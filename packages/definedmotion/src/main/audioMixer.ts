import { spawn } from 'node:child_process'
import {
  type FileHandle,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  stat
} from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_SAMPLE_RATE = 48_000
const OUTPUT_CHANNELS = 2
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT
const OUTPUT_FRAME_BYTES = OUTPUT_CHANNELS * FLOAT_BYTES
const DEFAULT_CHUNK_DURATION_SECONDS = 4
const MAX_ERROR_OUTPUT_LENGTH = 16_384

export interface AudioMixEvent {
  sourcePath: string
  volume: number
  atFrame: number
}

export interface AudioMixOptions {
  events: readonly AudioMixEvent[]
  fps: number
  outputFile: string
  workingDirectory: string
  sampleRate?: number
  chunkDurationSeconds?: number
}

export interface AudioMixResult {
  outputFile: string
  inputEventCount: number
  coalescedEventCount: number
  uniqueSourceCount: number
  durationSeconds: number
  peakBeforeGain: number
  outputGain: number
}

type CoalescedAudioMixEvent = AudioMixEvent

interface DecodedAudioSource {
  sourcePath: string
  samples: Float32Array
  frameCount: number
}

interface PreparedAudioEvent {
  source: DecodedAudioSource
  volume: number
  startSampleFrame: number
  endSampleFrame: number
}

export function coalesceAudioMixEvents(
  events: readonly AudioMixEvent[]
): CoalescedAudioMixEvent[] {
  const bySource = new Map<string, Map<number, number>>()

  for (const event of events) {
    validateAudioEvent(event)
    if (event.volume === 0) continue

    let byFrame = bySource.get(event.sourcePath)
    if (!byFrame) {
      byFrame = new Map()
      bySource.set(event.sourcePath, byFrame)
    }
    byFrame.set(event.atFrame, (byFrame.get(event.atFrame) ?? 0) + event.volume)
  }

  const coalesced: CoalescedAudioMixEvent[] = []
  for (const [sourcePath, byFrame] of bySource) {
    for (const [atFrame, volume] of byFrame) {
      if (volume !== 0) coalesced.push({ sourcePath, atFrame, volume })
    }
  }
  return coalesced.sort(
    (left, right) =>
      left.atFrame - right.atFrame ||
      left.sourcePath.localeCompare(right.sourcePath)
  )
}

/**
 * Renders frame-aligned sound events into one lossless floating-point WAV.
 *
 * Sources are decoded once, simultaneous instances are combined by gain, and
 * the output is mixed in bounded chunks. The work therefore scales with the
 * duration of the audio and number of unique placements rather than with an
 * FFmpeg input/filter node for every scene.playAudio() call.
 */
export async function mixAudioEvents(
  options: AudioMixOptions
): Promise<AudioMixResult> {
  validateMixOptions(options)
  const sampleRate = positiveInteger(
    options.sampleRate ?? DEFAULT_SAMPLE_RATE,
    'sampleRate'
  )
  const chunkDurationSeconds = positiveNumber(
    options.chunkDurationSeconds ?? DEFAULT_CHUNK_DURATION_SECONDS,
    'chunkDurationSeconds'
  )
  const chunkSampleFrames = Math.max(
    1,
    Math.round(sampleRate * chunkDurationSeconds)
  )
  const coalesced = coalesceAudioMixEvents(options.events)
  if (coalesced.length === 0) {
    throw new Error('Cannot mix audio without at least one non-zero event')
  }

  await mkdir(options.workingDirectory, { recursive: true })
  await mkdir(path.dirname(options.outputFile), { recursive: true })
  const temporaryDirectory = await mkdtemp(
    path.join(options.workingDirectory, '.pcm-mix-')
  )

  try {
    const sourcePaths = [...new Set(coalesced.map((event) => event.sourcePath))]
    console.log(
      `Building audio: ${options.events.length} events -> ` +
        `${coalesced.length} placements from ${sourcePaths.length} source(s)`
    )

    const decodedSources = new Map<string, DecodedAudioSource>()
    for (let index = 0; index < sourcePaths.length; index++) {
      const sourcePath = sourcePaths[index]
      decodedSources.set(
        sourcePath,
        await decodeAudioSource(
          sourcePath,
          temporaryDirectory,
          index,
          sampleRate
        )
      )
    }

    const preparedEvents = coalesced.map<PreparedAudioEvent>((event) => {
      const source = decodedSources.get(event.sourcePath)
      if (!source) {
        throw new Error(`Decoded audio source is missing: ${event.sourcePath}`)
      }
      const startSampleFrame = Math.round(
        (event.atFrame * sampleRate) / options.fps
      )
      return {
        source,
        volume: event.volume,
        startSampleFrame,
        endSampleFrame: startSampleFrame + source.frameCount
      }
    })
    preparedEvents.sort(
      (left, right) => left.startSampleFrame - right.startSampleFrame
    )

    const totalSampleFrames = preparedEvents.reduce(
      (latest, event) => Math.max(latest, event.endSampleFrame),
      0
    )
    const rawMixPath = path.join(temporaryDirectory, 'mix.f32le')
    const peakBeforeGain = await mixPreparedEventsToRawFile(
      preparedEvents,
      totalSampleFrames,
      chunkSampleFrames,
      rawMixPath
    )
    const outputGain =
      peakBeforeGain > 0.98 ? 0.98 / peakBeforeGain : 1
    if (outputGain < 1) {
      console.log(
        `Audio peak ${peakBeforeGain.toFixed(3)} exceeds 0.98; ` +
          `applying ${outputGain.toFixed(4)} output gain`
      )
    }

    const ffmpegArguments = [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'f32le',
      '-ar',
      String(sampleRate),
      '-ac',
      String(OUTPUT_CHANNELS),
      '-i',
      rawMixPath
    ]
    if (outputGain < 1) {
      ffmpegArguments.push('-af', `volume=${outputGain}`)
    }
    ffmpegArguments.push('-c:a', 'pcm_f32le', options.outputFile)
    await runProcess('ffmpeg', ffmpegArguments)

    return {
      outputFile: options.outputFile,
      inputEventCount: options.events.length,
      coalescedEventCount: coalesced.length,
      uniqueSourceCount: sourcePaths.length,
      durationSeconds: totalSampleFrames / sampleRate,
      peakBeforeGain,
      outputGain
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

export function runProcess(
  command: string,
  arguments_: readonly string[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...arguments_], {
      stdio: ['ignore', 'inherit', 'pipe']
    })
    let errorOutput = ''

    child.stderr?.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString()
      process.stderr.write(text)
      errorOutput = (errorOutput + text).slice(-MAX_ERROR_OUTPUT_LENGTH)
    })
    child.once('error', (error) => {
      reject(
        new Error(
          `Could not start ${command}: ${error.message}`,
          { cause: error }
        )
      )
    })
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      const reason =
        signal !== null
          ? `terminated by signal ${signal}`
          : `exited with code ${code ?? 'unknown'}`
      const details = errorOutput.trim()
      reject(
        new Error(
          `${command} ${reason}${details ? `\n${details}` : ''}`
        )
      )
    })
  })
}

async function decodeAudioSource(
  sourcePath: string,
  temporaryDirectory: string,
  index: number,
  sampleRate: number
): Promise<DecodedAudioSource> {
  await stat(sourcePath)
  const rawPath = path.join(temporaryDirectory, `source-${index}.f32le`)
  await runProcess('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    sourcePath,
    '-map',
    '0:a:0',
    '-vn',
    '-ar',
    String(sampleRate),
    '-ac',
    String(OUTPUT_CHANNELS),
    '-f',
    'f32le',
    '-c:a',
    'pcm_f32le',
    rawPath
  ])

  const bytes = await readFile(rawPath)
  if (bytes.byteLength === 0 || bytes.byteLength % OUTPUT_FRAME_BYTES !== 0) {
    throw new Error(
      `Decoded audio has an invalid PCM size (${bytes.byteLength} bytes): ${sourcePath}`
    )
  }
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  )
  const samples = new Float32Array(arrayBuffer)
  return {
    sourcePath,
    samples,
    frameCount: samples.length / OUTPUT_CHANNELS
  }
}

async function mixPreparedEventsToRawFile(
  events: readonly PreparedAudioEvent[],
  totalSampleFrames: number,
  chunkSampleFrames: number,
  outputPath: string
): Promise<number> {
  const output = await open(outputPath, 'w')
  let nextEventIndex = 0
  let activeEvents: PreparedAudioEvent[] = []
  let peak = 0

  try {
    for (
      let chunkStart = 0;
      chunkStart < totalSampleFrames;
      chunkStart += chunkSampleFrames
    ) {
      const chunkEnd = Math.min(
        totalSampleFrames,
        chunkStart + chunkSampleFrames
      )
      while (
        nextEventIndex < events.length &&
        events[nextEventIndex].startSampleFrame < chunkEnd
      ) {
        activeEvents.push(events[nextEventIndex])
        nextEventIndex++
      }
      activeEvents = activeEvents.filter(
        (event) => event.endSampleFrame > chunkStart
      )

      const chunk = new Float32Array(
        (chunkEnd - chunkStart) * OUTPUT_CHANNELS
      )
      for (const event of activeEvents) {
        const overlapStart = Math.max(chunkStart, event.startSampleFrame)
        const overlapEnd = Math.min(chunkEnd, event.endSampleFrame)
        if (overlapStart >= overlapEnd) continue

        let sourceOffset =
          (overlapStart - event.startSampleFrame) * OUTPUT_CHANNELS
        let outputOffset = (overlapStart - chunkStart) * OUTPUT_CHANNELS
        const outputEnd =
          outputOffset + (overlapEnd - overlapStart) * OUTPUT_CHANNELS
        while (outputOffset < outputEnd) {
          chunk[outputOffset] +=
            event.source.samples[sourceOffset] * event.volume
          sourceOffset++
          outputOffset++
        }
      }

      for (let index = 0; index < chunk.length; index++) {
        peak = Math.max(peak, Math.abs(chunk[index]))
      }
      const bytes = Buffer.from(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength
      )
      await writeAll(output, bytes)
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
  } finally {
    await output.close()
  }

  return peak
}

async function writeAll(output: FileHandle, bytes: Buffer): Promise<void> {
  let offset = 0
  while (offset < bytes.length) {
    const { bytesWritten } = await output.write(
      bytes,
      offset,
      bytes.length - offset
    )
    if (bytesWritten === 0) {
      throw new Error('Could not make progress while writing mixed audio')
    }
    offset += bytesWritten
  }
}

function validateMixOptions(options: AudioMixOptions): void {
  positiveNumber(options.fps, 'fps')
  if (!options.outputFile) throw new Error('outputFile must not be empty')
  if (!options.workingDirectory) {
    throw new Error('workingDirectory must not be empty')
  }
}

function validateAudioEvent(event: AudioMixEvent): void {
  if (!event.sourcePath) throw new Error('Audio event sourcePath must not be empty')
  if (!Number.isFinite(event.volume)) {
    throw new Error(`Audio event volume must be finite: ${event.volume}`)
  }
  if (!Number.isFinite(event.atFrame) || event.atFrame < 0) {
    throw new Error(
      `Audio event atFrame must be a finite non-negative number: ${event.atFrame}`
    )
  }
}

function positiveNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number`)
  }
  return value
}

function positiveInteger(value: number, name: string): number {
  positiveNumber(value, name)
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`)
  return value
}
