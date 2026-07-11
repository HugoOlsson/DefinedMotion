// src/renderer/lib/rendering/hdri.ts

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { AnimatedScene } from '../scene/sceneClass';
import {
  AssetRuntimeError,
  assetPath,
  assetUrl,
  createAssetReference,
  type AssetSource
} from '../assets/assetReference';

import vert_blur_hdri from '../shaders/hdri_blur/vert.glsl?raw';
import frag_blur_hdri from '../shaders/hdri_blur/frag.glsl?raw';

// ---------------------------------------------------------------------------
// Public types & enums
// ---------------------------------------------------------------------------

export enum HDRIs {
  photoStudio1 = 'hdri/photo-studio1.hdr',
  photoStudio2 = 'hdri/photo-studio2.hdr',
  photoStudio3 = 'hdri/photo-studio3.hdr',
  outdoor1 = 'hdri/outdoor1.hdr',
  indoor1 = 'hdri/indoor1.hdr',
  metro1 = 'hdri/metro1.hdr'
}

/**
 * Lightweight description of a loaded HDRI.
 * The actual heavy GPU setup happens when you call addHDRI().
 */
export interface HDRIData {
  texture: THREE.DataTexture;
  blurAmount: number;
}

// ---------------------------------------------------------------------------
// Internal caches
// ---------------------------------------------------------------------------

// Reused loader
const rgbeLoader = new RGBELoader().setDataType(THREE.FloatType);

// path -> DataTexture promise (so we only load + decode once per file)
const sourceCache = new Map<string, Promise<THREE.DataTexture>>();

// (rendererId|textureUUID) -> envMap (PMREM output)
const envMapCache = new Map<string, THREE.Texture>();

// (rendererId|textureUUID|blur|opacity) -> blurred background texture
const blurCache = new Map<string, THREE.Texture>();

let rendererIdCounter = 1;
function getRendererId(renderer: THREE.WebGLRenderer): number {
  const r = renderer as any;
  if (!r.__dmHdriId) {
    r.__dmHdriId = rendererIdCounter++;
  }
  return r.__dmHdriId;
}

function envKey(renderer: THREE.WebGLRenderer, tex: THREE.Texture): string {
  return `${getRendererId(renderer)}|${tex.uuid}`;
}

function blurKey(
  renderer: THREE.WebGLRenderer,
  tex: THREE.Texture,
  blurAmount: number,
  opacity: number
): string {
  return `${getRendererId(renderer)}|${tex.uuid}|${blurAmount.toFixed(3)}|${opacity.toFixed(3)}`;
}

// ---------------------------------------------------------------------------
// 1) Load HDRI file lazily (no renderer needed)
// ---------------------------------------------------------------------------

/**
 * Load and decode the HDRI once per asset URL. Call this from the selected
 * scene's build function; subsequent rebuilds reuse the cached decode.
 *
 *   const hdriData = await loadHDRIData(scene.asset(HDRIs.outdoor1), 2);
 *
 * Then you can reuse hdriData across many AnimatedScene instances.
 */
export const loadHDRIData = async (
  path: AssetSource,
  blurAmount: number,
): Promise<HDRIData> => {
  const source =
    typeof path === 'string' && Object.values(HDRIs).includes(path as HDRIs)
      ? createAssetReference(path)
      : path;
  const key = assetUrl(source);
  const projectPath = assetPath(source);

  let texturePromise = sourceCache.get(key);
  if (!texturePromise) {
    texturePromise = new Promise<THREE.DataTexture>((resolve, reject) => {
      rgbeLoader.load(
        key as any,
        (texture) => {
          // Equirectangular HDR setup
          texture.mapping = THREE.EquirectangularReflectionMapping;
          texture.magFilter = THREE.LinearFilter;
          texture.minFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          resolve(texture);
        },
        undefined,
        (error) => {
          console.error('Error loading HDRI:', error);
          reject(
            projectPath
              ? new AssetRuntimeError(
                  'ASSET_LOAD_FAILED',
                  `Could not load HDRI asset "${projectPath}": ${error instanceof Error ? error.message : String(error)}`
                )
              : error
          );
        }
      );
    });
    sourceCache.set(key, texturePromise);
  }

  const texture = await texturePromise;

  return {
    texture,
    blurAmount,
  };
};

