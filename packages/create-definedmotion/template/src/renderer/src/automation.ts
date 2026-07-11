import type { AutomationRequest, AutomationResult } from '../../automation/types'
import { SceneRuntimeError } from './lib/scene/sceneClass'
import { AssetRuntimeError } from './lib/assets/assetReference'
import { AutomationCommandError, RenderSession } from './renderSession'

const automationApi = window.api

const failure = (request: AutomationRequest | undefined, error: unknown): AutomationResult => {
  const normalized = error instanceof Error ? error : new Error(String(error))
  const code =
    error instanceof AutomationCommandError ||
    error instanceof SceneRuntimeError ||
    error instanceof AssetRuntimeError
      ? error.code
      : 'AUTOMATION_FAILED'
  return {
    success: false,
    command: request?.command,
    error: {
      code,
      message: normalized.message,
      stack: normalized.stack
    }
  }
}

export const runAutomation = async (): Promise<void> => {
  const renderSession = new RenderSession()
  const isPersistentSession = new URLSearchParams(window.location.search).get('session') === '1'

  const execute = async (request: AutomationRequest): Promise<AutomationResult> => {
    try {
      return await renderSession.execute(request)
    } catch (error) {
      return failure(request, error)
    }
  }

  window.addEventListener('beforeunload', () => renderSession.dispose(), {
    once: true
  })

  if (isPersistentSession) {
    automationApi.onRuntimeRequest(async ({ id, request }) => {
      const result = await execute(request)
      automationApi.completeRuntimeRequest(id, result)
    })
    automationApi.runtimeReady(window.__DEFINEDMOTION_SOURCE_REVISION__ ?? 'unknown')
    return
  }

  let request: AutomationRequest | undefined

  try {
    request = await automationApi.getAutomationRequest()
    automationApi.completeAutomation(await execute(request))
  } catch (error) {
    automationApi.completeAutomation(failure(request, error))
  }
}
