import * as THREE from 'three'

export interface BumpMapOptions {
  /** Width of the bump map canvas (default: 256) */
  width?: number
  /** Height of the bump map canvas (default: 256) */
  height?: number
  /**
   * Noise algorithm to use; currently supports:
   * - "random": pure random noise (default)
   * - "perlin": placeholder (requires additional implementation)
   */
  noiseAlgorithm?: 'random' | 'perlin'
  /**
   * Intensity multiplier for the noise values.
   * Higher values result in a wider contrast between low and high bumps (default: 1).
   */
  intensity?: number
}

/**
 * Generates a bump map as a THREE.CanvasTexture.
 *
 * @param options - Customization options for the bump map
 * @returns A THREE.CanvasTexture that can be assigned as a bumpMap in a material.
 */
export function createBumpMap(options?: BumpMapOptions): THREE.CanvasTexture {
  // Set default options
  const { width = 256, height = 256, noiseAlgorithm = 'random', intensity = 1 } = options || {}

  // Create a canvas element and get its 2d rendering context
  const canvas: HTMLCanvasElement = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Could not get canvas 2D context.')
  }

  // Create an ImageData object to manipulate pixel values directly
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  // Depending on the noise algorithm choose how to fill the canvas
  if (noiseAlgorithm === 'random') {
    // For each pixel, set a random grayscale value
    for (let i = 0; i < width * height; i++) {
      // Compute the index in the data array. Each pixel takes 4 values (RGBA)
      const index = i * 4
      // A random value in [0, 255] multiplied by the intensity factor,
      // clamped to the [0, 255] range.
      const value = Math.min(255, Math.floor(Math.random() * 255 * intensity))
      data[index] = value // R
      data[index + 1] = value // G
      data[index + 2] = value // B
      data[index + 3] = 255 // A (opaque)
    }
  } else if (noiseAlgorithm === 'perlin') {
    // Placeholder for perlin noise: you would implement or integrate
    // a Perlin noise function here. For now, we'll default to random noise.
    console.warn('Perlin noise algorithm not implemented. Falling back to random noise.')
    for (let i = 0; i < width * height; i++) {
      const index = i * 4
      const value = Math.min(255, Math.floor(Math.random() * 255 * intensity))
      data[index] = value
      data[index + 1] = value
      data[index + 2] = value
      data[index + 3] = 255
    }
  }

  // Put the generated pixel data back into the canvas
  ctx.putImageData(imageData, 0, 0)

  // Create a THREE.CanvasTexture from the canvas and return it.
  const bumpTexture = new THREE.CanvasTexture(canvas)

  // Optionally, if you need specific properties such as wrapping:
  // bumpTexture.wrapS = THREE.RepeatWrapping;
  // bumpTexture.wrapT = THREE.RepeatWrapping;

  return bumpTexture
}
