/**
 * Project-wide timing and render configuration.
 *
 * Timeline FPS is intentionally independent from the monitor refresh rate so
 * a frame number represents the same point in time on every machine.
 */
export const definedMotionConfig = {
  timelineFps: 60,
  renderEveryNthFrame: 1,
  seed: 1,
  defaultScene: 'fractal-tree-growth'
} as const
