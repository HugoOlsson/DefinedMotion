export type AutomationCommand = 'scenes' | 'still' | 'timeline-grid' | 'inspect'

export interface ScenesAutomationRequest {
  command: 'scenes'
  excludeTests?: boolean
}

export interface StillAutomationRequest {
  command: 'still'
  scene: string
  frame: number
  output: string
}

export interface TimelineGridAutomationRequest {
  command: 'timeline-grid'
  scene: string
  frames?: number[]
  count?: number
  columns?: number
  cellWidth: number
  output: string
}

export interface InspectAutomationRequest {
  command: 'inspect'
  scene: string
  frame: number
}

export type AutomationRequest =
  | ScenesAutomationRequest
  | StillAutomationRequest
  | TimelineGridAutomationRequest
  | InspectAutomationRequest

export interface AutomationSceneSummary {
  id: string
  name: string
  isDefault: boolean
  isTest: boolean
}

export interface TimelineGridCell {
  frame: number
  timeMs: number
  row: number
  column: number
  x: number
  y: number
  width: number
  height: number
  label: string
}

export type Vector3Tuple = [number, number, number]
export type QuaternionTuple = [number, number, number, number]

export interface InspectTransform {
  position: Vector3Tuple
  rotation: Vector3Tuple
  quaternion?: QuaternionTuple
  scale: Vector3Tuple
}

export interface InspectBounds3D {
  min: Vector3Tuple
  max: Vector3Tuple
  size: Vector3Tuple
  center: Vector3Tuple
}

export interface InspectScreenBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface InspectObjectMetadata {
  description?: string
  tags?: string[]
  data?: Record<string, string | number | boolean | null>
}

export interface InspectObjectResult {
  id: string
  type: string
  name?: string
  text?: string
  parentId?: string
  metadata: InspectObjectMetadata
  attached: boolean
  visible: boolean
  inFrame: boolean
  fullyInFrame: boolean
  behindCamera: boolean
  partiallyBehindCamera: boolean
  localTransform: InspectTransform
  worldTransform: InspectTransform
  worldBounds: InspectBounds3D | null
  screenBounds: InspectScreenBounds | null
}

export interface InspectCameraResult {
  type: 'orthographic' | 'perspective'
  position: Vector3Tuple
  rotation: Vector3Tuple
  quaternion: QuaternionTuple
  direction: Vector3Tuple
  near: number
  far: number
  zoom: number
  fov?: number
  aspect?: number
  left?: number
  right?: number
  top?: number
  bottom?: number
}

export interface InspectSceneInfo {
  id: string
  name: string
  isDefault: boolean
  isTest: boolean
  width: number
  height: number
  fps: number
  durationInFrames: number
  lastFrame: number
  durationMs: number
  seed: number | string
}

export interface AutomationSuccessResult {
  success: true
  command: AutomationCommand
  scenes?: AutomationSceneSummary[]
  scene?: string
  frame?: number
  frames?: number[]
  cells?: TimelineGridCell[]
  sceneInfo?: InspectSceneInfo
  camera?: InspectCameraResult
  objects?: InspectObjectResult[]
  totalExposedObjects?: number
  objectsTruncated?: boolean
  timeMs?: number
  durationInFrames?: number
  fps?: number
  seed?: number | string
  width?: number
  height?: number
  sceneWidth?: number
  sceneHeight?: number
  columns?: number
  rows?: number
  cellWidth?: number
  cellHeight?: number
  output?: string
  renderTimeMs?: number
  runtimeId?: string
  generation?: number
  sourceRevision?: string
}

export interface AutomationFailureResult {
  success: false
  command?: AutomationCommand
  error: {
    code: string
    message: string
    stack?: string
    file?: string
    line?: number
    column?: number
    plugin?: string
    frame?: string
  }
  runtimeId?: string
  generation?: number
  sourceRevision?: string
}

export type AutomationResult = AutomationSuccessResult | AutomationFailureResult

export interface RuntimeDescriptor {
  protocolVersion: 1
  runtimeId: string
  pid: number
  launcherPid?: number
  projectRoot: string
  socketPath: string
  token: string
  startedAt: string
}

export interface RuntimeRendererRequest {
  id: string
  request: AutomationRequest
}

export interface RuntimeClientStatusRequest {
  action: 'status'
  token: string
}

export interface RuntimeClientExecuteRequest {
  action: 'execute'
  token: string
  sourceRevision: string
  request: AutomationRequest
}

export interface RuntimeClientStopRequest {
  action: 'stop'
  token: string
}

export interface RuntimeSourceDiagnostic {
  message: string
  file?: string
  line?: number
  column?: number
  plugin?: string
  frame?: string
}

export interface RuntimeClientSourceErrorRequest {
  action: 'source-error'
  token: string
  sourceRevision: string
  diagnostic: RuntimeSourceDiagnostic
}

export type RuntimeClientRequest =
  | RuntimeClientStatusRequest
  | RuntimeClientExecuteRequest
  | RuntimeClientStopRequest
  | RuntimeClientSourceErrorRequest
