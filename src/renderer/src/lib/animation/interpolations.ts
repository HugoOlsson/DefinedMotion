import { millisToTicks } from './helpers'

export const concatInterpols = (...interpolations: number[][]) => {
  return interpolations.reduce((acc, curr) => acc.concat(curr), [])
}

export const easeConstant = (start: number, duration: number): number[] => {
  const numFrames = millisToTicks(duration)
  return new Array(numFrames).fill(start)
}

export const easeLinear = (start: number, end: number, duration: number): number[] => {
  const numFrames = millisToTicks(duration)
  const values: number[] = []
  for (let i = 0; i < numFrames; i++) {
    const t = i / (numFrames - 1)
    values.push(start + (end - start) * t)
  }
  return values
}

export const easeInOutQuad = (start: number, end: number, duration: number): number[] => {
  const numFrames = millisToTicks(duration)
  const values: number[] = []
  for (let i = 0; i < numFrames; i++) {
    // Normalize current step to a value between 0 and 1.
    const t = i / (numFrames - 1)
    // Apply the quadratic easeInOut formula.
    let eased: number
    if (t < 0.5) {
      eased = 2 * t * t
    } else {
      eased = -1 + (4 - 2 * t) * t
    }
    // Interpolate between start and end.
    const value = start + (end - start) * eased
    values.push(value)
  }
  return values
}

export const rubberband = (start: number, end: number, duration: number): number[] => {
  const numFrames = millisToTicks(duration)
  const values: number[] = []
  const overshoot = 1.70158 // Controls overshoot amount (1.70158 = 10% overshoot)

  for (let i = 0; i < numFrames; i++) {
    const t = i / (numFrames - 1)
    let eased: number

    if (t === 0) {
      eased = 0
    } else if (t === 1) {
      eased = 1
    } else {
      eased = 1 + (overshoot + 1) * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2)
    }

    const value = start + (end - start) * eased
    values.push(value)
  }
  return values
}

/**
 * Interpolates a vector to a new size using linear interpolation.
 *
 * @param vector - The original array of numbers.
 * @param newSize - The desired size of the new vector (should be >= original size).
 * @returns A new array of numbers with the interpolated values.
 */
export const interpolateVector = (vector: number[], newSize: number): number[] => {
  const originalSize = vector.length
  if (newSize < originalSize) {
    throw new Error('New size must be greater than or equal to the original size.')
  }

  const result: number[] = []
  // Calculate the step in the original vector for each new element.
  const step = (originalSize - 1) / (newSize - 1)

  for (let i = 0; i < newSize; i++) {
    // Determine the position in the original array
    const pos = i * step
    const index = Math.floor(pos)
    const remainder = pos - index

    // If pos falls exactly on an original index, just use it.
    if (remainder === 0 || index === originalSize - 1) {
      result.push(vector[index])
    } else {
      // Linear interpolation between vector[index] and vector[index + 1]
      const interpolatedValue = vector[index] * (1 - remainder) + vector[index + 1] * remainder
      result.push(interpolatedValue)
    }
  }

  return result
}

export const compressVector = (vector: number[], newSize: number): number[] => {
  const originalSize = vector.length
  if (newSize > originalSize) {
    throw new Error('New size must be smaller than or equal to the original size.')
  }
  if (newSize === originalSize) return [...vector]

  const result: number[] = []
  const blockSize = originalSize / newSize

  for (let i = 0; i < newSize; i++) {
    const start = i * blockSize
    const end = start + blockSize

    // Collect all values overlapping with the current block
    let sum = 0
    let count = 0
    for (let j = Math.floor(start); j < Math.ceil(end); j++) {
      // Weight by overlap fraction (handles partial overlaps)
      const overlapStart = Math.max(start, j)
      const overlapEnd = Math.min(end, j + 1)
      const weight = overlapEnd - overlapStart

      sum += vector[j] * weight
      count += weight
    }
    result.push(sum / count)
  }

  return result
}

/**
 * Applies random noise in place to each element of a number vector.
 *
 * @param vector - The array of numbers to be modified.
 * @param noiseLevel - The maximum absolute noise to add to each element.
 */
export const noiseOnInterpolation = (vector: number[], noiseLevel: number): void => {
  for (let i = 0; i < vector.length; i++) {
    // Generate noise in the range [-noiseLevel, noiseLevel]
    const noise = (Math.random() * 2 - 1) * noiseLevel
    vector[i] += noise
  }
}

export const posXSigmoid = (x: number): number => {
  x = Math.abs(x)
  if (x < 0) return 0

  // Standard sigmoid is 1/(1+e^(-x))
  // At x=0, sigmoid(0) = 0.5
  // Shifting down by 0.5 and scaling by 2 gives us 0 at x=0
  return 2 * (1 / (1 + Math.exp(-x)) - 0.5)
}
