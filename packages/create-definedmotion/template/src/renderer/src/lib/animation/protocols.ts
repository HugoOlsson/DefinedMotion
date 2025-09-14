import { compressVector, interpolateVector, noiseOnInterpolation } from './interpolations'

export interface DefinedAnimation {
  interpolation: number[]
  updater: UpdaterFunction
}

export class UserAnimation implements DefinedAnimation {
  interpolation: number[]
  updater: UpdaterFunction

  constructor(interpolation: number[], updater: UpdaterFunction) {
    this.interpolation = interpolation
    this.updater = updater
  }

  addNoise(scale: number = 1): this {
    noiseOnInterpolation(this.interpolation, scale)
    return this
  }

  scaleLength(scale: number): this {
    if (scale === 1) return this
    else if (scale > 1) {
      this.interpolation = interpolateVector(
        this.interpolation,
        Math.round(this.interpolation.length * scale)
      )
    } else {
      this.interpolation = compressVector(
        this.interpolation,
        Math.round(this.interpolation.length * scale)
      )
    }
    return this
  }

  sum(add: number[]): this {
    const maxLength = Math.max(this.interpolation.length, add.length)
    const newInterpolation: number[] = []

    for (let i = 0; i < maxLength; i++) {
      const a = this.interpolation[i] ?? 0 // Use 0 if undefined
      const b = add[i] ?? 0 // Use 0 if undefined
      newInterpolation[i] = a + b
    }

    this.interpolation = newInterpolation
    return this
  }

  reverse(): this {
    this.interpolation.reverse()
    return this
  }

  copy(): UserAnimation {
    return new UserAnimation([...this.interpolation], this.updater)
  }
}

export const createAnimNamed = (animation: DefinedAnimation): UserAnimation => {
  return new UserAnimation(animation.interpolation, animation.updater)
}

export const createAnim = (interpolation: number[], updater: UpdaterFunction): UserAnimation => {
  return new UserAnimation(interpolation, updater)
}

export interface InternalAnimation {
  startTick: number
  endTick: number
  interpolation: number[]
  updater: UpdaterFunction
}

export type DependencyUpdater = (sceneTick: number, time: number) => any

export type UpdaterFunction = (interpolation: number, sceneTick: number, isLast: boolean) => any
