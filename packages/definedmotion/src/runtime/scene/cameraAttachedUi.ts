import * as THREE from 'three'

export type AudienceCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera

/** Owns the audience-only render tree used by scene.addCameraAttachedUI(). */
export class CameraAttachedUiLayer {
  private readonly overlayScene = new THREE.Scene()
  private readonly overlayCamera: AudienceCamera
  private readonly roots = new Set<THREE.Object3D>()

  constructor(private readonly audienceCamera: AudienceCamera) {
    this.overlayScene.name = 'DefinedMotionCameraAttachedUIScene'
    this.overlayCamera = audienceCamera.clone(false) as AudienceCamera
    this.overlayCamera.name = 'DefinedMotionCameraAttachedUICamera'
    this.overlayScene.add(this.overlayCamera)
    this.syncCamera()
  }

  add<T extends THREE.Object3D>(root: T): T {
    if (this.roots.has(root)) return root
    this.overlayCamera.add(root)
    this.roots.add(root)
    return root
  }

  clear(): void {
    for (const root of this.roots) root.removeFromParent()
    this.roots.clear()
  }

  contains(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object
    while (current) {
      if (current === this.overlayScene) return true
      current = current.parent
    }
    return false
  }

  get root(): THREE.Object3D {
    return this.overlayScene
  }

  get size(): number {
    return this.roots.size
  }

  syncCamera(): void {
    this.audienceCamera.updateWorldMatrix(true, false)
    this.overlayCamera.copy(this.audienceCamera, false)
    this.audienceCamera.matrixWorld.decompose(
      this.overlayCamera.position,
      this.overlayCamera.quaternion,
      this.overlayCamera.scale
    )
    this.overlayCamera.updateMatrix()
    this.overlayCamera.updateWorldMatrix(true, false)
    this.overlayScene.updateMatrixWorld(true)
  }

  render(renderer: THREE.WebGLRenderer): void {
    if (this.roots.size === 0) return
    this.syncCamera()
    const originalAutoClear = renderer.autoClear
    try {
      renderer.autoClear = false
      renderer.clearDepth()
      renderer.render(this.overlayScene, this.overlayCamera)
    } finally {
      renderer.autoClear = originalAutoClear
    }
  }
}
