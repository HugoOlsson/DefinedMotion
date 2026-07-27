
import * as THREE from 'three'
import { AnimatedScene, renderOutputFps } from '../scene/sceneClass'
import { AudioInScene } from '../audio'
import { getFrameCacheRoot } from '../../projectPaths'

const fs = require('fs')
const path = require('path')

export const captureCanvasFrame = async (
  currentFrameIndex: number,
  renderName: string,
  threeRenderer: THREE.WebGLRenderer
) => {
  try {
    const dirPath = path.join(getFrameCacheRoot(), `render_${renderName}`)

    // Create directory if needed
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    // Generate filename with .rgb extension
    const paddedIndex = currentFrameIndex.toString().padStart(5, '0')
    const filename = `frame_${paddedIndex}.jpeg`
    const filePath = path.join(dirPath, filename)

    // Get WebGL context and pixel data
    const canvas = threeRenderer.domElement

    // Use the canvas.toBlob method to capture a JPEG image.
    // Note: The quality parameter is between 0 and 1.
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    })

    // Convert the blob to an ArrayBuffer then to a Node.js Buffer.
    const arrayBuffer = await (blob as any).arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await fs.promises.writeFile(filePath, buffer)

    console.log(`Saved RAW frame ${currentFrameIndex} to ${filePath}`)
    return filePath
  } catch (error) {
    console.error('Error saving canvas frame:', error)
    throw error
  }
}
export const triggerEncoder = async (
  width: number,
  height: number,
  renderingAudioGather: AudioInScene[],
  options: {
    outputFile?: string
    renderName: string
    frameCount: number
  }
): Promise<string> => {
  try {
    // Call the exposed function via the 'api' object.
    const response = await (window as any).api.startVideoRender({
      fps: renderOutputFps(),
      width,
      height,
      renderingAudioGather,
      ...options
    })
    if (response.success) {
      console.log('Video rendered successfully at:', response.outputFile)
      if (!response.outputFile) throw new Error('Video render returned no output file')
      return response.outputFile
    } else {
      throw new Error(response.error ?? 'Video render failed')
    }
  } catch (error) {
    console.error('Error calling render:', error)
    throw error
  }
}
