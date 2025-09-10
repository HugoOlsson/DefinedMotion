// NON TESTED FUNCTIONS!

/**
 * Generate `num` evenly‑spaced numbers from `start` to `end` (inclusive).
 */
export function linspace(start: number, end: number, num: number): number[] {
  if (num < 2) return num === 1 ? [start] : []
  const step = (end - start) / (num - 1)
  return Array.from({ length: num }, (_v, i) => start + step * i)
}

/**
 * Like numpy.arange: start (inclusive) to stop (exclusive) by step.
 */
export function arange(start: number, stop: number, step = 1): number[] {
  const length = Math.max(Math.ceil((stop - start) / step), 0)
  return Array.from({ length }, (_v, i) => start + step * i)
}
