import { app, shell, BrowserWindow, ipcMain, nativeTheme, screen } from 'electron'
import { join } from 'path'
import { dirname, resolve } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { renderVideo } from './rendering'
import { deleteRenderedContent } from './storage'
import ElectronStore from 'electron-store'
import type { AutomationRequest, AutomationResult } from '../automation/types'

const store = new ElectronStore()
const automationRequestRaw = process.env['DEFINEDMOTION_AUTOMATION_REQUEST']
const automationResultPath = process.env['DEFINEDMOTION_AUTOMATION_RESULT']
const isAutomation = Boolean(automationRequestRaw && automationResultPath)

let automationRequest: AutomationRequest | undefined
if (automationRequestRaw) {
  try {
    automationRequest = JSON.parse(automationRequestRaw) as AutomationRequest
  } catch (error) {
    console.error('Invalid DEFINEDMOTION_AUTOMATION_REQUEST:', error)
  }
}

if (isAutomation) {
  app.commandLine.appendSwitch('force-device-scale-factor', '1')
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
}

// Force light mode
nativeTheme.themeSource = 'light'

let mainWindow: BrowserWindow

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
    isAutomation ? defaultBounds : store.get('windowBounds', defaultBounds)
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
      backgroundThrottling: !isAutomation
    }
  })

  if (!isAutomation) {
    mainWindow.on('resize', () => {
      store.set('windowBounds', mainWindow.getBounds())
    })

    mainWindow.on('move', () => {
      store.set('windowBounds', mainWindow.getBounds())
    })
  }

  mainWindow.on('ready-to-show', () => {
    if (!isAutomation) mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const rendererUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
    if (isAutomation) rendererUrl.searchParams.set('automation', '1')
    mainWindow.loadURL(rendererUrl.toString())
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: isAutomation ? { automation: '1' } : undefined
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
      if (!isAutomation) throw new Error('File output is only available in automation mode')
      const absolutePath = resolve(outputPath)
      await mkdir(dirname(absolutePath), { recursive: true })
      await writeFile(absolutePath, Buffer.from(bytes))
      return absolutePath
    }
  )

  ipcMain.on('definedmotion:automation-complete', (_event, result: AutomationResult) => {
    void finishAutomation(result)
  })

  // Listen for resize requests from the renderer
  ipcMain.on('resize-window', (_event, { width, height }) => {
    if (mainWindow) {
      mainWindow.setSize(width, height)
    }
  })

  createWindow()

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
          automationFailure('AUTOMATION_TIMEOUT', new Error('Automation timed out after 5 minutes'))
        )
      },
      5 * 60 * 1000
    )
  } else {
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
