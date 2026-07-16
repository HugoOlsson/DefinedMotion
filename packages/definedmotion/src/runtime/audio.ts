// audio/loader.ts
import { AssetRuntimeError, assetPath } from './assets'

export interface AudioInScene {
  audioPath: string
  volume: number
  atFrame: number
}

let loadedAudio = new Map<string, AudioBuffer>()
let registeredAudios = new Set<string>()

// A single shared AudioContext
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

// ---- Internal tracking of playing sounds ----
type PlayingId = string

interface PlayingSound {
  id: PlayingId
  path: string
  source: AudioBufferSourceNode | null
  gain: GainNode
  volume: number
  // timeline info
  startTick: number            // tick in your scene when this sound originally “started”
  startedCtxTime: number       // audioContext.currentTime when we started this source
  offsetAtStartSec: number     // offset in the buffer where this source began
  durationSec: number
}

let active: PlayingSound[] = []
const newId = () => Math.random().toString(36).slice(2)

// ----------------- Public API -----------------

export const registerAudio = (audioPath: string) => {
  registeredAudios.add(audioPath)
}

export const loadAllAudio = async (): Promise<void> => {
  const tasks: Promise<void>[] = []
  for (const path of registeredAudios) {
    if (!loadedAudio.has(path)) {
      const p = fetch(path)
        .then(r => {
          if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status} ${r.statusText}`)
          return r.arrayBuffer()
        })
        .then(buf => audioContext.decodeAudioData(buf))
        .then(decoded => { loadedAudio.set(path, decoded) })
        .catch((error) => {
          console.error('Audio load error', path, error)
          const projectPath = assetPath(path)
          if (projectPath) {
            throw new AssetRuntimeError(
              'ASSET_LOAD_FAILED',
              `Could not load audio asset "${projectPath}": ${error instanceof Error ? error.message : String(error)}`
            )
          }
          throw error
        })
      tasks.push(p)
    }
  }
  await Promise.all(tasks)
}

export const cleanupAudioData = async (): Promise<void> => {
  stopAll()
  loadedAudio.clear()
  registeredAudios.clear()
}

// Fire immediately at offset 0 (used when the “tick” with a play event is reached)
export const playAudio = (audioPath: string, volume: number = 1): PlayingId | null => {
  return startBufferAtOffset(audioPath, 0, volume, /*startTick*/ 0)
}

// Called when the timeline jumps to a specific tick.
// Rebuilds audio as if we had been playing since their respective start ticks.
export const seekToTick = (
  tick: number,
  planned: Map<number, AudioInScene[]>,
  timelineFPS: number
) => {
  stopAll()

  for (const [startTick, list] of planned.entries()) {
    // Sounds beginning on the requested tick are started by that tick's trace.
    // Recreating them here as well would play the same source twice.
    if (startTick >= tick) continue
    for (const item of list) {
      const buf = loadedAudio.get(item.audioPath)
      if (!buf) continue
      const elapsedTicks = tick - startTick
      const offsetSec = Math.max(0, elapsedTicks / timelineFPS)
      if (offsetSec < buf.duration) {
        startBufferAtOffset(item.audioPath, offsetSec, item.volume, startTick)
      }
    }
  }
}

// Pause = capture offsets, stop sources; Resume = recreate new sources at captured offsets
export const pauseAll = () => {
  // capture and stop
  for (const p of active) {
    if (!p.source) continue
    const playedSec = audioContext.currentTime - p.startedCtxTime
    const accumulated = p.offsetAtStartSec + playedSec
    // replace with a paused placeholder (no source)
    try { p.source.stop(0) } catch {}
    p.source.disconnect()
    p.source = null
    p.offsetAtStartSec = accumulated
  }
}

export const resumeAll = () => {
  for (const p of active) {
    if (p.source) continue
    // restart from stored offset
    rearmSource(p, p.offsetAtStartSec)
  }
}

export const stopAll = () => {
  for (const p of active) {
    try { p.source?.stop(0) } catch {}
    try { p.source?.disconnect() } catch {}
    try { p.gain.disconnect() } catch {}
  }
  active = []
}

// -------- helpers --------

function startBufferAtOffset(
  audioPath: string,
  offsetSec: number,
  volume: number,
  startTick: number
): PlayingId | null {
  const buf = loadedAudio.get(audioPath)
  if (!buf) {
    console.warn(`Audio not loaded: ${audioPath}`)
    return null
  }
  const id = newId()
  const gain = audioContext.createGain()
  gain.gain.value = volume
  gain.connect(audioContext.destination)

  const node = audioContext.createBufferSource()
  node.buffer = buf
  node.connect(gain)

  const startedCtxTime = audioContext.currentTime
  node.start(0, offsetSec)

  const playing: PlayingSound = {
    id,
    path: audioPath,
    source: node,
    gain,
    volume,
    startTick,
    startedCtxTime,
    offsetAtStartSec: offsetSec,
    durationSec: buf.duration
  }

  // remove from active when ends
  node.onended = () => {
    active = active.filter(a => a.id !== id)
    try { node.disconnect() } catch {}
    try { gain.disconnect() } catch {}
  }

  active.push(playing)
  return id
}

function rearmSource(p: PlayingSound, offsetSec: number) {
  const buf = loadedAudio.get(p.path)
  if (!buf) return
  const node = audioContext.createBufferSource()
  node.buffer = buf
  node.connect(p.gain)
  p.startedCtxTime = audioContext.currentTime
  p.offsetAtStartSec = offsetSec
  p.source = node
  node.onended = () => {
    active = active.filter(a => a.id !== p.id)
    try { node.disconnect() } catch {}
  }
  node.start(0, offsetSec)
}
