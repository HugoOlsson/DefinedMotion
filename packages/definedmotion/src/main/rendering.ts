import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { assetUrlToFilePath } from './assets'
import { mixAudioEvents, runProcess } from './audioMixer'
import { emitRenderProgress } from './renderProgress'
import {
  getAudioCacheRoot,
  getFrameCacheRoot,
  getProjectRoot,
  getRenderOutputRoot
} from '../projectPaths'
import { validateVideoDimensions } from '../runtime/rendering/videoDimensions'

export interface AudioInScene {
  audioPath: string
  fsPath?: string
  volume: number
  atFrame: number
}

export interface RenderOptions {
  fps: number
  width: number
  height: number
  renderingAudioGather: AudioInScene[]
  outputFile?: string
  renderName?: string
  frameCount?: number
}

export const generateID = (numCharacters: number = 10) =>
  Math.random().toString(numCharacters).substr(2, 9)

/**
 * Renders a video from image frames found in the latest "render" directory.
 * @param options - Configuration options for rendering.
 * @param options.fps - Frames per second to use (default is 30).
 * @returns A promise that resolves to the output file path.
 */
export async function renderVideo(options: RenderOptions): Promise<string> {
  validateVideoDimensions(options.width, options.height)

  console.log(`Converting frames to video at ${options.fps} fps`)

  const rootDir = getFrameCacheRoot()
  const audioRendersDir = getAudioCacheRoot()
  const outputDir = getRenderOutputRoot()
  fs.mkdirSync(outputDir, { recursive: true })
  fs.mkdirSync(audioRendersDir, { recursive: true })

  const audioID = generateID(10)
  const audioEvents = options.renderingAudioGather
    .filter((audio) => audio.volume !== 0)
    .map((audio) => ({
      sourcePath: audio.fsPath ?? toFsPath(audio.audioPath),
      volume: audio.volume,
      atFrame: audio.atFrame
    }))
  const includeAudio = audioEvents.length > 0
  const audioFile = path.join(audioRendersDir, `${audioID}.wav`)

  if (includeAudio) {
    const mixResult = await mixAudioEvents({
      events: audioEvents,
      fps: options.fps,
      outputFile: audioFile,
      workingDirectory: audioRendersDir
    })
    console.log(
      `Audio created in ${mixResult.durationSeconds.toFixed(2)} seconds ` +
        `(${mixResult.coalescedEventCount} placements)`
    )
  }

  const latestDir = options.renderName
    ? path.join(rootDir, `render_${options.renderName}`)
    : findLatestDir(rootDir)
  const dirName = path.basename(latestDir)
  console.log(`Processing directory: ${dirName}`)

  const framePattern = path.join(latestDir, 'frame_%05d.jpeg')
  const outputFile = options.outputFile
    ? path.resolve(options.outputFile)
    : path.join(outputDir, `${dirName}.mp4`)
  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  const frameCount =
    options.frameCount ??
    fs.readdirSync(latestDir).filter((entry) => /^frame_\d{5}\.jpeg$/.test(entry)).length
  const ffmpegArguments = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    options.fps.toString(),
    '-i',
    framePattern
  ]

  if (includeAudio) ffmpegArguments.push('-i', audioFile)
  ffmpegArguments.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p')
  if (includeAudio) {
    ffmpegArguments.push('-c:a', 'aac', '-af', 'apad', '-shortest')
  }
  ffmpegArguments.push('-preset', 'fast', '-crf', '23', outputFile)

  console.log('Encoding final video...')
  emitRenderProgress({
    phase: 'encoding-video',
    message: 'Encoding final video',
    completed: 0,
    total: frameCount,
    percent: 0
  })
  await runProcess('ffmpeg', ffmpegArguments)
  console.log(`Video created successfully: ${outputFile}`)

  fs.rmSync(latestDir, { recursive: true, force: true })
  if (includeAudio) fs.rmSync(audioFile, { force: true })
  console.log(`Deleted render folder: ${latestDir}`)
  emitRenderProgress({
    phase: 'complete',
    message: 'Render complete',
    completed: frameCount,
    total: frameCount,
    percent: 100
  })
  return outputFile
}


function toFsPath(p: string): string {
  if (!p) throw new Error('empty path')

  const projectAssetPath = assetUrlToFilePath(p)
  if (projectAssetPath) return projectAssetPath

  // Handle Vite dev absolute path
  if (p.startsWith('/@fs/')) {
    return decodeURIComponent(p.slice(4))
  }

  try {
    const u = new URL(p)
    if (u.protocol === 'file:') return fileURLToPath(u)
  } catch {/* not a URL */}

  if (path.isAbsolute(p)) return p

  const cleaned = p.replace(/^\/?assets\//, '')
  const guesses = [
    path.join(getProjectRoot(), 'src', 'renderer', 'assets', cleaned),
    path.join(process.resourcesPath, 'assets', cleaned),
    path.join(getProjectRoot(), cleaned)
  ]
  for (const g of guesses) {
    if (fs.existsSync(g)) return g
  }

  return p
}

/**
 * Finds the most recent directory in the given path that starts with "render".
 * @param dirPath - The root directory to search.
 * @returns The full path of the latest render directory.
 * @throws If the directory does not exist or no render directories are found.
 */
function findLatestDir(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`)
  }

  const entries = fs.readdirSync(dirPath)
  let newestDir: string | null = null
  let newestTime = 0 // milliseconds

  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory() && entry.startsWith('render')) {
      // Prefer creation time if available; fallback to modified time.
      const time = stat.birthtimeMs || stat.mtimeMs
      if (time > newestTime) {
        newestTime = time
        newestDir = fullPath
      }
    }
  })

  if (!newestDir) {
    throw new Error('No render directories found')
  }
  return newestDir
}
