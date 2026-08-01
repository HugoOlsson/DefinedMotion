export interface FrameRateSample {
  readonly fps: number
  readonly averageFrameTimeMs: number
  readonly p95FrameTimeMs: number
  readonly unpresentedTimelineFrames: number
}

export class FrameRateMonitor {
  private startedAt?: number
  private previousTimestamp?: number
  private previousTimelineFrame?: number
  private frameIntervals: number[] = []
  private unpresentedTimelineFrames = 0

  constructor(private readonly sampleDurationMs = 500) {
    if (!Number.isFinite(sampleDurationMs) || sampleDurationMs <= 0) {
      throw new Error('Frame-rate sample duration must be a positive finite number')
    }
  }

  record(timestamp: number, timelineFrame: number): FrameRateSample | undefined {
    if (!Number.isFinite(timestamp)) throw new Error('Frame timestamp must be finite')
    if (!Number.isInteger(timelineFrame)) throw new Error('Timeline frame must be an integer')
    if (
      this.startedAt === undefined ||
      this.previousTimestamp === undefined ||
      timestamp < this.previousTimestamp
    ) {
      this.startedAt = timestamp
      this.previousTimestamp = timestamp
      this.previousTimelineFrame = timelineFrame
      this.frameIntervals = []
      return undefined
    }

    this.frameIntervals.push(timestamp - this.previousTimestamp)
    if (
      this.previousTimelineFrame !== undefined &&
      timelineFrame > this.previousTimelineFrame + 1
    ) {
      this.unpresentedTimelineFrames += timelineFrame - this.previousTimelineFrame - 1
    }
    this.previousTimestamp = timestamp
    this.previousTimelineFrame = timelineFrame

    const elapsed = timestamp - this.startedAt
    if (elapsed < this.sampleDurationMs) return undefined

    const sortedIntervals = [...this.frameIntervals].sort((a, b) => a - b)
    const p95Index = Math.max(0, Math.ceil(sortedIntervals.length * 0.95) - 1)
    const sample: FrameRateSample = {
      fps: (this.frameIntervals.length * 1000) / elapsed,
      averageFrameTimeMs:
        this.frameIntervals.reduce((total, interval) => total + interval, 0) /
        this.frameIntervals.length,
      p95FrameTimeMs: sortedIntervals[p95Index],
      unpresentedTimelineFrames: this.unpresentedTimelineFrames
    }

    this.startedAt = timestamp
    this.frameIntervals = []
    return sample
  }

  reset(): void {
    this.startedAt = undefined
    this.previousTimestamp = undefined
    this.previousTimelineFrame = undefined
    this.frameIntervals = []
    this.unpresentedTimelineFrames = 0
  }
}
