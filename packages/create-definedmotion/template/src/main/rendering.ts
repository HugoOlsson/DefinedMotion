import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

export interface AudioInScene {
  audioPath: string
  volume: number
  atFrame: number
}

export interface RenderOptions {
  fps: number
  width: number
  height: number
  renderingAudioGather: AudioInScene[]
}

export const generateID = (numCharacters: number = 10) =>
  Math.random().toString(numCharacters).substr(2, 9)

/**
 * Renders a video from image frames found in the latest "render" directory.
 * @param options - Configuration options for rendering.
 * @param options.fps - Frames per second to use (default is 30).
 * @returns A promise that resolves to the output file path.
 */
export function renderVideo(options: RenderOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Converting frames to video at ${options.fps} fps`)

      //  console.log('THE AUDIO DATA IS', options.renderingAudioGather)

      // Define directories
      const rootDir = './image_renders'
      const audioRendersDir = './audio_renders'
      const outputDir = './rendered_videos'

      // Ensure output directory exists.
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      // Ensure output directory exists.
      if (!fs.existsSync(audioRendersDir)) {
        fs.mkdirSync(audioRendersDir, { recursive: true })
      }
      const audioID = generateID(10)
      const includeAudio = options.renderingAudioGather.length > 0
      if (includeAudio) {
        const audioCommand = buildAudioMixCommand(options, audioRendersDir, audioID)

        console.log(`Building audio...`)
        const audioResult = spawnSync(audioCommand, { stdio: 'inherit', shell: true })
        if (audioResult.status !== 0) {
          return reject(new Error('FFmpeg command failed'))
        }
      }

      // Find the latest render directory.
      const latestDir = findLatestDir(rootDir)
      const dirName = path.basename(latestDir)
      console.log(`Processing directory: ${dirName}`)

      // Define the frame pattern and output file path.
      const framePattern = path.join(latestDir, 'frame_%05d.jpeg')
      const outputFile = path.join(outputDir, `${dirName}.mp4`)

      // Start building the ffmpeg arguments array.
      const ffmpegArgs = [
        '-y', // Overwrite output if it exists.
        '-framerate',
        options.fps.toString(), // Frame rate for the video.
        '-i',
        framePattern // Input frames pattern.
      ]

      // Conditionally add the audio input if needed.
      if (includeAudio) {
        ffmpegArgs.push(
          '-i',
          `${audioRendersDir}/${audioID}.mp3` // Input audio file.
        )
      }

      // Common encoding parameters for video.
      ffmpegArgs.push(
        '-c:v',
        'libx264', // Video codec.
        '-pix_fmt',
        'yuv420p' // Pixel format.
      )

      // Conditionally add audio codec settings only if audio is included.
      if (includeAudio) {
        ffmpegArgs.push(
          '-c:a',
          'aac', // Audio codec.
          '-af',
          'apad', // <-- pad audio with silence
          '-shortest' // <-- cut output to shortest input (i.e. video)
        )
      }

      // Additional encoding options for both scenarios.
      ffmpegArgs.push(
        '-preset',
        'fast', // Preset for encoding speed/quality.
        '-crf',
        '23', // Quality/size balance.
        outputFile // Output file.
      )

      console.log('Executing FFmpeg command:')
      console.log(`ffmpeg ${ffmpegArgs.join(' ')}`)

      // Execute FFmpeg synchronously.
      const result = spawnSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' })
      if (result.status !== 0) {
        return reject(new Error('FFmpeg command failed'))
      }

      console.log(`Video created successfully: ${outputFile}`)

      // Delete the render directory with all its images.
      fs.rmSync(latestDir, { recursive: true, force: true })
      fs.readdirSync(audioRendersDir).forEach((item) => {
        const itemPath = path.join(audioRendersDir, item)
        fs.rmSync(itemPath, { recursive: true, force: true })
      })
      console.log(`Deleted render folder: ${latestDir}`)

      resolve(outputFile)
    } catch (err) {
      reject(err)
    }
  })
}


function toFsPath(p: string): string {
  if (!p) throw new Error('empty path')

    // Handle Vite dev absolute path
  if (p.startsWith('/@fs/')) {
    // Keep the leading slash before "Users"
    return decodeURIComponent(p.slice(4))  // results in "/Users/…"
    // Alternatively:
    // return decodeURIComponent(p.replace(/^\/@fs/, ''))
  }

  // 2) file:// URL
  try {
    const u = new URL(p)
    if (u.protocol === 'file:') return fileURLToPath(u)
  } catch {/* not a URL */}

  // 3) already absolute on disk
  if (path.isAbsolute(p)) return p

  // 4) fallback: try typical asset roots
  const cleaned = p.replace(/^\/?assets\//, '') // allow "assets/foo.mp3" or "/assets/foo.mp3"
  const guesses = [
    path.join(process.cwd(), 'src', 'renderer', 'assets', cleaned),     // dev
    path.join(process.resourcesPath, 'assets', cleaned),                 // prod packaged
    path.join(process.cwd(), cleaned)                                    // last resort
  ]
  for (const g of guesses) {
    if (fs.existsSync(g)) return g
  }

  // final fallback: return as-is (FFmpeg will error, but at least we see the attempted path)
  return p
}

function buildAudioMixCommand(renderOptions: RenderOptions, outputFolder: string, id: string) {
  const { fps, renderingAudioGather } = renderOptions
  let inputs: string[] = []
  let filters: string[] = []
  let inputIndexes: string[] = []

  renderingAudioGather.forEach((audio, index) => {
     // Prefer an already-provided absolute fsPath (if you later add it); else normalize here
    const inputPath = (audio as any).fsPath ?? toFsPath(audio.audioPath)
    inputs.push(`-i "${inputPath}"`)
    const delayMs = Math.floor((audio.atFrame / fps) * 1000)
    // adelay syntax: "adelay=delay_in_ms|delay_in_ms"
    filters.push(`[${index}:a]adelay=${delayMs}|${delayMs},volume=${audio.volume}[a${index}]`)
    inputIndexes.push(`[a${index}]`)
  })

  const filterComplex =
    filters.join('; ') +
    '; ' +
    inputIndexes.join('') +
    `amix=inputs=${renderingAudioGather.length}:duration=longest:normalize=0[out]`

  // Adding -hide_banner and -loglevel error to reduce terminal output.
  const command = `ffmpeg -hide_banner -loglevel error ${inputs.join(' ')} -filter_complex "${filterComplex}" -map "[out]" ${outputFolder}/${id}.mp3`
  return command
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
