import { app, protocol } from 'electron'
import { createReadStream, existsSync, realpathSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'

export const DEFINEDMOTION_ASSET_SCHEME = 'definedmotion-asset'

protocol.registerSchemesAsPrivileged([
  {
    scheme: DEFINEDMOTION_ASSET_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

export const getProjectAssetRoot = (): string =>
  app.isPackaged ? join(process.resourcesPath, 'assets') : resolve(process.cwd(), 'src', 'assets')

export const assetUrlToFilePath = (value: string): string | undefined => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }

  if (url.protocol !== `${DEFINEDMOTION_ASSET_SCHEME}:`) return undefined
  if (url.hostname !== 'project') {
    throw new Error(`Unknown DefinedMotion asset host: ${url.hostname}`)
  }

  const assetPath = decodeAssetPath(url.pathname)
  const root = getProjectAssetRoot()
  const filePath = containedPath(root, assetPath)
  if (existsSync(filePath)) {
    assertContained(realpathSync(root), realpathSync(filePath))
  }
  return filePath
}

export const registerAssetProtocol = (): void => {
  protocol.handle(DEFINEDMOTION_ASSET_SCHEME, async (request) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD' }
        })
      }

      const url = new URL(request.url)
      if (url.hostname !== 'project') return new Response('Unknown asset host', { status: 404 })

      const root = getProjectAssetRoot()
      const assetPath = decodeAssetPath(url.pathname)
      const filePath = containedPath(root, assetPath)

      let fileStats
      try {
        fileStats = await stat(filePath)
      } catch {
        return new Response('Asset not found', { status: 404 })
      }
      if (!fileStats.isFile()) return new Response('Asset not found', { status: 404 })

      const realRoot = realpathSync(root)
      const realFile = realpathSync(filePath)
      assertContained(realRoot, realFile)

      const range = parseRange(request.headers.get('range'), fileStats.size)
      if (range === 'invalid') {
        return new Response('Requested range not satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileStats.size}` }
        })
      }

      const start = range?.start ?? 0
      const end = range?.end ?? Math.max(0, fileStats.size - 1)
      const contentLength = fileStats.size === 0 ? 0 : end - start + 1
      const headers = new Headers({
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Content-Length': String(contentLength),
        'Content-Type': contentType(filePath)
      })
      if (range) headers.set('Content-Range', `bytes ${start}-${end}/${fileStats.size}`)

      if (request.method === 'HEAD' || fileStats.size === 0) {
        return new Response(null, { status: range ? 206 : 200, headers })
      }

      const nodeStream = createReadStream(realFile, { start, end })
      const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>
      return new Response(body, { status: range ? 206 : 200, headers })
    } catch (error) {
      console.error('DefinedMotion asset request failed:', error)
      return new Response('Invalid asset request', { status: 400 })
    }
  })
}

const decodeAssetPath = (pathname: string): string => {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    throw new Error('Asset URL contains invalid encoding')
  }

  const assetPath = decoded.replace(/^\/+/, '')
  if (
    assetPath === '' ||
    assetPath.includes('\0') ||
    assetPath.includes('\\') ||
    assetPath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error('Asset URL contains an invalid path')
  }
  return assetPath
}

const containedPath = (root: string, assetPath: string): string => {
  const filePath = resolve(root, assetPath)
  assertContained(root, filePath)
  return filePath
}

const assertContained = (root: string, candidate: string): void => {
  const relativePath = relative(resolve(root), resolve(candidate))
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error('Asset path escapes src/assets')
  }
}

type ByteRange = { start: number; end: number }

const parseRange = (header: string | null, size: number): ByteRange | 'invalid' | undefined => {
  if (!header) return undefined
  if (size === 0) return 'invalid'

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid'

  let start: number
  let end: number
  if (match[1] === '') {
    const suffixLength = Number(match[2])
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return 'invalid'
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Number(match[2])
    if (!Number.isInteger(start) || !Number.isInteger(end)) return 'invalid'
    end = Math.min(end, size - 1)
  }

  if (start < 0 || start >= size || end < start) return 'invalid'
  return { start, end }
}

const contentTypes: Record<string, string> = {
  '.avif': 'image/avif',
  '.bin': 'application/octet-stream',
  '.csv': 'text/csv; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.hdr': 'image/vnd.radiance',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp'
}

const contentType = (filePath: string): string =>
  contentTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
