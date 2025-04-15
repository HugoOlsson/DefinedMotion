import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

export interface RenderOptions {
  fps?: number
}

/**
 * Renders a video from image frames found in the latest "render" directory.
 * @param options - Configuration options for rendering.
 * @param options.fps - Frames per second to use (default is 30).
 * @returns A promise that resolves to the output file path.
 */
export function renderVideo({ fps = 30 }: RenderOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Converting frames to video at ${fps} fps`)

      // Define directories
      const rootDir = './image_renders'
      const outputDir = './rendered_videos'

      // Ensure output directory exists.
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      // Find the latest render directory.
      const latestDir = findLatestDir(rootDir)
      const dirName = path.basename(latestDir)
      console.log(`Processing directory: ${dirName}`)

      // Define the frame pattern and output file path.
      const framePattern = path.join(latestDir, 'frame_%05d.png')
      const outputFile = path.join(outputDir, `${dirName}.mp4`)

      // Build FFmpeg command arguments.
      const ffmpegArgs = [
        '-y', // Overwrite output if it exists.
        '-framerate',
        fps.toString(), // Set the frame rate.
        '-i',
        framePattern, // Input frames.
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'medium',
        '-crf',
        '23', // Quality/size balance.
        outputFile
      ]

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
      console.log(`Deleted render folder: ${latestDir}`)

      resolve(outputFile)
    } catch (err) {
      reject(err)
    }
  })
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
