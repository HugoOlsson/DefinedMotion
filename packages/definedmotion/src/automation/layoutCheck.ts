import * as THREE from 'three'
import { projectObjectBounds } from '../runtime/measurement'
import type { AnimatedScene, CollisionWatch, ExposedSceneObject } from '../runtime/scene/sceneClass'
import type {
  InspectScreenBounds,
  LayoutCheckAutomationRequest,
  LayoutCheckWarning,
  LayoutCollisionIncident,
  LayoutCollisionOverlap
} from './types'

type DraftIncident = Omit<LayoutCollisionIncident, 'id' | 'screenshotPath'>

interface LayoutCheckScan {
  checkedFrames: number
  watchedObjectCount: number
  incidents: DraftIncident[]
  warnings: LayoutCheckWarning[]
}

interface VisibleObjectBounds {
  object: THREE.Object3D
  bounds: InspectScreenBounds
}

interface FrameCollision {
  pairKey: string
  subjectId: string
  subjectText?: string
  obstacleId: string
  obstacleName?: string
  obstacleType: string
  obstaclePath: string
  paddingPx: number
  subjectBounds: InspectScreenBounds
  obstacleBounds: InspectScreenBounds
  overlapPixels: LayoutCollisionOverlap
}

interface OpenIncident extends DraftIncident {
  pairKey: string
  lastCollisionFrame: number
}

export interface LayoutCheckRun {
  checkedFrames: number
  watchedObjectCount: number
  incidents: LayoutCollisionIncident[]
  warnings: LayoutCheckWarning[]
}

export const runLayoutCheck = async (
  request: LayoutCheckAutomationRequest,
  scene: AnimatedScene
): Promise<LayoutCheckRun> => {
  const scan = await scanLayoutCollisions(scene, request.mergeGapFrames)
  const incidents = scan.incidents.map((incident, index) => ({
    ...incident,
    id: `incident-${String(index + 1).padStart(3, '0')}`,
    screenshotPath: ''
  }))

  if (incidents.length > 0) {
    await captureIncidentStills(scene, request.outputDirectory, incidents)
  }

  return {
    checkedFrames: scan.checkedFrames,
    watchedObjectCount: scan.watchedObjectCount,
    incidents,
    warnings: scan.warnings
  }
}

const scanLayoutCollisions = async (
  scene: AnimatedScene,
  mergeGapFrames: number
): Promise<LayoutCheckScan> => {
  let watches: CollisionWatch[] = []
  let exposedByObject = new Map<THREE.Object3D, ExposedSceneObject>()
  const openIncidents = new Map<string, OpenIncident>()
  const completedIncidents: DraftIncident[] = []
  const pathCache = new WeakMap<THREE.Object3D, string>()

  const visitedFrames = await scene.visitExactFrames(({ frame }) => {
    if (frame === 0) {
      watches = scene.getCollisionWatches()
      exposedByObject = new Map(
        scene.getExposedObjects().map((exposed) => [exposed.object, exposed])
      )
      if (watches.length === 0) return false
    }

    const frameCollisions = findFrameCollisions(scene, watches, exposedByObject, pathCache)
    updateIncidents(frame, frameCollisions, mergeGapFrames, openIncidents, completedIncidents)
  })

  for (const incident of openIncidents.values()) {
    completedIncidents.push(toDraftIncident(incident))
  }

  completedIncidents.sort(
    (left, right) =>
      left.startFrame - right.startFrame ||
      left.subjectId.localeCompare(right.subjectId) ||
      left.obstacleId.localeCompare(right.obstacleId)
  )

  return {
    checkedFrames: watches.length === 0 ? 0 : visitedFrames,
    watchedObjectCount: watches.length,
    incidents: completedIncidents,
    warnings:
      watches.length === 0
        ? [
            {
              code: 'NO_COLLISION_WATCHES',
              message:
                'The scene did not register any objects with scene.watchCollisions(), so no frames were checked'
            }
          ]
        : []
  }
}

