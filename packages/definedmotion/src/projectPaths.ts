export const getProjectRoot = (): string =>
  process.env['DEFINEDMOTION_PROJECT_ROOT'] ?? process.cwd()

const projectPath = (...segments: string[]): string =>
  [getProjectRoot().replace(/[\\/]+$/, ''), ...segments].join('/')

export const getProjectRuntimeRoot = (): string =>
  projectPath('.definedmotion')

export const getFrameCacheRoot = (): string =>
  projectPath('.definedmotion', 'cache', 'frames')

export const getAudioCacheRoot = (): string =>
  projectPath('.definedmotion', 'cache', 'audio')

export const getRenderOutputRoot = (): string =>
  projectPath('renders')
