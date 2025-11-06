<script lang="ts">
  import './app.css'
  import { generateID, setStateInScene, updateStateInUrl } from './lib/general/helpers'
  import { onDestroy, onMount } from 'svelte'
  import { setGlobalContainerRef, type AnimatedScene } from './lib/scene/sceneClass'
  import { loadFonts } from './lib/rendering/objects2d'
  import { entryScene } from '../../entry'
  import { callAllDestroyFunctions } from './lib/general/onDestory'

  //const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  let frameValueElement: HTMLParagraphElement
  let timeValueElement: HTMLParagraphElement
  let sliderElement: HTMLInputElement

  const UI_FRAME_MS = 33; // ~30 Hz. Use 16 for ~60 Hz.
  let lastUiUpdate = 0;

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

  function updateUIImmediate() {
    // slider
    (sliderElement as any).value =
      (scene.sceneRenderTick / (scene.totalSceneTicks - 1)) * maxSliderValue;

    // texts
    if (frameValueElement) frameValueElement.textContent = `Frame: ${scene.sceneRenderTick}`;
    if (timeValueElement)  timeValueElement.textContent  = `Time: ${formatMs(scene.getCurrentTimeMs())}`;
  }

  function maybeUpdateUI() {
    const now = performance.now();
    if (now - lastUiUpdate >= UI_FRAME_MS) {
      lastUiUpdate = now;
      updateUIImmediate();
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
     maybeUpdateUI();
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

    // ipcRenderer.send('resize-window', { width: 1000, height: 1000 })
  })

  onDestroy(() => {
    clearInterval(urlUpdaterInterval)
    callAllDestroyFunctions()
  })
</script>

<div class=" flex flex-col p-4">
  <div id={animationWindowID} class="w-full"></div>
  <div class="flex justify-between mt-2 font-bold text-sm items-center">

      
    <button
    class="w-[70px] text-start"
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
    class="w-[70px] text-end"
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
      oninput={(e: any) => handleSliderChange(Number(e.target.value))}
      class="w-full focus:outline-none"
    />
  </div>
  <p id="cameraPositionTextID" class="mt-2 text-xs"></p>
  <p id="cameraRotationTextID" class="mt-2 text-xs"></p>
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
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #3b82f6;
    margin-top: -6px; /* Center the thumb on the track */
  }
</style>