// ---------------------------------------------------------------------------
// 2) One-off blur pass: render full-screen quad into a render target
// ---------------------------------------------------------------------------

function blurHDRITexture(
  renderer: THREE.WebGLRenderer,
  source: THREE.DataTexture,
  blurAmount: number,
  opacity: number
): THREE.Texture {
  if (blurAmount <= 0.0001) {
    // No blur required – reuse the original texture directly.
    return source;
  }

  const width = source.image.width;
  const height = source.image.height;

  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter
  });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: source },
      uBlurAmount: { value: blurAmount },
      uTextureSize: { value: new THREE.Vector2(width, height) },
      sigma: { value: 3.0 },
      opacity: { value: opacity },
      uSaturation: { value: 1.0 } // kept for future color-tweak usage
    },
    vertexShader: vert_blur_hdri,
    fragmentShader: frag_blur_hdri,
    depthTest: false,
    depthWrite: false
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  const prevTarget = renderer.getRenderTarget();

  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(prevTarget);

  quad.geometry.dispose();
  material.dispose();

  // The render target holds the baked blur texture;
  // we keep the target alive as long as the texture is in use.
  return target.texture;
}

// ---------------------------------------------------------------------------
// 3) Cached envMap + blurred background texture getters
// ---------------------------------------------------------------------------

function getEnvMap(renderer: THREE.WebGLRenderer, tex: THREE.DataTexture): THREE.Texture {
  const key = envKey(renderer, tex);
  const cached = envMapCache.get(key);
  if (cached) return cached;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envMap = pmremGenerator.fromEquirectangular(tex).texture;
  pmremGenerator.dispose();

  envMapCache.set(key, envMap);
  return envMap;
}

function getBlurredBackgroundTexture(
  renderer: THREE.WebGLRenderer,
  hdriData: HDRIData,
  opacity: number
): THREE.Texture {
  const { texture, blurAmount } = hdriData;
  const key = blurKey(renderer, texture, blurAmount, opacity);
  const cached = blurCache.get(key);
  if (cached) return cached;

  const blurred = blurHDRITexture(renderer, texture, blurAmount, opacity);
  blurCache.set(key, blurred);
  return blurred;
}

// ---------------------------------------------------------------------------
// 4) Public: attach HDRI to an AnimatedScene
// ---------------------------------------------------------------------------

/**
 * Apply a previously loaded HDRI to the scene:
 * - Sets scene.environment using a cached PMREM envMap.
 * - Creates a big background sphere using a baked, blurred texture.
 *
 * The heavy work (file IO, decode, blur) is cached and reused.
 */
export async function addHDRI(
  scene: AnimatedScene,
  hdriData: HDRIData,
  lightingIntensity = 1.0,
  opacity: number = 1.0,
): Promise<THREE.Mesh> {
  const { renderer } = scene;

  // Cached per renderer + texture:
  const envMap = getEnvMap(renderer, hdriData.texture);

  // Cached per renderer + texture + blurAmount + opacity:
  const backgroundTexture = getBlurredBackgroundTexture(renderer, hdriData, opacity);

  // Background sphere
  const geometry = new THREE.SphereGeometry(scene.farLimitRender / 2, 40, 40);

  const material = new THREE.MeshBasicMaterial({
    map: backgroundTexture,
    side: THREE.BackSide,
    transparent: opacity < 1,
    opacity: opacity
  });

  const backgroundSphere = new THREE.Mesh(geometry, material);
  backgroundSphere.renderOrder = -1;
  scene.scene.add(backgroundSphere);

  // Environment for PBR materials etc.
  scene.scene.environment = envMap;
  scene.scene.environmentIntensity = lightingIntensity;

  return backgroundSphere;
}

// ---------------------------------------------------------------------------
// (Optional) cache clearing helpers if you ever need them
// ---------------------------------------------------------------------------

export function clearHDRICaches(): void {
  sourceCache.clear();
  envMapCache.clear();
  blurCache.clear();
}
