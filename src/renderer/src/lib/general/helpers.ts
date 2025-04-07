import type { AnimatedScene } from '../scene/sceneClass'

const frameValueString = 'frameValueIndex'

export const generateID = (numCharacters: number = 10) =>
  Math.random().toString(numCharacters).substr(2, 9)

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
