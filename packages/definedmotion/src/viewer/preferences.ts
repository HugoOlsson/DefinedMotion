export interface ViewerPreferences {
  readonly selectedSceneId?: string
  readonly showExamplesAndTests: boolean
  readonly usePreviewMarker: boolean
}

export const defaultViewerPreferences = (): ViewerPreferences => ({
  showExamplesAndTests: false,
  usePreviewMarker: true
})

export const normalizeViewerPreferences = (value: unknown): ViewerPreferences => {
  const defaults = defaultViewerPreferences()
  if (!value || typeof value !== 'object') return defaults
  const candidate = value as Partial<ViewerPreferences>
  return {
    ...(typeof candidate.selectedSceneId === 'string' && candidate.selectedSceneId
      ? { selectedSceneId: candidate.selectedSceneId }
      : {}),
    showExamplesAndTests:
      typeof candidate.showExamplesAndTests === 'boolean'
        ? candidate.showExamplesAndTests
        : defaults.showExamplesAndTests,
    usePreviewMarker:
      typeof candidate.usePreviewMarker === 'boolean'
        ? candidate.usePreviewMarker
        : defaults.usePreviewMarker
  }
}
