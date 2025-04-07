import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export interface SceneComponents {
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  controls: OrbitControls
}

export const RERENDER = (state: SceneComponents) => {
  state.renderer.render(state.scene, state.camera)
}

export const ADD = (state: SceneComponents, element: THREE.Mesh) => {
  state.scene.add(element)
}

export const REMOVE = (state: SceneComponents, element: THREE.Mesh) => {
  state.scene.remove(element)
}
