import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { RenderOptions } from '../main/rendering'
import type {
  AutomationRequest,
  AutomationResult,
  RuntimeRendererRequest
} from '../automation/types'

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

const customAPI = {
  startVideoRender: (options: RenderOptions) => ipcRenderer.invoke('start-video-render', options),

  getDisplayHz: (): Promise<number> => ipcRenderer.invoke('get-display-hz'),

  getAutomationRequest: (): Promise<AutomationRequest> =>
    ipcRenderer.invoke('definedmotion:get-automation-request'),

  writeAutomationFile: (outputPath: string, bytes: Uint8Array): Promise<string> =>
    ipcRenderer.invoke('definedmotion:write-automation-file', outputPath, bytes),

  completeAutomation: (result: AutomationResult) =>
    ipcRenderer.send('definedmotion:automation-complete', result),

  runtimeReady: (sourceRevision: string): void =>
    ipcRenderer.send('definedmotion:runtime-ready', sourceRevision),

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
