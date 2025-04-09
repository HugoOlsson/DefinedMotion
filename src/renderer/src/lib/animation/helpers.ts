import { screenFps } from '../../scenes/entry'

// Convert ticks (frames) to milliseconds
export const ticksToMillis = (ticks: number) => (ticks / screenFps) * 1000

// Convert milliseconds to the closest whole number of ticks
export const millisToTicks = (ms: number) => Math.ceil((ms / 1000) * screenFps)
