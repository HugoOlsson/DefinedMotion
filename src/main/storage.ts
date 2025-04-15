import path from 'path'
import fs from 'fs/promises'

export async function deleteImageRendersFolderContents() {
  const folderPath = './image_renders'

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

    console.log('All "render_" directories in "image_renders/" have been deleted.')
  } catch (error) {
    console.error(`Error while deleting render folders: ${(error as any).message}`)
  }
}
