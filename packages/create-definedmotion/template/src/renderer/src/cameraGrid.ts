import type {
  AutomationCameraSummary,
  CameraGridAutomationRequest,
  CameraGridCell
} from '../../automation/types'
import { AutomationCommandError } from './automationError'
import {
  cameraSummary,
  listInspectionCameras,
  resolveInspectionCamera,
  type ResolvedInspectionCamera
} from './inspectionCamera'
import { renderImageGrid, validateImageGridLayout, type ImageGridRender } from './imageGrid'
import type { AnimatedScene } from './lib/scene/sceneClass'

const MAX_GRID_CAMERAS = 25

export interface CameraGridRender extends ImageGridRender {
  cameras: AutomationCameraSummary[]
  cells: CameraGridCell[]
}

export const validateCameraGridRequest = (request: CameraGridAutomationRequest): void => {
  if (!Number.isInteger(request.frame) || request.frame < 0) {
    throw new AutomationCommandError(
      'INVALID_FRAME',
      'The camera-grid command requires a non-negative integer frame'
    )
  }
  if (request.cameras !== undefined) {
    if (
      !Array.isArray(request.cameras) ||
      request.cameras.length === 0 ||
      request.cameras.length > MAX_GRID_CAMERAS ||
      request.cameras.some((id) => typeof id !== 'string' || id.trim() === '')
    ) {
      throw new AutomationCommandError(
        'INVALID_CAMERAS',
        `Camera grid cameras must contain 1-${MAX_GRID_CAMERAS} non-empty IDs`
      )
    }
    if (new Set(request.cameras).size !== request.cameras.length) {
      throw new AutomationCommandError('DUPLICATE_CAMERAS', 'Camera grid camera IDs must be unique')
    }
  }
  validateImageGridLayout(request.columns, request.cellWidth, MAX_GRID_CAMERAS, 'Camera grid')
}

export const renderCameraGrid = async (
  request: CameraGridAutomationRequest,
  scene: AnimatedScene
): Promise<CameraGridRender> => {
  await scene.seekExact(request.frame)
  const selected = selectCameras(scene, request.cameras)
  if (selected.length > MAX_GRID_CAMERAS) {
    throw new AutomationCommandError(
      'TOO_MANY_GRID_CAMERAS',
      `Camera grid found ${selected.length} cameras; select at most ${MAX_GRID_CAMERAS} with --cameras`
    )
  }

  const summaries: AutomationCameraSummary[] = []
  const labels = new Map<string, string>()
  const grid = await renderImageGrid({
    kind: 'camera',
    scene,
    items: selected,
    cellWidth: request.cellWidth,
    columns: request.columns,
    renderItem: (selectedCamera) => {
      scene.renderCurrentFrame(selectedCamera.camera)
      summaries.push(cameraSummary(selectedCamera))
      const projection =
        selectedCamera.camera.type === 'OrthographicCamera' ? 'orthographic' : 'perspective'
      labels.set(selectedCamera.id, `${selectedCamera.id} · ${projection}`)
    },
    labelItem: (selectedCamera) => ({
      title: labels.get(selectedCamera.id)!,
      description: selectedCamera.metadata.description ?? 'Inspection camera'
    })
  })
  const cells: CameraGridCell[] = grid.cells.map((bounds, index) => ({
    cameraId: selected[index].id,
    isMain: selected[index].isMain,
    ...bounds,
    label: labels.get(selected[index].id)!
  }))

  return { ...grid, cameras: summaries, cells }
}

const selectCameras = (
  scene: AnimatedScene,
  cameraIds: string[] | undefined
): ResolvedInspectionCamera[] =>
  cameraIds
    ? cameraIds.map((id) => resolveInspectionCamera(scene, id))
    : listInspectionCameras(scene)
