import { HotReloadSetting, type AnimatedScene } from '../scene/sceneClass'
import * as THREE from 'three'

const frameValueString = 'frameValueIndex'

export const generateID = (numCharacters: number = 10) =>
  Math.random().toString(numCharacters).substr(2, 9)

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

let lastStateText = ''

export const logCameraState = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
): void => {
  // Clone all values to prevent reference-related issues
  const position = camera.position.clone()
  const rotation = camera.rotation.clone()
  const quaternion = camera.quaternion.clone()

  // Format numbers to 7 significant digits and create code-ready string
  const stateCode = `
scene.camera.position.set(
  ${position.x.toPrecision(7)}, 
  ${position.y.toPrecision(7)}, 
  ${position.z.toPrecision(7)}
);

scene.camera.rotation.set(
  ${rotation.x.toPrecision(7)}, 
  ${rotation.y.toPrecision(7)}, 
  ${rotation.z.toPrecision(7)}
);

scene.camera.quaternion.set(
  ${quaternion.x.toPrecision(7)}, 
  ${quaternion.y.toPrecision(7)}, 
  ${quaternion.z.toPrecision(7)}, 
  ${quaternion.w.toPrecision(7)}
);

scene.camera.rotation.order = '${rotation.order}'; 
`

  // Only update DOM if state changed
  if (stateCode !== lastStateText) {
    lastStateText = stateCode
    const output = document.getElementById('cameraPositionTextID')
    if (output) {
      output.textContent = stateCode
      // Add CSS to preserve whitespace and line breaks
      output.style.whiteSpace = 'pre'
    }
  }
}
