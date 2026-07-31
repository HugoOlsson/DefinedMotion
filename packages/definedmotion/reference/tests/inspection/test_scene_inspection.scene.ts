import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { defineScene } from 'definedmotion'
import { createRectangle } from 'definedmotion/rendering'
import {
  AnimatedScene,
  SceneRuntimeError,
  SpaceSetting
} from 'definedmotion'

export default defineScene({
  id: 'test-scene-inspection',
  name: 'Scene Inspection',
  isTest: true,
  create: testSceneInspection
})

export function testSceneInspection(): AnimatedScene {
  return new AnimatedScene(
    400,
    200,
    SpaceSetting.TwoDim,
    (scene) => {
      const subject = scene.expose('subject', createRectangle(4, 2, { color: '#22d3ee' }), {
        description: 'Primary rectangle used by the inspection regression test',
        tags: ['shape', 'primary-subject'],
        data: { purpose: 'inspection-test', order: 1, active: true }
      })
      assertSceneError(() => scene.expose('subject', new THREE.Object3D()), 'DUPLICATE_EXPOSED_ID')
      assertSceneError(() => scene.expose('subject-alias', subject), 'DUPLICATE_EXPOSED_OBJECT')
      subject.name = 'Subject Rectangle'
      subject.position.set(-5, 3, 0)
      scene.add(subject)

      const overviewCamera = scene.exposeCamera(
        'overview',
        new THREE.PerspectiveCamera(50, scene.width / scene.height, 0.1, 100),
        {
          description: 'Perspective overview of the inspection subject',
          tags: ['overview'],
          data: { purpose: 'camera-regression' }
        }
      )
      overviewCamera.position.set(-5, 3, 20)
      overviewCamera.lookAt(subject.position)
      assertSceneError(
        () => scene.exposeCamera('overview', new THREE.PerspectiveCamera()),
        'DUPLICATE_EXPOSED_CAMERA_ID'
      )
      assertSceneError(
        () => scene.exposeCamera('overview-alias', overviewCamera),
        'DUPLICATE_EXPOSED_CAMERA'
      )
      assertSceneError(
        () => scene.exposeCamera('main', new THREE.PerspectiveCamera()),
        'RESERVED_CAMERA_ID'
      )

      const trackingCamera = scene.exposeCamera(
        'tracking',
        new THREE.OrthographicCamera(-10, 10, 5, -5, 0.1, 100),
        {
          description: 'Orthographic camera that moves horizontally as the frame advances',
          tags: ['dynamic', 'tracking']
        }
      )
      trackingCamera.position.set(0, 0, 30)
      trackingCamera.lookAt(subject.position)

      const labelGroup = scene.expose('label-group', new THREE.Group())
      labelGroup.position.set(8, -4, 0)
      const hiddenLabel = scene.expose(
        'hidden-label',
        createRectangle(2, 2, { color: '#f97316' })
      ) as THREE.Object3D & { text: string }
      hiddenLabel.text = 'Hidden label'
      hiddenLabel.position.set(1, 2, 0)
      hiddenLabel.visible = false
      labelGroup.add(hiddenLabel)
      scene.add(labelGroup)

      const detached = scene.expose('detached-guide', createRectangle(1, 1))
      detached.position.set(100, 100, 0)

      scene.onEachTick((frame) => {
        trackingCamera.position.x = frame / 10
        trackingCamera.lookAt(subject.position)
      })

      scene.addAnims(wait((1000) / 1000))
    }
  )
}

const assertSceneError = (operation: () => void, code: string): void => {
  try {
    operation()
  } catch (error) {
    if (error instanceof SceneRuntimeError && error.code === code) return
    throw error
  }
  throw new SceneRuntimeError('INSPECTION_TEST_FAILED', `Expected scene error ${code}`)
}
