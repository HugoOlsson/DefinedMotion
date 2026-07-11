export const DEFINEDMOTION_ASSET_SCHEME = 'definedmotion-asset'

export class AssetRuntimeError extends Error {
  constructor(
    public readonly code: 'INVALID_ASSET_PATH' | 'ASSET_NOT_FOUND' | 'ASSET_LOAD_FAILED',
    message: string
  ) {
    super(message)
    this.name = 'AssetRuntimeError'
  }
}

export type AssetSource = SceneAsset | string

/**
 * A lightweight reference to a file below `src/assets`.
 * Creating a reference performs no I/O; bytes are fetched only by a loader or
 * one of the explicit read methods.
 */
export class SceneAsset {
  readonly path: string
  readonly url: string

  constructor(path: string) {
    this.path = validateAssetPath(path)
    this.url = `${DEFINEDMOTION_ASSET_SCHEME}://project/${this.path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`
    Object.freeze(this)
  }

  async response(): Promise<Response> {
    let response: Response
    try {
      response = await fetch(this.url)
    } catch (error) {
      throw new AssetRuntimeError(
        'ASSET_LOAD_FAILED',
        `Could not load asset "${this.path}": ${errorMessage(error)}`
      )
    }

    if (!response.ok) {
      throw new AssetRuntimeError(
        response.status === 404 ? 'ASSET_NOT_FOUND' : 'ASSET_LOAD_FAILED',
        `Could not load asset "${this.path}": ${response.status} ${response.statusText}`
      )
    }
    return response
  }

  async text(): Promise<string> {
    return (await this.response()).text()
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return (await this.response()).arrayBuffer()
  }

  async blob(): Promise<Blob> {
    return (await this.response()).blob()
  }

  async json<T = unknown>(): Promise<T> {
    return (await this.response()).json() as Promise<T>
  }
}

export const createAssetReference = (path: string): SceneAsset => new SceneAsset(path)

export const assetUrl = (source: AssetSource): string =>
  source instanceof SceneAsset ? source.url : source

export const assetPath = (source: AssetSource): string | undefined => {
  if (source instanceof SceneAsset) return source.path

  try {
    const url = new URL(source)
    if (url.protocol !== `${DEFINEDMOTION_ASSET_SCHEME}:` || url.hostname !== 'project') {
      return undefined
    }
    return decodeURIComponent(url.pathname).replace(/^\/+/, '')
  } catch {
    return undefined
  }
}

export const validateAssetPath = (path: string): string => {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new AssetRuntimeError('INVALID_ASSET_PATH', 'Asset path must be a non-empty string')
  }
  if (path !== path.trim()) {
    throw new AssetRuntimeError(
      'INVALID_ASSET_PATH',
      `Asset path cannot start or end with whitespace: "${path}"`
    )
  }
  if (path.includes('\\')) {
    throw new AssetRuntimeError(
      'INVALID_ASSET_PATH',
      `Asset path must use forward slashes: "${path}"`
    )
  }
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path) || path.includes('://')) {
    throw new AssetRuntimeError(
      'INVALID_ASSET_PATH',
      `Asset path must be relative to src/assets: "${path}"`
    )
  }
  if (path.includes('?') || path.includes('#') || path.includes('\0')) {
    throw new AssetRuntimeError(
      'INVALID_ASSET_PATH',
      `Asset path cannot contain a query, fragment, or null byte: "${path}"`
    )
  }

  const segments = path.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new AssetRuntimeError(
      'INVALID_ASSET_PATH',
      `Asset path must not contain empty, current-directory, or parent-directory segments: "${path}"`
    )
  }

  return path
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
