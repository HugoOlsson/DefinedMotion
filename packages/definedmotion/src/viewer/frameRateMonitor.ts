export class FrameRateMonitor {
  private startedAt?: number
  private presentationCount = 0

  constructor(private readonly sampleDurationMs = 500) {
    if (!Number.isFinite(sampleDurationMs) || sampleDurationMs <= 0) {
      throw new Error('Frame-rate sample duration must be a positive finite number')
    }
  }

  record(timestamp: number): number | undefined {
    if (!Number.isFinite(timestamp)) throw new Error('Frame timestamp must be finite')
    if (this.startedAt === undefined || timestamp < this.startedAt) {
      this.startedAt = timestamp
      this.presentationCount = 1
      return undefined
    }

    this.presentationCount++
    const elapsed = timestamp - this.startedAt
    if (elapsed < this.sampleDurationMs) return undefined

    const fps = ((this.presentationCount - 1) * 1000) / elapsed
    this.startedAt = timestamp
    this.presentationCount = 1
    return fps
  }

  reset(): void {
    this.startedAt = undefined
    this.presentationCount = 0
  }
}
