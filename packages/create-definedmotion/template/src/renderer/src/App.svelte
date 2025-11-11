<script lang="ts">
  import './app.css'
  import { generateID, setStateInScene, updateStateInUrl } from './lib/general/helpers'
  import { onDestroy, onMount } from 'svelte'
  import { hotreloadNameLookup, screenFPS, setGlobalContainerRef, type AnimatedScene } from './lib/scene/sceneClass'
  import { loadFonts } from './lib/rendering/objects2d'
  import { animationFPSDivider, entryScene, renderSkip } from '../../entry'
  import { callAllDestroyFunctions } from './lib/general/onDestory'
  import rotateIcon from "./application_assets/360.svg"
  import moveIcon from "./application_assets/move.svg"
  

  let frameValueElement: HTMLParagraphElement
  let timeValueElement: HTMLParagraphElement
  let sliderElement: HTMLInputElement

  const TEXT_FRAME_MS_LIMIT = 0.90*1000 / 30;  // A little lower to avoid skipping frames when timing is unfourtunate
  const SLIDER_FRAME_MS_LIMIT = 0.90*1000 / 60; // A little lower to avoid skipping frames when timing is unfourtunate

  let lastTextUpdate  = 0;
  let lastSliderUpdate = 0;

  let screenRefreshRate = $state(0) 
  let isRendering = $state(false) 

  let isScrubbing = false
  let wasPlayingBeforeScrub = false


  function formatMs(ms: number) {
    const sign = ms < 0 ? '-' : ''
    ms = Math.abs(ms)
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    const millis  = Math.floor(ms % 1000)
    return `${sign}${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(millis).padStart(3,'0')}`
  }


  const animationWindowID = generateID()

  let scene: AnimatedScene
  let hasInitScene = $state(false)

  let isPlayingStateVar = $state(false)

  let lastSetFrame = 0

  const maxSliderValue = 10_000
  let urlUpdaterInterval: ReturnType<typeof setInterval>

  async function handleSliderChange(sliderValue: number) {
    if (scene) {
      const frame = Math.round((sliderValue / maxSliderValue) * (scene.totalSceneTicks - 1))
      if (frame !== lastSetFrame) {
        await scene.jumpToFrameAtIndex(frame)
        updateUIImmediate();
        lastSetFrame = frame
      }
    }
  }

function updateSliderOnly() {
  if (!scene || !sliderElement) return
  if (isScrubbing) return            // <-- single guard
  const denom = Math.max(1, (scene.totalSceneTicks - 1))
  ;(sliderElement as any).value = (scene.sceneRenderTick / denom) * maxSliderValue
}

function updateTextsOnly() {
  if (!scene) return;
  if (frameValueElement) frameValueElement.textContent = `Frame: ${scene.sceneRenderTick}`;
  if (timeValueElement)  timeValueElement.textContent  = `Time: ${formatMs(scene.getCurrentTimeMs())}`;
}

function updateUIImmediate() {
  updateSliderOnly();
  updateTextsOnly();
}


  function maybeUpdateUI() {
  const now = performance.now();

  // ~60 Hz slider
  if (now - lastSliderUpdate >= SLIDER_FRAME_MS_LIMIT) {
    lastSliderUpdate = now;
    updateSliderOnly();
  }

  // ~30 Hz texts
  if (now - lastTextUpdate >= TEXT_FRAME_MS_LIMIT) {
    lastTextUpdate = now;
    updateTextsOnly();
  }
}

  onMount(async () => {
    if (!entryScene) return
    await loadFonts()
    const animationWindow = document.getElementById(animationWindowID)
    
    if (!animationWindow || !sliderElement) return

    setGlobalContainerRef(animationWindow)

    scene = entryScene()
    hasInitScene = true

    scene.playEffectFunction = () => {
     maybeUpdateUI();
    }
    scene.renderingEventFunction = (isStart) => {
      isRendering = isStart
       if (!isStart) {
        // render just finished; force UI to reflect the reset frame
        updateUIImmediate()
      }
    }
    const currentWidth = animationWindow.clientWidth
    animationWindow.style.height = `${currentWidth / scene.getAspectRatio()}px`

    setStateInScene(scene)
    lastSetFrame = scene.sceneRenderTick

    urlUpdaterInterval = setInterval(() => {
      updateStateInUrl(scene.sceneRenderTick)
    }, 500)

    // Add listener to handle window resize events
    window.addEventListener('resize', () => {
      const currentWidth = animationWindow.clientWidth
      animationWindow.style.height = `${currentWidth / scene.getAspectRatio()}px`
    })

   screenRefreshRate = screenFPS

    // ipcRenderer.send('resize-window', { width: 1000, height: 1000 })
  })

  onDestroy(() => {
    clearInterval(urlUpdaterInterval)
    callAllDestroyFunctions()
  })

  function fmt(n: number) {
  return Number(n).toPrecision(7);
}

function cameraPositionCode() {
  const p = scene.camera.position;
  return `scene.camera.position.set(
  ${fmt(p.x)}, 
  ${fmt(p.y)}, 
  ${fmt(p.z)}
);`;
}

