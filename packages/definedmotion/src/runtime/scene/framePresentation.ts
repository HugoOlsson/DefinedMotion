export interface FramePresentation {
  readonly timestamp: number
  readonly timelineFrame: number
}

export type FramePresentationObserver = (presentation: FramePresentation) => void

const observers = new WeakMap<object, Set<FramePresentationObserver>>()

export const observeFramePresentations = (
  owner: object,
  observer: FramePresentationObserver
): (() => void) => {
  const current = observers.get(owner) ?? new Set<FramePresentationObserver>()
  current.add(observer)
  observers.set(owner, current)

  return () => {
    current.delete(observer)
    if (current.size === 0) observers.delete(owner)
  }
}

export const notifyFramePresented = (
  owner: object,
  timelineFrame: number
): void => {
  const current = observers.get(owner)
  if (!current) return
  const presentation: FramePresentation = {
    timestamp: performance.now(),
    timelineFrame
  }
  for (const observer of current) observer(presentation)
}
