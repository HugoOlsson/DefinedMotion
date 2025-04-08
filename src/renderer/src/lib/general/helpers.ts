import type { AnimatedScene } from '../scene/sceneClass'
import * as THREE from 'three'

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

let lastPosText = ''
let lastRotText = ''
export const setCameraPositionText = (
  position: THREE.Vector3,
  rotation: THREE.Euler,
  quaternion?: THREE.Quaternion
): void => {
  const posRef = document.getElementById('cameraPositionTextID')
  const rotRef = document.getElementById('cameraRotationTextID')
  if (!posRef || !rotRef) return // Exit if elements are not found

  // Construct the new position text with specified precision
  const newPosText: string =
    'Camera position: (' +
    position.x.toPrecision(7) +
    ', ' +
    position.y.toPrecision(7) +
    ', ' +
    position.z.toPrecision(7) +
    ')'

  // Construct the new Euler rotation text, including the rotation order
  let newRotText: string =
    'Camera rotation (Euler): (' +
    rotation.x.toPrecision(7) +
    ', ' +
    rotation.y.toPrecision(7) +
    ', ' +
    rotation.z.toPrecision(7) +
    ') - Order: ' +
    rotation.order

  // Optionally append quaternion details if provided
  if (quaternion) {
    newRotText +=
      '\nQuaternion: (' +
      quaternion.x.toPrecision(7) +
      ', ' +
      quaternion.y.toPrecision(7) +
      ', ' +
      quaternion.z.toPrecision(7) +
      ', ' +
      quaternion.w.toPrecision(7) +
      ')'
  }

  // Update the DOM only if the content has changed to avoid unnecessary DOM operations
  if (newPosText !== lastPosText) {
    lastPosText = newPosText
    posRef.textContent = newPosText
  }

  if (newRotText !== lastRotText) {
    lastRotText = newRotText
    rotRef.textContent = newRotText
  }
}
