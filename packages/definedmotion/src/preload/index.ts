import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { RenderOptions } from '../main/rendering'
import type {
  AutomationRequest,
  AutomationResult,
  RuntimeRendererRequest,
  RuntimeSourceDiagnostic
} from '../automation/types'
import type { RenderProgress } from '../renderProgress'
import type { ViewerPreferences } from '../viewer/preferences'

// ---- NEW helpers for event subscription
function onDisplayHzChanged(cb: (hz: number) => void): () => void {
  const channel = 'display-hz-changed'
  const listener = (_: unknown, hz: number): void => cb(hz)
  ipcRenderer.on(channel, listener)
  // return an unsubscribe fn
  return () => ipcRenderer.removeListener(channel, listener)
}

function onRuntimeRequest(cb: (request: RuntimeRendererRequest) => void): () => void {
  const channel = 'definedmotion:runtime-request'
  const listener = (_: unknown, request: RuntimeRendererRequest): void => cb(request)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

let runtimeReadySent = false
let runtimeFailureSent = false

const runtimeSourceRevision = (): string =>
  (window as Window & { __DEFINEDMOTION_SOURCE_REVISION__?: string })
    .__DEFINEDMOTION_SOURCE_REVISION__ ?? 'unknown'

const reportEarlyRuntimeFailure = (diagnostic: RuntimeSourceDiagnostic): void => {
  if (runtimeReadySent || runtimeFailureSent || !process.env['DEFINEDMOTION_SESSION_TOKEN']) {
    return
  }
  runtimeFailureSent = true
  ipcRenderer.send('definedmotion:runtime-failed', runtimeSourceRevision(), diagnostic)
}

window.addEventListener('error', (event) => {
  const error = event.error instanceof Error ? event.error : undefined
  reportEarlyRuntimeFailure({
    message: event.message || error?.message || 'Renderer module evaluation failed',
    ...(error?.stack ? { stack: error.stack } : {}),
    ...(event.filename ? { file: event.filename } : {}),
    ...(event.lineno > 0 ? { line: event.lineno } : {}),
    ...(event.colno > 0 ? { column: event.colno } : {})
  })
})

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : undefined
  reportEarlyRuntimeFailure({
    message: error?.message || String(event.reason || 'Unhandled renderer rejection'),
    ...(error?.stack ? { stack: error.stack } : {})
  })
})

const customAPI = {
  startVideoRender: (options: RenderOptions) => ipcRenderer.invoke('start-video-render', options),

  getDisplayHz: (): Promise<number> => ipcRenderer.invoke('get-display-hz'),

  getAutomationRequest: (): Promise<AutomationRequest> =>
    ipcRenderer.invoke('definedmotion:get-automation-request'),

  getViewerPreferences: (): Promise<ViewerPreferences> =>
    ipcRenderer.invoke('definedmotion:get-viewer-preferences'),

  setViewerPreferences: (preferences: ViewerPreferences): Promise<void> =>
    ipcRenderer.invoke('definedmotion:set-viewer-preferences', preferences),

  writeAutomationFile: (outputPath: string, bytes: Uint8Array): Promise<string> =>
    ipcRenderer.invoke('definedmotion:write-automation-file', outputPath, bytes),

  reportRenderProgress: (progress: RenderProgress): void =>
    ipcRenderer.send('definedmotion:render-progress', progress),

  saveFrame: (suggestedName: string, bytes: Uint8Array): Promise<string | undefined> =>
    ipcRenderer.invoke('definedmotion:save-frame', suggestedName, bytes),

  completeAutomation: (result: AutomationResult) =>
    ipcRenderer.send('definedmotion:automation-complete', result),

  runtimeReady: (sourceRevision: string): void => {
    runtimeReadySent = true
    ipcRenderer.send('definedmotion:runtime-ready', sourceRevision)
  },

  onRuntimeRequest,

  completeRuntimeRequest: (id: string, result: AutomationResult): void =>
    ipcRenderer.send('definedmotion:runtime-result', id, result),

  onDisplayHzChanged
}

// Custom APIs for renderer
const api = {
  ...customAPI
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

/*
contextBridge.exposeInMainWorld('api', {
  // Expose a method to start the video render
  startVideoRender: (options: RenderOptions) => ipcRenderer.invoke('start-video-render', options)
})
*/