function cameraRotationCode() {
  const q = scene.camera.quaternion;
  return `scene.camera.quaternion.set(
  ${fmt(q.x)}, 
  ${fmt(q.y)}, 
  ${fmt(q.z)}, 
  ${fmt(q.w)}
);`;
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
</script>

<div class=" flex flex-col p-2">
  <div id={animationWindowID} class="w-full rounded-sm overflow-clip"></div>
  {#if isRendering}
 <p class="text-[17px] self-center p-6 pb-1">Do <strong>not save</strong> code during rendering</p>
   <p class="text-xs self-center pt-0 p-2">The viewer might hot reload and affect the result</p>
  {/if}
  
  <div class="flex justify-between mt-2 font-bold text-sm items-center">

 

    <button
    class="w-[70px] text-xs cursor-pointer bg-black/5 rounded-full p-1 hover:bg-black/10 transition"
          onclick={() => {
            if (scene.isPlaying) {
              scene.pause()
              updateUIImmediate();
              isPlayingStateVar = false
            } else {
              scene.playSequenceOfAnimation(scene.sceneRenderTick, scene.totalSceneTicks - 1)
              isPlayingStateVar = true
            }
          }}>{isPlayingStateVar ? 'Pause' : 'Play'}</button
        >
    

    <div class="flex ">
    <p bind:this={frameValueElement} class="font-normal text-[0.7rem] leading-none mr-2 w-[83px]">Frame:</p>
      <p bind:this={timeValueElement} class="font-normal text-[0.7rem] leading-none w-[93px] ">Time:</p>
      </div>
    <button
    class="w-[70px] text-xs cursor-pointer bg-black/5 rounded-full  p-1 hover:bg-black/10 transition"
      onclick={() => {
        scene.render()
      }}>Render</button
    >
  </div>
  <div class="w-full px-0 mx-0">
    <input
      bind:this={sliderElement}
      type="range"
      min="0"
      max={maxSliderValue}

      class="w-full focus:outline-none"
      onpointerdown={() => {
        if (!scene) return
        isScrubbing = true
        wasPlayingBeforeScrub = scene.isPlaying
        if (scene.isPlaying) {
          scene.pause()                // silences audio and stops RAF
          isPlayingStateVar = false
        }
      }}
      oninput={(e: any) => {
        // while scrubbing: jump visuals quietly; when not scrubbing, behaves like before
        const v = Number(e.target.value)
        handleSliderChange(v)
      }}
      onpointerup={(e: any) => {
        if (!scene) return
        isScrubbing = false
        const v = Number((e.target as HTMLInputElement).value)
        // ensure we’re at the dropped frame
        handleSliderChange(v)
        if (wasPlayingBeforeScrub) {
          // resume cleanly from here
          scene.playSequenceOfAnimation(scene.sceneRenderTick, scene.totalSceneTicks - 1)
          isPlayingStateVar = true
        }
      }}
    />
  </div>

  <div class="h-4"></div>
  {#if hasInitScene && scene}
 
  <p class="font-bold text-sm">Helpers</p>
  <div class="h-2"></div>
  <div class="flex flex-wrap gap-2">
    <button onclick={() => copyToClipboard(cameraPositionCode())} class="text-[0.65rem] font-medium cursor-pointer  bg-black/5 rounded-full p-1 pl-4 pr-4 hover:bg-black/10 transition active:bg-blue-200 active:border-blue-200" >
        <div class="flex gap-1 items-center">

        <p>Copy camera <strong>position</strong></p>
      <img src={moveIcon} alt="Rotation icon" class="w-[15px]"/></div>
    </button>
    <button onclick={() => copyToClipboard(cameraRotationCode())} class="text-[0.65rem] font-medium cursor-pointer  bg-black/5 rounded-full p-1 pl-4 pr-4 hover:bg-black/10 transition active:bg-blue-200 active:border-blue-200" >
        <div class="flex gap-1 items-center">

        <p>Copy camera <strong>rotation</strong></p>
      <img src={rotateIcon} alt="Rotation icon" class="w-[15px]"/></div>
    </button>
  </div>

   <div class="h-6"></div>
  <p class="font-bold text-sm">Details</p>
  <div class="h-2"></div>
  <p class="text-xs">Animation playback FPS: <strong>{(screenRefreshRate/animationFPSDivider).toFixed(2)}</strong> Hz, rendered video FPS: <strong>{(screenRefreshRate/animationFPSDivider/renderSkip).toFixed(2)}</strong> Hz</p>
<div class="h-2"></div>
 <p class="text-[0.7rem] opacity-50">Hot reload mode: <strong>{hotreloadNameLookup(scene.hotReloadSetting)}</strong></p>
  <p class="text-[0.7rem] opacity-50">Screen refresh rate: <strong>{screenRefreshRate.toFixed(2)}</strong> Hz</p>
  <p class="text-[0.7rem] opacity-50">Animation FPS divider <strong>{animationFPSDivider}</strong></p>
  <p class="text-[0.7rem] opacity-50">Render skip constant <strong>{renderSkip}</strong></p>
  {/if}

 
  <!--
  <p id="cameraPositionTextID" class="mt-2 text-xs"></p>
  <p id="cameraRotationTextID" class="mt-2 text-xs"></p>
  -->
</div>

<style>
  /* Chrome-only styling for range input */
  input[type='range'] {
    -webkit-appearance: none;
    background: transparent;
  }

  /* Track style for Chrome */
  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
  }

  /* Thumb style for Chrome */
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 10px;
    height: 16px;
    border-radius: 5px;
    background: #c2c2c2;
    border: 2px solid #616161;
    margin-top: -6px; /* Center the thumb on the track */
    cursor: pointer;
     transition: all 0.1s ease;

    /* Larger hitbox using box-shadow trick */
    box-shadow: 0 0 0 8px transparent;
  }

  input[type='range']::-webkit-slider-thumb:hover {
    background: #616161;
  }
</style>
