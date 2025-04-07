<script lang="ts">
  import './app.css'
  import { generateID, setStateInScene, updateStateInUrl } from './lib/general/helpers'
  import { onDestroy, onMount } from 'svelte'
  import { forthScene } from './examples/exampleScenes'
  import {
    globalContainerRef,
    setGlobalContainerRef,
    type AnimatedScene
  } from './lib/scene/sceneClass'
  import { loadFonts } from './lib/rendering/objects2d'

  //const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

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
        lastSetFrame = frame
      }
    }
  }

  onMount(async () => {
    await loadFonts()
    const animationWindow = document.getElementById(animationWindowID)
    const sliderElement = document.getElementById('playerSliderID')
    if (!animationWindow || !sliderElement) return

    setGlobalContainerRef(animationWindow)

    scene = forthScene()

    scene.playEffectFunction = () => {
      ;(sliderElement as any).value =
        (scene.sceneRenderTick / (scene.totalSceneTicks - 1)) * maxSliderValue
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
  })
</script>

<div class=" flex flex-col p-4">
  <div id={animationWindowID} class="w-full"></div>
  <div class="flex justify-between mt-2">
    <button
      onclick={() => {
        if (scene.isPlaying) {
          scene.pause()
          isPlayingStateVar = false
        } else {
          scene.playSequenceOfAnimation(scene.sceneRenderTick, scene.totalSceneTicks - 1)
          isPlayingStateVar = true
        }
      }}>{isPlayingStateVar ? 'Pause' : 'Play'}</button
    >
    <button
      onclick={() => {
        scene.render()
      }}>Render</button
    >
  </div>
  <div class="w-full px-0 mx-0">
    <input
      type="range"
      min="0"
      max={maxSliderValue}
      oninput={(e: any) => handleSliderChange(Number(e.target.value))}
      class="w-full focus:outline-none"
      id="playerSliderID"
    />
  </div>
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
