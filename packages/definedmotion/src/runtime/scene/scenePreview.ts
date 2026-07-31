import { SceneRuntimeError } from './sceneErrors'

export interface AnimationFrameRange {
  readonly startFrame: number
  readonly endFrame: number
}

export interface ScenePreviewMarker {
  readonly frame: number
  readonly beat?: string
}

export const validatePreviewMarker = (
  markerFrame: number,
  sceneDurationFrames: number,
  crossingAnimation?: AnimationFrameRange
): void => {
  if (
    !Number.isInteger(markerFrame) ||
    markerFrame < 0 ||
    markerFrame >= sceneDurationFrames
  ) {
    throw new SceneRuntimeError(
      'INVALID_PREVIEW_MARKER',
      `Invalid preview marker at frame ${markerFrame}: the scene contains frames 0-${Math.max(0, sceneDurationFrames - 1)}.`
    )
  }

  if (crossingAnimation) {
    throw new SceneRuntimeError(
      'INVALID_PREVIEW_MARKER',
      `Invalid preview marker at frame ${markerFrame}: animation ` +
        `[${crossingAnimation.startFrame}, ${crossingAnimation.endFrame}) crosses the marker.`
    )
  }
}

export const effectiveViewerFrame = (
  requestedFrame: number,
  sceneDurationFrames: number,
  markerFrame: number | undefined,
  usePreviewMarker: boolean
): number => {
  const minimumFrame = usePreviewMarker && markerFrame !== undefined ? markerFrame : 0
  if (!Number.isFinite(requestedFrame)) return minimumFrame
  const normalizedFrame = Math.round(requestedFrame)
  if (normalizedFrame < minimumFrame || normalizedFrame >= sceneDurationFrames) {
    return minimumFrame
  }
  return normalizedFrame
}
