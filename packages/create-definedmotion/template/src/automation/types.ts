export type AutomationCommand = 'scenes' | 'still' | 'timeline-grid'

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

export type AutomationRequest =
  | ScenesAutomationRequest
  | StillAutomationRequest
  | TimelineGridAutomationRequest

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

export interface AutomationSuccessResult {
  success: true
  command: AutomationCommand
  scenes?: AutomationSceneSummary[]
  scene?: string
  frame?: number
  frames?: number[]
  cells?: TimelineGridCell[]
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

export type RuntimeClientRequest =
  | RuntimeClientStatusRequest
  | RuntimeClientExecuteRequest
  | RuntimeClientStopRequest
