import { HotReloadSetting, type AnimatedScene } from '../runtime/scene/sceneClass'

const frameValueString = 'frameValueIndex'

export const updateStateInUrl = (stateValue: number) => {
  const url = new URL(window.location.href)
  url.searchParams.set(frameValueString, stateValue.toString())
  window.history.replaceState(null, '', url.toString())
}

export const clearStateInUrl = () => {
  const url = new URL(window.location.href)
  url.searchParams.delete(frameValueString)
  window.history.replaceState(null, '', url.toString())
}


export const setStateInScene = async (scene: AnimatedScene) => {

   // If the user wants a completely fresh start on each rebuild, ignore URL state.
  if (scene.hotReloadSetting === HotReloadSetting.BeginFreshOnSave) {
    clearStateInUrl()                 // optional, but keeps URL tidy
    await scene.jumpToFrameAtIndex(0) // fully fresh
    return
  }

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