const findFrameCollisions = (
  scene: AnimatedScene,
  watches: CollisionWatch[],
  exposedByObject: Map<THREE.Object3D, ExposedSceneObject>,
  pathCache: WeakMap<THREE.Object3D, string>
): Map<string, FrameCollision> => {
  const visibleObjects = visibleObjectBounds(scene)
  const collisions = new Map<string, FrameCollision>()

  for (const watch of watches) {
    const subjectParts = visibleObjects.filter(
      ({ object }) => object === watch.object || isDescendantOf(object, watch.object)
    )
    const subjectBounds = unionBounds(subjectParts.map(({ bounds }) => bounds))
    if (!subjectBounds) continue

    const paddedSubjectBounds = clipBounds(
      expandBounds(subjectBounds, watch.paddingPx),
      scene.width,
      scene.height
    )
    if (!paddedSubjectBounds) continue

    for (const obstacle of visibleObjects) {
      if (objectsAreRelated(watch.object, obstacle.object)) continue
      if (
        watch.ignore.some(
          (ignored) => obstacle.object === ignored || isDescendantOf(obstacle.object, ignored)
        )
      ) {
        continue
      }

      const overlapPixels = intersectBounds(paddedSubjectBounds, obstacle.bounds)
      if (!overlapPixels) continue

      const semanticObstacle = nearestExposedObject(obstacle.object, watch.object, exposedByObject)
      const obstacleRoot = semanticObstacle?.object ?? obstacle.object
      const obstaclePath = objectPath(obstacleRoot, scene.scene, pathCache)
      const obstacleId = semanticObstacle?.id ?? obstaclePath
      const obstacleKey = semanticObstacle
        ? `exposed:${semanticObstacle.id}`
        : `object:${obstacle.object.uuid}`
      const pairKey = `${watch.id}\u0000${obstacleKey}`
      const collision: FrameCollision = {
        pairKey,
        subjectId: watch.id,
        ...objectText(watch.object),
        obstacleId,
        ...(obstacleRoot.name ? { obstacleName: obstacleRoot.name } : {}),
        obstacleType: obstacleRoot.type,
        obstaclePath,
        paddingPx: watch.paddingPx,
        subjectBounds,
        obstacleBounds: obstacle.bounds,
        overlapPixels
      }

      const existing = collisions.get(pairKey)
      if (!existing || collision.overlapPixels.area > existing.overlapPixels.area) {
        collisions.set(pairKey, collision)
      }
    }
  }

  return collisions
}

const updateIncidents = (
  frame: number,
  collisions: Map<string, FrameCollision>,
  mergeGapFrames: number,
  openIncidents: Map<string, OpenIncident>,
  completedIncidents: DraftIncident[]
): void => {
  for (const [pairKey, incident] of openIncidents) {
    if (!collisions.has(pairKey) && frame - incident.lastCollisionFrame >= mergeGapFrames) {
      completedIncidents.push(toDraftIncident(incident))
      openIncidents.delete(pairKey)
    }
  }

  for (const collision of collisions.values()) {
    const existing = openIncidents.get(collision.pairKey)
    if (!existing) {
      openIncidents.set(collision.pairKey, {
        pairKey: collision.pairKey,
        subjectId: collision.subjectId,
        ...(collision.subjectText !== undefined ? { subjectText: collision.subjectText } : {}),
        obstacleId: collision.obstacleId,
        ...(collision.obstacleName !== undefined ? { obstacleName: collision.obstacleName } : {}),
        obstacleType: collision.obstacleType,
        obstaclePath: collision.obstaclePath,
        startFrame: frame,
        endFrame: frame,
        representativeFrame: frame,
        collisionFrameCount: 1,
        paddingPx: collision.paddingPx,
        subjectBounds: collision.subjectBounds,
        obstacleBounds: collision.obstacleBounds,
        overlapPixels: collision.overlapPixels,
        lastCollisionFrame: frame
      })
      continue
    }

    existing.endFrame = frame
    existing.lastCollisionFrame = frame
    existing.collisionFrameCount++
    if (collision.overlapPixels.area > existing.overlapPixels.area) {
      existing.representativeFrame = frame
      existing.subjectBounds = collision.subjectBounds
      existing.obstacleBounds = collision.obstacleBounds
      existing.overlapPixels = collision.overlapPixels
      if (collision.subjectText !== undefined) existing.subjectText = collision.subjectText
    }
  }
}

const toDraftIncident = ({
  pairKey: _pairKey,
  lastCollisionFrame: _last,
  ...incident
}: OpenIncident): DraftIncident => incident

const captureIncidentStills = async (
  scene: AnimatedScene,
  outputDirectory: string,
  incidents: LayoutCollisionIncident[]
): Promise<void> => {
  const incidentsByFrame = new Map<number, LayoutCollisionIncident[]>()
  for (const incident of incidents) {
    const atFrame = incidentsByFrame.get(incident.representativeFrame)
    if (atFrame) atFrame.push(incident)
    else incidentsByFrame.set(incident.representativeFrame, [incident])
  }
  const lastCaptureFrame = Math.max(...incidentsByFrame.keys())
  const directory = outputDirectory.replace(/[\\/]+$/, '')

  await scene.visitExactFrames(async ({ frame, capturePng }) => {
    const frameIncidents = incidentsByFrame.get(frame)
    if (frameIncidents) {
      const png = await capturePng()
      const bytes = new Uint8Array(await png.arrayBuffer())
      const filename = `frame-${String(frame).padStart(6, '0')}.png`
      const screenshotPath = await window.api.writeAutomationFile(`${directory}/${filename}`, bytes)
      for (const incident of frameIncidents) {
        incident.screenshotPath = screenshotPath
      }
    }
    if (frame >= lastCaptureFrame) return false
  })
}

const visibleObjectBounds = (scene: AnimatedScene): VisibleObjectBounds[] => {
  const result: VisibleObjectBounds[] = []
  scene.scene.traverseVisible((object) => {
    if (!isRenderableObject(object)) return
    if (!scene.camera.layers.test(object.layers)) return
    if (!hasVisibleMaterial(object)) return
    const bounds = screenBoundsForObject(object, scene.camera, scene.width, scene.height)
    if (bounds) result.push({ object, bounds })
  })
  return result
}

