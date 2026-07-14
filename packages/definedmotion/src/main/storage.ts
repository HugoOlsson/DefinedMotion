import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
import { getAudioCacheRoot, getFrameCacheRoot } from '../projectPaths'

export async function deleteRenderedContent() {
  const folderPath = getFrameCacheRoot()
  const audioRendersDir = getAudioCacheRoot()

  try {
    if (fsSync.existsSync(folderPath)) {
      const entries = await fs.readdir(folderPath, { withFileTypes: true })
      const renderDirs = entries.filter(
        (entry) => entry.isDirectory() && entry.name.startsWith('render_')
      )
      await Promise.all(
        renderDirs.map(async (entry) => {
          const fullPath = path.join(folderPath, entry.name)
          await fs.rm(fullPath, { recursive: true, force: true })
        })
      )
    }

    if (fsSync.existsSync(audioRendersDir)) {
      fsSync
        .readdirSync(audioRendersDir)
        .filter((item) => !item.startsWith('.'))
        .forEach((item) => {
          const itemPath = path.join(audioRendersDir, item)
          fsSync.rmSync(itemPath, { recursive: true, force: true })
        })
    }

    console.log('All render cache have been deleted.')
  } catch (error) {
    console.error(`Error while deleting render folders: ${(error as any).message}`)
  }
}
