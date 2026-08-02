import type { CurvePath, CurveVisual } from '../visuals/curve'
import {
  applyCurveMorph,
  captureCurveSnapshot,
  sampleTargetCurvePath
} from '../visuals/curve'
import type { AnimationOptions } from './effects'
import type { AnimationPlan, Easing } from './plan'

export interface CurveMorphOptions extends AnimationOptions {}

const DEFAULT_DURATION = 0.5
const DEFAULT_EASING: Easing = 'ease-in-out'

const morphTo = (
  visual: CurveVisual,
  target: CurvePath,
  options: CurveMorphOptions = {}
): AnimationPlan => ({
  duration: options.duration ?? DEFAULT_DURATION,
  easing: options.easing ?? DEFAULT_EASING,
  bind() {
    const from = captureCurveSnapshot(visual)
    const to = sampleTargetCurvePath(visual, target)
    return {
      update({ easedProgress }) {
        applyCurveMorph(visual, from, to, easedProgress)
      }
    }
  }
})

export const curve = Object.freeze({ morphTo })
