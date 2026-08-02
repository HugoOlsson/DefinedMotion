import { SceneRuntimeError } from '../scene/sceneErrors'

export const validateVideoDimensions = (width: number, height: number): void => {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new SceneRuntimeError(
      'INVALID_VIDEO_DIMENSIONS',
      `Video dimensions must be positive integers; received ${width}×${height}`
    )
  }

  if (width % 2 !== 0 || height % 2 !== 0) {
    throw new SceneRuntimeError(
      'INVALID_VIDEO_DIMENSIONS',
      `Video dimensions must both be even for H.264 yuv420p output; received ${width}×${height}`
    )
  }
}
