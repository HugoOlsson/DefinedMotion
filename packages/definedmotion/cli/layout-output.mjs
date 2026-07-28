import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const managedScreenshotPatterns = [
  /^frame-\d+\.png$/,
  /^incident-\d+-frame-\d+\.png$/
]

export function cleanupStaleLayoutCheckScreenshots(result) {
  if (
    !result?.success ||
    result.command !== 'layout-check' ||
    typeof result.outputDirectory !== 'string' ||
    !existsSync(result.outputDirectory)
  ) {
    return
  }

  const referencedPaths = new Set(
    (result.incidents ?? [])
      .map((incident) => incident?.screenshotPath)
      .filter((path) => typeof path === 'string' && path !== '')
      .map((path) => resolve(path))
  )

  for (const entry of readdirSync(result.outputDirectory, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      !managedScreenshotPatterns.some((pattern) => pattern.test(entry.name))
    ) {
      continue
    }
    const path = resolve(join(result.outputDirectory, entry.name))
    if (!referencedPaths.has(path)) rmSync(path, { force: true })
  }
}
