import { fps } from '../../scenes/entry'

const fs = require('fs')
const { exec } = require('child_process')

export const captureCanvasFrame = async (
  currentFrameIndex: number,
  renderName: string,
  canvas: HTMLCanvasElement
) => {
  try {
    // Create the directory structure if it doesn't exist
    const dirPath = 'image_renders' + '/' + `render_${renderName}`

    // Use fs.mkdirSync with recursive option to create nested directories
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    // Generate filename with padded frame number (e.g., frame_00001.png)
    const paddedIndex = currentFrameIndex.toString().padStart(5, '0')
    const filename = `frame_${paddedIndex}.png`
    const filePath = dirPath + '/' + filename

    // Get the canvas data as a data URL (PNG format)
    const dataURL = canvas.toDataURL('image/png')

    // Convert the data URL to a buffer
    // Remove the data URL header (data:image/png;base64,)
    const base64Data = dataURL.replace(/^data:image\/png;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // Write the file
    await fs.promises.writeFile(filePath, imageBuffer)

    console.log(`Saved frame ${currentFrameIndex} to ${filePath}`)
    return filePath
  } catch (error) {
    console.error('Error saving canvas frame:', error)
    throw error
  }
}

export const triggerEncoder = () => {
  exec('./rust-media/target/release/rust-media ' + fps.toString(), (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command: ${error}`)
      return
    }
    console.log(`stdout: ${stdout}`)
    console.error(`stderr: ${stderr}`)
  })
}
