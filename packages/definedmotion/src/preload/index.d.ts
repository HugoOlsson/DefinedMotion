import { ElectronAPI } from '@electron-toolkit/preload'
import type { RenderOptions } from '../main/rendering'
import type {
  AutomationRequest,
  AutomationResult,
  RuntimeRendererRequest
} from '../automation/types'

export interface DefinedMotionAPI {
  startVideoRender(options: RenderOptions): Promise<{
    success: boolean
    outputFile?: string
    error?: string
  }>
  getDisplayHz(): Promise<number>
  getAutomationRequest(): Promise<AutomationRequest>
  writeAutomationFile(outputPath: string, bytes: Uint8Array): Promise<string>
  completeAutomation(result: AutomationResult): void
  runtimeReady(sourceRevision: string): void
  onRuntimeRequest(callback: (request: RuntimeRendererRequest) => void): () => void
  completeRuntimeRequest(id: string, result: AutomationResult): void
  onDisplayHzChanged(callback: (hz: number) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DefinedMotionAPI
  }
}
