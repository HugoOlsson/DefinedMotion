<script lang="ts">
  import './app.css'
  import { setStateInScene, updateStateInUrl } from './sceneState'
  import { onDestroy, onMount } from 'svelte'
  import { hotreloadNameLookup, renderOutputFps, SceneRuntimeError, screenFPS, setGlobalContainerRef, timelineFPS, type AnimatedScene } from '../runtime/scene/sceneClass'
  import { loadFonts } from '../runtime/rendering/objects2d'
  import { generateID } from '../runtime/id'
  import { entryScene, renderSkip } from 'virtual:definedmotion-project'
  import { callAllDestroyFunctions } from '../runtime/lifecycle'
  import rotateIcon from './assets/360.svg'
  import moveIcon from './assets/move.svg'
  

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

  let pendingSliderValue: number | undefined
  let sliderDrain: Promise<void> | undefined

  const maxSliderValue = 10_000
  let urlUpdaterInterval: ReturnType<typeof setInterval>

  function handleSliderChange(sliderValue: number): Promise<void> {
    pendingSliderValue = sliderValue
    if (!sliderDrain) {
      sliderDrain = drainSliderChanges().finally(() => {
        sliderDrain = undefined
      })
    }
    return sliderDrain
  }

  function startPlaybackFromCurrent(): void {
    if (!scene || scene.isPlaying) return
    isPlayingStateVar = true
    void scene
      .playSequenceOfAnimation(scene.sceneRenderTick, scene.totalSceneTicks - 1)
      .catch((error) => {
        isPlayingStateVar = false
        console.error('Could not start playback:', error)
      })
  }

  async function drainSliderChanges(): Promise<void> {
    while (pendingSliderValue !== undefined) {
      const sliderValue = pendingSliderValue
      pendingSliderValue = undefined
      if (!scene) continue
      const frame = Math.round((sliderValue / maxSliderValue) * (scene.totalSceneTicks - 1))
      if (frame === scene.sceneRenderTick) continue
      try {
        await scene.jumpToFrameAtIndex(frame)
      } catch (error) {
        if (!(error instanceof SceneRuntimeError) || error.code !== 'SCENE_BUSY' || scene.isPlaying) {
          throw error
        }
        pendingSliderValue ??= sliderValue
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        continue
      }
      updateUIImmediate()
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

    scene.playEffectFunction = () => {
      isPlayingStateVar = scene.isPlaying
      maybeUpdateUI();
    }
    scene.renderingEventFunction = (isStart) => {
      isRendering = isStart
       if (!isStart) {
         isPlayingStateVar = false
        // render just finished; force UI to reflect the reset frame
        updateUIImmediate()
      }
    }
   
    await setStateInScene(scene)
    hasInitScene = true
    urlUpdaterInterval = setInterval(() => {
      updateStateInUrl(scene.sceneRenderTick)
    }, 500)

  

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
    disabled={!hasInitScene || isRendering}
    class="w-[70px] text-xs cursor-pointer bg-black/5 rounded-full p-1 hover:bg-black/10 transition"
          onclick={() => {
            if (scene.isPlaying) {
              scene.pause()
              updateUIImmediate();
              isPlayingStateVar = false
            } else {
              startPlaybackFromCurrent()
            }
          }}>{isPlayingStateVar ? 'Pause' : 'Play'}</button
        >
    

    <div class="flex ">
    <p bind:this={frameValueElement} class="font-normal text-[0.7rem] leading-none mr-2 w-[83px]">Frame:</p>
      <p bind:this={timeValueElement} class="font-normal text-[0.7rem] leading-none w-[93px] ">Time:</p>
      </div>
    <button
    disabled={!hasInitScene || isRendering || isPlayingStateVar}
    class="w-[70px] text-xs cursor-pointer bg-black/5 rounded-full  p-1 hover:bg-black/10 transition"
      onclick={() => {
        void scene
          .render()
          .catch((error) => console.error('Could not render the scene:', error))
      }}>Render</button
    >
  </div>
  <div class="w-full px-0 mx-0">
    <input
      bind:this={sliderElement}
      type="range"
      disabled={!hasInitScene || isRendering}
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
        void handleSliderChange(v).catch((error) =>
          console.error('Could not scrub the scene:', error)
        )
      }}
      onpointerup={async (e: any) => {
        if (!scene) return
        isScrubbing = false
        const v = Number((e.target as HTMLInputElement).value)
        // ensure we’re at the dropped frame
        try {
          await handleSliderChange(v)
        } catch (error) {
          console.error('Could not finish scrubbing the scene:', error)
          return
        }
        if (wasPlayingBeforeScrub) {
          // resume cleanly from here
          startPlaybackFromCurrent()
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
  <p class="text-xs">Animation timeline FPS: <strong>{timelineFPS.toFixed(2)}</strong> Hz, rendered video FPS: <strong>{renderOutputFps().toFixed(2)}</strong> Hz</p>
<div class="h-2"></div>
 <p class="text-[0.7rem] opacity-50">Hot reload mode: <strong>{hotreloadNameLookup(scene.hotReloadSetting)}</strong></p>
  <p class="text-[0.7rem] opacity-50">Screen refresh rate: <strong>{screenRefreshRate.toFixed(2)}</strong> Hz</p>
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
