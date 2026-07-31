import type { ViewerSceneKind, ViewerSceneSummary } from '../project'

export interface InitialSceneResolution {
  readonly id: string
  readonly fellBack: boolean
}

export const resolveInitialScene = (
  scenes: readonly ViewerSceneSummary[],
  defaultScene: string,
  storedScene?: string
): InitialSceneResolution => {
  if (storedScene && scenes.some(({ id }) => id === storedScene)) {
    return { id: storedScene, fellBack: false }
  }
  return { id: defaultScene, fellBack: storedScene !== undefined }
}

export const visibleScenesFor = (
  scenes: readonly ViewerSceneSummary[],
  kind: ViewerSceneKind,
  showExamplesAndTests: boolean,
  selectedSceneId: string
): ViewerSceneSummary[] =>
  scenes.filter(
    (summary) =>
      summary.kind === kind &&
      (kind === 'project' || showExamplesAndTests || summary.id === selectedSceneId)
  )

export class SelectionGeneration {
  private generation = 0

  begin(): number {
    return ++this.generation
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation
  }

  invalidate(): void {
    this.generation++
  }
}
