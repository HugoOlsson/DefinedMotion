import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { RenderOptions } from '../main/rendering'


// ---- NEW helpers for event subscription
function onDisplayHzChanged(cb: (hz: number) => void) {
  const channel = 'display-hz-changed'
  const listener = (_: unknown, hz: number) => cb(hz)
  ipcRenderer.on(channel, listener)
  // return an unsubscribe fn
  return () => ipcRenderer.removeListener(channel, listener)
}

const customAPI = {
  startVideoRender: (options: RenderOptions) => ipcRenderer.invoke('start-video-render', options),

  getDisplayHz: (): Promise<number> => ipcRenderer.invoke('get-display-hz'),

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
