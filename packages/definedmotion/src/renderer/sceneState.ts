const sceneParameter = 'scene'
const frameParameter = 'frame'

export const updateStateInUrl = (sceneId: string, frame: number): void => {
  const url = new URL(window.location.href)
  url.searchParams.set(sceneParameter, sceneId)
  url.searchParams.set(frameParameter, frame.toString())
  window.history.replaceState(null, '', url.toString())
}

export const restoredFrameForScene = (sceneId: string): number | undefined => {
  const url = new URL(window.location.href)
  if (url.searchParams.get(sceneParameter) !== sceneId) return undefined
  const frame = Number(url.searchParams.get(frameParameter))
  return Number.isInteger(frame) && frame >= 0 ? frame : undefined
}
