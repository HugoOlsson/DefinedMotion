import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'

export async function deleteRenderedContent() {
  const folderPath = './image_renders'
  const audioRendersDir = './audio_renders'

  try {
    // Read all entries in the folder.
    const entries = await fs.readdir(folderPath, { withFileTypes: true })

    // Filter for directories starting with "render_".
    const renderDirs = entries.filter(
      (entry) => entry.isDirectory() && entry.name.startsWith('render_')
    )

    // Loop over the filtered directories and remove each.
    await Promise.all(
      renderDirs.map(async (entry) => {
        const fullPath = path.join(folderPath, entry.name)
        await fs.rm(fullPath, { recursive: true, force: true })
      })
    )

    fsSync.readdirSync(audioRendersDir).forEach((item) => {
      const itemPath = path.join(audioRendersDir, item)
      fsSync.rmSync(itemPath, { recursive: true, force: true })
    })

    console.log('All render cache have been deleted.')
  } catch (error) {
    console.error(`Error while deleting render folders: ${(error as any).message}`)
  }
}
