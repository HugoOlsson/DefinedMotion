import { defineScene } from 'definedmotion'
import { AssetRuntimeError, packageAsset, type SceneAsset } from 'definedmotion/assets'
import {
  AnimatedScene,
  HotReloadSetting,
  SceneRuntimeError,
  SpaceSetting
} from 'definedmotion'

export default defineScene({
  id: 'test-asset-references',
  name: 'Asset References',
  isTest: true,
  create: testAssetReferences
})

export function testAssetReferences(): AnimatedScene {
  return new AnimatedScene(
    320,
    180,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
      const svg = scene.asset('svg/gravity_text.svg')
      const svgText = await svg.text()
      if (!svgText.includes('<svg')) {
        throw new SceneRuntimeError('ASSET_TEST_FAILED', 'SVG asset did not return text content')
      }

      await assertByteRange(scene.asset('audio/tick_sound.mp3'))
      await assertPackageAsset(packageAsset('fonts/Montserrat-Medium.woff'))
      assertInvalidPathRejected(scene)
      await assertMissingAssetRejected(scene.asset('missing-asset.svg'))

      scene.addWait(1)
    }
  )
}

const assertPackageAsset = async (asset: SceneAsset): Promise<void> => {
  if ((await asset.arrayBuffer()).byteLength === 0) {
    throw new SceneRuntimeError('ASSET_TEST_FAILED', 'Package-owned font asset was empty')
  }
}

const assertByteRange = async (asset: SceneAsset): Promise<void> => {
  const response = await fetch(asset.url, { headers: { Range: 'bytes=0-3' } })
  const bytes = await response.arrayBuffer()
  if (
    response.status !== 206 ||
    !/^bytes 0-3\/\d+$/.test(response.headers.get('content-range') ?? '') ||
    bytes.byteLength !== 4
  ) {
    throw new SceneRuntimeError(
      'ASSET_TEST_FAILED',
      'Asset protocol did not honor a four-byte range request'
    )
  }
}

const assertInvalidPathRejected = (scene: AnimatedScene): void => {
  try {
    scene.asset('../outside.txt')
  } catch (error) {
    if (error instanceof AssetRuntimeError && error.code === 'INVALID_ASSET_PATH') return
    throw error
  }
  throw new SceneRuntimeError('ASSET_TEST_FAILED', 'Parent-directory asset path was accepted')
}

const assertMissingAssetRejected = async (asset: SceneAsset): Promise<void> => {
  try {
    await asset.text()
  } catch (error) {
    if (error instanceof AssetRuntimeError && error.code === 'ASSET_NOT_FOUND') return
    throw error
  }
  throw new SceneRuntimeError('ASSET_TEST_FAILED', 'Missing asset did not return ASSET_NOT_FOUND')
}
