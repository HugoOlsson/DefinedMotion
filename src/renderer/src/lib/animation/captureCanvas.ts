import { renderOutputFps } from '../../scenes/entry'
import * as THREE from 'three'
import { AnimatedScene } from '../scene/sceneClass'
import { AudioInScene } from '../audio/loader'

const fs = require('fs')
const path = require('path')

export const captureCanvasFrame = async (
  currentFrameIndex: number,
  renderName: string,
  threeRenderer: THREE.WebGLRenderer
) => {
  try {
    const dirPath = path.join('image_renders', `render_${renderName}`)

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
  renderingAudioGather: AudioInScene[]
) => {
  try {
    // Call the exposed function via the 'api' object.
    const response = await (window as any).api.startVideoRender({
      fps: renderOutputFps(),
      width,
      height,
      renderingAudioGather
    })
    if (response.success) {
      console.log('Video rendered successfully at:', response.outputFile)
      // You can update the UI to show the output file path or provide a link to view it
    } else {
      console.error('Video render failed:', response.error)
    }
  } catch (error) {
    console.error('Error calling render:', error)
  }
  /*
  
  exec(
    './rust-media/target/release/rust-media ' + Math.round(renderOutputFps()).toString(),
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error}`)
        return
      }
      console.log(`stdout: ${stdout}`)
      console.error(`stderr: ${stderr}`)
    }
  )
    */
}