const isRenderableObject = (
  object: THREE.Object3D
): object is THREE.Object3D & {
  geometry?: THREE.BufferGeometry
  material?: THREE.Material | THREE.Material[]
} => {
  const candidate = object as THREE.Object3D & {
    isMesh?: boolean
    isLine?: boolean
    isPoints?: boolean
    isSprite?: boolean
  }
  return Boolean(candidate.isMesh || candidate.isLine || candidate.isPoints || candidate.isSprite)
}

const hasVisibleMaterial = (
  object: THREE.Object3D & { material?: THREE.Material | THREE.Material[] }
): boolean => {
  const material = object.material
  if (!material) return true
  const materials = Array.isArray(material) ? material : [material]
  return materials.some((entry) => entry.visible && !(entry.transparent && entry.opacity <= 0.001))
}

const screenBoundsForObject = (
  object: THREE.Object3D & { geometry?: THREE.BufferGeometry },
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  width: number,
  height: number
): InspectScreenBounds | null => {
  const projected = projectObjectBounds(object, camera, width, height).bounds
  if (!projected) return null
  const minimumWidth = Math.max(1, projected.width)
  const minimumHeight = Math.max(1, projected.height)
  const bounds = {
    x: (projected.left + projected.right - minimumWidth) / 2,
    y: (projected.top + projected.bottom - minimumHeight) / 2,
    width: minimumWidth,
    height: minimumHeight
  }
  return clipBounds(bounds, width, height)
}

const unionBounds = (bounds: InspectScreenBounds[]): InspectScreenBounds | null => {
  if (bounds.length === 0) return null
  const minX = Math.min(...bounds.map((bound) => bound.x))
  const minY = Math.min(...bounds.map((bound) => bound.y))
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width))
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

const expandBounds = (bounds: InspectScreenBounds, padding: number): InspectScreenBounds => ({
  x: bounds.x - padding,
  y: bounds.y - padding,
  width: bounds.width + padding * 2,
  height: bounds.height + padding * 2
})

const clipBounds = (
  bounds: InspectScreenBounds,
  width: number,
  height: number
): InspectScreenBounds | null => {
  const left = Math.max(0, bounds.x)
  const top = Math.max(0, bounds.y)
  const right = Math.min(width, bounds.x + bounds.width)
  const bottom = Math.min(height, bounds.y + bounds.height)
  if (right <= left || bottom <= top) return null
  return {
    x: rounded(left),
    y: rounded(top),
    width: rounded(right - left),
    height: rounded(bottom - top)
  }
}

const intersectBounds = (
  left: InspectScreenBounds,
  right: InspectScreenBounds
): LayoutCollisionOverlap | null => {
  const x = Math.max(left.x, right.x)
  const y = Math.max(left.y, right.y)
  const endX = Math.min(left.x + left.width, right.x + right.width)
  const endY = Math.min(left.y + left.height, right.y + right.height)
  if (endX <= x || endY <= y) return null
  const width = endX - x
  const height = endY - y
  return {
    x: rounded(x),
    y: rounded(y),
    width: rounded(width),
    height: rounded(height),
    area: rounded(width * height)
  }
}

const rounded = (value: number): number => {
  const result = Math.round(value * 1_000_000) / 1_000_000
  return Object.is(result, -0) ? 0 : result
}

const objectsAreRelated = (left: THREE.Object3D, right: THREE.Object3D): boolean =>
  left === right || isDescendantOf(left, right) || isDescendantOf(right, left)

const isDescendantOf = (object: THREE.Object3D, ancestor: THREE.Object3D): boolean => {
  let parent = object.parent
  while (parent) {
    if (parent === ancestor) return true
    parent = parent.parent
  }
  return false
}

const nearestExposedObject = (
  object: THREE.Object3D,
  subject: THREE.Object3D,
  exposedByObject: Map<THREE.Object3D, ExposedSceneObject>
): ExposedSceneObject | undefined => {
  let current: THREE.Object3D | null = object
  while (current) {
    const exposed = exposedByObject.get(current)
    if (exposed && !objectsAreRelated(subject, current)) return exposed
    current = current.parent
  }
  return undefined
}

const objectPath = (
  object: THREE.Object3D,
  root: THREE.Scene,
  cache: WeakMap<THREE.Object3D, string>
): string => {
  const cached = cache.get(object)
  if (cached) return cached
  const parts: string[] = []
  let current: THREE.Object3D | null = object
  while (current && current !== root) {
    const parent = current.parent
    const index = parent ? parent.children.indexOf(current) : -1
    parts.push(`${current.type}[${index}]${current.name ? `:${current.name}` : ''}`)
    current = parent
  }
  const path = ['Scene', ...parts.reverse()].join('/')
  cache.set(object, path)
  return path
}

const objectText = (object: THREE.Object3D): { subjectText?: string } => {
  let subjectText: string | undefined
  object.traverse((candidate) => {
    if (subjectText !== undefined) return
    const text = (candidate as THREE.Object3D & { text?: unknown }).text
    if (typeof text === 'string') subjectText = text
  })
  return subjectText !== undefined ? { subjectText } : {}
}
