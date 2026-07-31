import type { AnimatedScene } from '../runtime/scene/sceneClass'

const frameValueString = 'frameValueIndex'

export const updateStateInUrl = (stateValue: number) => {
  const url = new URL(window.location.href)
  url.searchParams.set(frameValueString, stateValue.toString())
  window.history.replaceState(null, '', url.toString())
}

export const setStateInScene = async (scene: AnimatedScene) => {
  const url = new URL(window.location.href)
  const stateParam = url.searchParams.get(frameValueString)

  if (stateParam) {
    const stateValue = parseInt(stateParam, 10)

    if (!isNaN(stateValue)) {
      console.log('Restored state:', stateValue)
      await scene.jumpToFrameAtIndex(stateValue)
      return
    } else {
      console.error('Invalid state parameter in URL')
    }
  }
  await scene.jumpToFrameAtIndex(0)
}
