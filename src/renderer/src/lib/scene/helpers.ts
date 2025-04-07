import * as THREE from 'three'

export const placeNextTo = (
  target: THREE.Object3D,
  objectToPlace: THREE.Object3D,
  axis: string = 'X',
  padding: number = 0 // New padding parameter
) => {
  const targetBox = new THREE.Box3().setFromObject(target)
  const objectBox = new THREE.Box3().setFromObject(objectToPlace)

  const direction = axis.startsWith('-') ? -1 : 1
  const axisIndex = axis.toUpperCase().replace('-', '')[0]
  let axisNum

  switch (axisIndex) {
    case 'X':
      axisNum = 0
      break
    case 'Y':
      axisNum = 1
      break
    case 'Z':
      axisNum = 2
      break
    default:
      throw new Error('Invalid axis. Use X, Y, Z or -X, -Y, -Z')
  }

  const targetEdge = direction === 1 ? targetBox.max : targetBox.min
  const objectEdge = direction === 1 ? objectBox.min : objectBox.max

  const delta = new THREE.Vector3()
  // Add padding calculation here
  const componentDelta =
    targetEdge.getComponent(axisNum) - objectEdge.getComponent(axisNum) + direction * padding // Modified line for padding

  delta.setComponent(axisNum, componentDelta)

  const worldPosition = new THREE.Vector3()
  objectToPlace.getWorldPosition(worldPosition)
  worldPosition.add(delta)

  if (objectToPlace.parent) {
    objectToPlace.parent.worldToLocal(worldPosition)
  }

  objectToPlace.position.copy(worldPosition)
  objectToPlace.updateMatrixWorld()
}

export const getPositionNextTo = (
  target: THREE.Object3D,
  objectToPlace: THREE.Object3D,
  axis: string = 'X',
  padding: number = 0
): THREE.Vector3 => {
  const targetBox = new THREE.Box3().setFromObject(target)
  const objectBox = new THREE.Box3().setFromObject(objectToPlace)
  const direction = axis.startsWith('-') ? -1 : 1
  const axisIndex = axis.toUpperCase().replace('-', '')[0]
  let axisNum
  switch (axisIndex) {
    case 'X':
      axisNum = 0
      break
    case 'Y':
      axisNum = 1
      break
    case 'Z':
      axisNum = 2
      break
    default:
      throw new Error('Invalid axis. Use X, Y, Z or -X, -Y, -Z')
  }
  const targetEdge = direction === 1 ? targetBox.max : targetBox.min
  const objectEdge = direction === 1 ? objectBox.min : objectBox.max
  const delta = new THREE.Vector3()
  const componentDelta =
    targetEdge.getComponent(axisNum) - objectEdge.getComponent(axisNum) + direction * padding
  delta.setComponent(axisNum, componentDelta)
  const worldPosition = new THREE.Vector3()
  objectToPlace.getWorldPosition(worldPosition)
  worldPosition.add(delta)
  if (objectToPlace.parent) {
    objectToPlace.parent.worldToLocal(worldPosition)
  }
  return worldPosition
}
