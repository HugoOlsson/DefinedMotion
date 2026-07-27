import type { RenderProgress } from '../renderProgress'

export const emitRenderProgress = (progress: RenderProgress): void => {
  const format = process.env['DEFINEDMOTION_CLI_PROGRESS']
  if (!format) return
  if (format === 'json') {
    process.stderr.write(
      `${JSON.stringify({ type: 'progress', command: 'render', ...progress })}\n`
    )
    return
  }
  const count =
    progress.completed !== undefined && progress.total !== undefined
      ? ` (${progress.completed}/${progress.total})`
      : ''
  const percent =
    progress.percent !== undefined ? ` ${Math.round(progress.percent)}%` : ''
  process.stderr.write(`DefinedMotion render: ${progress.message}${count}${percent}\n`)
}
