interface FrameContext {
  frame: number
  timeMs: number
}

export interface RealtimeFrameContext extends FrameContext {
  discontinuity: boolean
  continuesAfterFrame: boolean
}

export interface ExactFramePreparationContext extends FrameContext {
  signal: AbortSignal
}

export interface FrameResource {
  suspend(): void
  dispose(): void
}

export interface FrameResourceDependency {
  resource: FrameResource
  /** Must never wait for decoding, seeking, or I/O. */
  updateRealtime(context: RealtimeFrameContext): undefined
  /** May block until the resource exactly represents the requested frame. */
  prepareExact(context: ExactFramePreparationContext): void | Promise<void>
}

interface StoredResource {
  signature: string
  value: FrameResource
}

/**
 * Owns persistent frame resources while keeping their bindings scoped to one
 * scene build. Realtime presentation is synchronous; exact preparation is an
 * awaitable, latest-wins barrier.
 */
export class FrameResourceHost {
  private readonly resources = new Map<string, StoredResource>()
  private dependencies: FrameResourceDependency[] = []
  private preparation?: AbortController
  private disposed = false

  getOrCreate<T extends FrameResource>(id: string, signature: string, create: () => T): T {
    this.assertUsable()
    const existing = this.resources.get(id)
    if (existing) {
      if (existing.signature !== signature) {
        throw new Error(`Frame resource "${id}" has conflicting configuration`)
      }
      return existing.value as T
    }

    const value = create()
    this.resources.set(id, { signature, value })
    return value
  }

  use(dependency: FrameResourceDependency): void {
    this.assertUsable()
    if (this.dependencies.some(({ resource }) => resource === dependency.resource)) {
      throw new Error('A frame resource can only be used once in a scene build')
    }
    this.dependencies.push(dependency)
  }

  beginBuild(mode: 'suspend' | 'preserve'): void {
    this.assertUsable()
    this.cancelPreparation()
    if (mode === 'suspend') {
      this.suspendResources([...this.resources.values()].map(({ value }) => value))
    }
    this.dependencies = []
  }

  finishBuild(successful: boolean): void {
    this.assertUsable()
    const boundResources = successful
      ? new Set(this.dependencies.map(({ resource }) => resource))
      : new Set<FrameResource>()
    this.suspendResources(
      [...this.resources.values()]
        .map(({ value }) => value)
        .filter((resource) => !boundResources.has(resource))
    )
  }

  updateRealtime(context: RealtimeFrameContext): void {
    this.assertUsable()
    if (this.dependencies.length === 0) return
    this.cancelPreparation()
    const dependencies = [...this.dependencies]

    try {
      for (const dependency of dependencies) dependency.updateRealtime(context)
    } catch (error) {
      this.suspendResources(dependencies.map(({ resource }) => resource))
      throw error
    }
  }

  async prepareExact(frame: number, timeMs: number): Promise<void> {
    this.assertUsable()
    if (this.dependencies.length === 0) return
    this.cancelPreparation()
    const preparation = new AbortController()
    this.preparation = preparation
    const context: ExactFramePreparationContext = {
      frame,
      timeMs,
      signal: preparation.signal
    }
    const dependencies = [...this.dependencies]

    try {
      await Promise.all(dependencies.map((dependency) => dependency.prepareExact(context)))
      if (this.disposed || this.preparation !== preparation) throw abortedPreparation()
      this.preparation = undefined
    } catch (error) {
      if (this.preparation === preparation) {
        this.preparation = undefined
        this.suspendResources(dependencies.map(({ resource }) => resource))
      }
      throw error
    }
  }

  suspend(): void {
    this.cancelPreparation()
    this.suspendResources([...this.resources.values()].map(({ value }) => value))
  }

  dispose(): void {
    if (this.disposed) return
    this.suspend()
    this.disposed = true
    const resources = [...this.resources.values()]
    this.resources.clear()
    this.dependencies = []
    for (const { value } of resources) {
      try {
        value.dispose()
      } catch (error) {
        console.warn('Frame resource failed while disposing:', error)
      }
    }
  }

  private suspendResources(resources: Iterable<FrameResource>): void {
    for (const resource of new Set(resources)) {
      try {
        resource.suspend()
      } catch (error) {
        console.warn('Frame resource failed while suspending:', error)
      }
    }
  }

  private cancelPreparation(): void {
    this.preparation?.abort()
    this.preparation = undefined
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error('Frame resource host has been disposed')
  }
}

const abortedPreparation = (): DOMException =>
  new DOMException('Frame preparation was superseded', 'AbortError')
