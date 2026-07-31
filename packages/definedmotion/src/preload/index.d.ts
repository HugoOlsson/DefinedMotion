import { ElectronAPI } from '@electron-toolkit/preload'
import type { RenderOptions } from '../main/rendering'
import type {
  AutomationRequest,
  AutomationResult,
  RuntimeRendererRequest
} from '../automation/types'
import type { RenderProgress } from '../renderProgress'
import type { ViewerPreferences } from '../viewer/preferences'

export interface DefinedMotionAPI {
  startVideoRender(options: RenderOptions): Promise<{
    success: boolean
    outputFile?: string
    error?: string
  }>
  getDisplayHz(): Promise<number>
  getAutomationRequest(): Promise<AutomationRequest>
  getViewerPreferences(): Promise<ViewerPreferences>
  setViewerPreferences(preferences: ViewerPreferences): Promise<void>
  writeAutomationFile(outputPath: string, bytes: Uint8Array): Promise<string>
  reportRenderProgress(progress: RenderProgress): void
  saveFrame(suggestedName: string, bytes: Uint8Array): Promise<string | undefined>
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
