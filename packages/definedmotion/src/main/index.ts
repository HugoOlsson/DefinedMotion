import { app, shell, BrowserWindow, dialog, ipcMain, nativeTheme, screen } from 'electron'
import { join } from 'path'
import { basename, dirname, resolve } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { renderVideo } from './rendering'
import { deleteRenderedContent } from './storage'
import ElectronStore from 'electron-store'
import type {
  AutomationRequest,
  AutomationResult,
  RuntimeSourceDiagnostic
} from '../automation/types'
import { registerAssetProtocol } from './assets'
import { getPersistentRuntimeConfig, PersistentRuntimeHost } from './runtimeHost'
import { emitRenderProgress } from './renderProgress'
import type { RenderProgress } from '../renderProgress'

const store = new ElectronStore()
const automationRequestRaw = process.env['DEFINEDMOTION_AUTOMATION_REQUEST']
const automationResultPath = process.env['DEFINEDMOTION_AUTOMATION_RESULT']
const isAutomation = Boolean(automationRequestRaw && automationResultPath)
const persistentRuntimeConfig = getPersistentRuntimeConfig()
const isPersistentRuntime = Boolean(persistentRuntimeConfig)
const isRuntimeMode = isAutomation || isPersistentRuntime
const isDevelopmentSmoke = process.env['DEFINEDMOTION_DEV_SMOKE'] === '1'
const LONG_AUTOMATION_TIMEOUT_MS = 24 * 60 * 60 * 1000

let automationRequest: AutomationRequest | undefined
if (automationRequestRaw) {
  try {
    automationRequest = JSON.parse(automationRequestRaw) as AutomationRequest
  } catch (error) {
    console.error('Invalid DEFINEDMOTION_AUTOMATION_REQUEST:', error)
  }
}

if (isRuntimeMode) {
  app.commandLine.appendSwitch('force-device-scale-factor', '1')
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
}

// Force light mode
nativeTheme.themeSource = 'light'

let mainWindow: BrowserWindow
let persistentRuntimeHost: PersistentRuntimeHost | undefined
let pendingRendererFailure:
  | { sourceRevision: string; diagnostic: RuntimeSourceDiagnostic }
  | undefined

interface WindowBounds {
  width: number
  height: number
  x?: number
  y?: number
}

function getHzForWebContents(wc: Electron.WebContents): number {
  const win = BrowserWindow.fromWebContents(wc)
  if (win) {
    const b = win.getBounds()
    const nearest = screen.getDisplayNearestPoint({ x: b.x, y: b.y })
    return nearest.displayFrequency || 60
  }
  // Fallback to primary display
  return screen.getPrimaryDisplay().displayFrequency || 60
}

function createWindow(): void {
  // Create the browser window.

  const defaultBounds = { width: 1000, height: 1300 }
  const savedBounds = (
    isRuntimeMode ? defaultBounds : store.get('windowBounds', defaultBounds)
  ) as WindowBounds
  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
    show: false,
    title: 'DefinedMotion',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      nodeIntegrationInWorker: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: !isRuntimeMode
    }
  })

  if (!isRuntimeMode) {
    mainWindow.on('resize', () => {
      store.set('windowBounds', mainWindow.getBounds())
    })

    mainWindow.on('move', () => {
      store.set('windowBounds', mainWindow.getBounds())
    })
  }

  mainWindow.on('ready-to-show', () => {
    if (!isRuntimeMode) mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDevelopmentSmoke) {
    mainWindow.webContents.on('console-message', (_event, level, message) => {
      console.log(`[DefinedMotion renderer ${level}] ${message}`)
    })
    mainWindow.webContents.on('did-finish-load', () => {
      const deadline = Date.now() + 10_000
      const reportWhenMounted = (): void => {
        void mainWindow.webContents
          .executeJavaScript("Boolean(document.querySelector('#app')?.childElementCount)")
          .then((mounted: boolean) => {
            if (mounted) console.log('DEFINEDMOTION_RENDERER_READY')
            else if (Date.now() >= deadline) console.log('DEFINEDMOTION_RENDERER_EMPTY')
            else setTimeout(reportWhenMounted, 250)
          })
          .catch((error: unknown) => {
            console.error('DEFINEDMOTION_RENDERER_CHECK_FAILED', error)
          })
      }
      reportWhenMounted()
    })
  }

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const rendererUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
    if (isAutomation) rendererUrl.searchParams.set('automation', '1')
    if (isPersistentRuntime) rendererUrl.searchParams.set('session', '1')
    mainWindow.loadURL(rendererUrl.toString())
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: isAutomation ? { automation: '1' } : isPersistentRuntime ? { session: '1' } : undefined
    })
  }
}

let automationFinished = false
async function finishAutomation(result: AutomationResult): Promise<void> {
  if (automationFinished || !automationResultPath) return
  automationFinished = true

  try {
    const absoluteResultPath = resolve(automationResultPath)
    await mkdir(dirname(absoluteResultPath), { recursive: true })
    await writeFile(absoluteResultPath, JSON.stringify(result, null, 2), 'utf8')
  } catch (error) {
    console.error('Could not write DefinedMotion automation result:', error)
  } finally {
    app.exit(result.success ? 0 : 1)
  }
}

