export type FramePresentationObserver = (timestamp: number) => void

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

export const notifyFramePresented = (owner: object, timestamp: number): void => {
  const current = observers.get(owner)
  if (!current) return
  for (const observer of current) observer(timestamp)
}
