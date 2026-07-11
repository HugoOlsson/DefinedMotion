export type AutomationCommand = 'scenes' | 'still'

export interface AutomationRequest {
  command: AutomationCommand
  scene?: string
  frame?: number
  output?: string
}

export interface AutomationSceneSummary {
  id: string
  name: string
  isDefault: boolean
}

export interface AutomationSuccessResult {
  success: true
  command: AutomationCommand
  scenes?: AutomationSceneSummary[]
  scene?: string
  frame?: number
  timeMs?: number
  durationInFrames?: number
  fps?: number
  seed?: number | string
  width?: number
  height?: number
  output?: string
  renderTimeMs?: number
}

export interface AutomationFailureResult {
  success: false
  command?: AutomationCommand
  error: {
    code: string
    message: string
    stack?: string
  }
}

export type AutomationResult = AutomationSuccessResult | AutomationFailureResult