function automationFailure(code: string, error: unknown): AutomationResult {
  const normalized = error instanceof Error ? error : new Error(String(error))
  return {
    success: false,
    command: automationRequest?.command,
    error: {
      code,
      message: normalized.message,
      stack: normalized.stack
    }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerAssetProtocol()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('definedmotion:get-automation-request', () => {
    if (!isAutomation || !automationRequest) {
      throw new Error('DefinedMotion was not started in automation mode')
    }
    return automationRequest
  })

  ipcMain.handle(
    'definedmotion:write-automation-file',
    async (_event, outputPath: string, bytes: Uint8Array) => {
      if (!isRuntimeMode) throw new Error('File output is only available in automation mode')
      const absolutePath = resolve(outputPath)
      await mkdir(dirname(absolutePath), { recursive: true })
      await writeFile(absolutePath, Buffer.from(bytes))
      return absolutePath
    }
  )

  ipcMain.on(
    'definedmotion:render-progress',
    (event, progress: RenderProgress) => {
      if (isAutomation && event.sender === mainWindow?.webContents) {
        emitRenderProgress(progress)
      }
    }
  )

  ipcMain.handle(
    'definedmotion:save-frame',
    async (event, suggestedName: string, bytes: Uint8Array) => {
      if (isRuntimeMode || event.sender !== mainWindow?.webContents) {
        throw new Error('Frame saving is only available in the interactive viewer')
      }
      const owner = BrowserWindow.fromWebContents(event.sender)
      if (!owner) throw new Error('Could not find the DefinedMotion viewer window')
      const defaultName = basename(suggestedName || 'definedmotion-framecapture.png')
      const selection = await dialog.showSaveDialog(owner, {
        title: 'Save frame',
        defaultPath: defaultName,
        filters: [{ name: 'PNG image', extensions: ['png'] }]
      })
      if (selection.canceled || !selection.filePath) return undefined
      const outputPath = selection.filePath.toLowerCase().endsWith('.png')
        ? selection.filePath
        : `${selection.filePath}.png`
      await writeFile(outputPath, Buffer.from(bytes))
      return outputPath
    }
  )

  ipcMain.on('definedmotion:automation-complete', (_event, result: AutomationResult) => {
    void finishAutomation(result)
  })

  ipcMain.on('definedmotion:runtime-ready', (event, sourceRevision: string) => {
    if (event.sender === mainWindow?.webContents) {
      persistentRuntimeHost?.rendererReady(sourceRevision)
    }
  })

  ipcMain.on(
    'definedmotion:runtime-failed',
    (event, sourceRevision: string, diagnostic: RuntimeSourceDiagnostic) => {
      if (
        event.sender !== mainWindow?.webContents ||
        typeof sourceRevision !== 'string' ||
        !diagnostic ||
        typeof diagnostic.message !== 'string'
      ) {
        return
      }
      if (persistentRuntimeHost) {
        persistentRuntimeHost.rendererFailed(sourceRevision, diagnostic)
      } else {
        pendingRendererFailure = { sourceRevision, diagnostic }
      }
    }
  )

  ipcMain.on('definedmotion:runtime-result', (event, id: string, result: AutomationResult) => {
    if (event.sender === mainWindow?.webContents) {
      persistentRuntimeHost?.rendererResult(id, result)
    }
  })

  // Listen for resize requests from the renderer
  ipcMain.on('resize-window', (_event, { width, height }) => {
    if (mainWindow) {
      mainWindow.setSize(width, height)
    }
  })

  createWindow()

  if (persistentRuntimeConfig) {
    persistentRuntimeHost = new PersistentRuntimeHost(mainWindow, persistentRuntimeConfig)
    if (pendingRendererFailure) {
      persistentRuntimeHost.rendererFailed(
        pendingRendererFailure.sourceRevision,
        pendingRendererFailure.diagnostic
      )
      pendingRendererFailure = undefined
    }
    void persistentRuntimeHost.start().catch((error) => {
      console.error('Could not start DefinedMotion persistent runtime:', error)
      app.exit(1)
    })
  }

  if (isAutomation) {
    mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
      void finishAutomation(
        automationFailure('RENDERER_LOAD_FAILED', new Error(`${description} (${code})`))
      )
    })
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      void finishAutomation(
        automationFailure('RENDERER_CRASHED', new Error(`Renderer exited: ${details.reason}`))
      )
    })

    setTimeout(
      () => {
        void finishAutomation(
          automationFailure(
            'AUTOMATION_TIMEOUT',
            new Error(
              automationRequest?.command === 'render'
                ? 'Render timed out after 24 hours'
                : automationRequest?.command === 'layout-check' || automationRequest?.command === 'verify'
                  ? `${automationRequest.command} timed out after 24 hours`
                  : 'Automation timed out after 5 minutes'
            )
          )
        )
      },
      (automationRequest?.command === 'render' ||
        automationRequest?.command === 'layout-check' ||
        automationRequest?.command === 'verify')
        ? LONG_AUTOMATION_TIMEOUT_MS
        : 5 * 60 * 1000
    )
  } else if (!isPersistentRuntime) {
    void deleteRenderedContent()
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // RPC: renderer asks main for the current display refresh rate (Hz)
  ipcMain.handle('get-display-hz', (event) => {
    return getHzForWebContents(event.sender)
  })

  function broadcastHzToAllWindows(): void {
    for (const w of BrowserWindow.getAllWindows()) {
      const hz = getHzForWebContents(w.webContents)
      w.webContents.send('display-hz-changed', hz)
    }
  }

  // Display geometry / metrics changed (resolution/scale/mode changes, some moves)
  screen.on('display-metrics-changed', () => {
    broadcastHzToAllWindows()
  })

  // Displays added/removed (dock/undock, hot-plug)
  screen.on('display-added', () => {
    broadcastHzToAllWindows()
  })
  screen.on('display-removed', () => {
    broadcastHzToAllWindows()
  })
})

ipcMain.handle('start-video-render', async (_event, options) => {
  try {
    const outputFile = await renderVideo(options)
    return { success: true, outputFile }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  persistentRuntimeHost?.stop()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
