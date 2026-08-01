<script lang="ts">
  import './app.css'
  import { restoredFrameForScene, updateStateInUrl } from './sceneState'
  import { onDestroy, onMount } from 'svelte'
  import { renderOutputFps, SceneRuntimeError, screenFPS, timelineFPS, type AnimatedScene, type ScenePreviewMarker } from '../runtime/scene/sceneClass'
  import { generateID } from '../runtime/id'
  import { listScenes, project, renderSkip } from 'virtual:definedmotion-project'
  import rotateIcon from './assets/360.svg'
  import moveIcon from './assets/move.svg'
  import { defaultViewerPreferences, type ViewerPreferences } from '../viewer/preferences'
  import { InteractiveSceneSession } from '../viewer/interactiveSceneSession'
  import { FrameRateMonitor, type FrameRateSample } from '../viewer/frameRateMonitor'
  import { observeFramePresentations } from '../runtime/scene/framePresentation'
  import type { ViewerSceneKind, ViewerSceneSummary } from '../project'
  import {
    resolveInitialScene,
    SelectionGeneration,
    visibleScenesFor
  } from '../viewer/sceneSelection'
  

  let frameValueElement: HTMLParagraphElement
  let timeValueElement: HTMLParagraphElement
  let sliderElement: HTMLInputElement

  const TEXT_FRAME_MS_LIMIT = 0.90*1000 / 30;  // A little lower to avoid skipping frames when timing is unfourtunate
  const SLIDER_FRAME_MS_LIMIT = 0.90*1000 / 60; // A little lower to avoid skipping frames when timing is unfourtunate

  let lastTextUpdate  = 0;
  let lastSliderUpdate = 0;

  let screenRefreshRate = $state(0) 
  let isRendering = $state(false) 
  let sceneError = $state<string>()
  let previewMarker = $state<ScenePreviewMarker>()
  let viewerPreferences = $state<ViewerPreferences>(defaultViewerPreferences())
  let selectedSceneId = $state('')
  let isSelecting = $state(false)
  let selectionNotice = $state<string>()
  const sceneSummaries = listScenes()
  let sceneSession: InteractiveSceneSession | undefined
  const selectionGeneration = new SelectionGeneration()

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

  let scene = $state<AnimatedScene>()
  let hasInitScene = $state(false)

  let isPlayingStateVar = $state(false)
  let isSavingFrame = $state(false)
  let viewerPerformance = $state<FrameRateSample>()

  let pendingSliderValue: number | undefined
  let sliderDrain: Promise<void> | undefined

  const maxSliderValue = 10_000
  let urlUpdaterInterval: ReturnType<typeof setInterval>
  const frameRateMonitor = new FrameRateMonitor()
  let stopObservingFramePresentations: (() => void) | undefined

  function scenesFor(kind: ViewerSceneKind): ViewerSceneSummary[] {
    return visibleScenesFor(
      sceneSummaries,
      kind,
      viewerPreferences.showExamplesAndTests,
      selectedSceneId
    )
  }

  async function persistViewerPreferences(): Promise<void> {
    const snapshot: ViewerPreferences = {
      ...(viewerPreferences.selectedSceneId
        ? { selectedSceneId: viewerPreferences.selectedSceneId }
        : {}),
      showExamplesAndTests: viewerPreferences.showExamplesAndTests,
      usePreviewMarker: viewerPreferences.usePreviewMarker,
      showFpsMonitor: viewerPreferences.showFpsMonitor
    }
    await window.api.setViewerPreferences(snapshot)
  }

  function connectFpsMonitor(candidate?: AnimatedScene): void {
    stopObservingFramePresentations?.()
    stopObservingFramePresentations = undefined
    resetFpsMonitor()
    if (!candidate || !viewerPreferences.showFpsMonitor) return

    stopObservingFramePresentations = observeFramePresentations(candidate, (presentation) => {
      if (scene !== candidate || !candidate.isPlaying || isRendering) {
        return
      }
      const sample = frameRateMonitor.record(
        presentation.timestamp,
        presentation.timelineFrame
      )
      if (sample !== undefined) viewerPerformance = sample
    })
  }

  function connectScene(candidate: AnimatedScene): void {
    connectFpsMonitor(candidate)
    candidate.playEffectFunction = () => {
      if (scene !== candidate) return
      isPlayingStateVar = candidate.isPlaying
      maybeUpdateUI()
    }
    candidate.renderingEventFunction = (isStart) => {
      if (scene !== candidate) return
      isRendering = isStart
      if (!isStart) {
        isPlayingStateVar = false
        updateUIImmediate()
      }
    }
  }

  async function selectViewerScene(
    id: string,
    requestedFrame?: number
  ): Promise<void> {
    if (!sceneSession || isRendering) return
    const generation = selectionGeneration.begin()
    stopObservingFramePresentations?.()
    stopObservingFramePresentations = undefined
    resetFpsMonitor()
    selectedSceneId = id
    isSelecting = true
    hasInitScene = false
    sceneError = undefined
    previewMarker = undefined
    pendingSliderValue = undefined
    isPlayingStateVar = false

    try {
      const candidate = await sceneSession.selectScene(id, {
        requestedFrame,
        usePreviewMarker: viewerPreferences.usePreviewMarker
      })
      if (!selectionGeneration.isCurrent(generation) || !candidate) return
      scene = candidate
      connectScene(candidate)
      previewMarker = candidate.getPreviewMarker()
      hasInitScene = true
      viewerPreferences = { ...viewerPreferences, selectedSceneId: id }
      await persistViewerPreferences().catch((error) =>
        console.error('Could not persist the selected scene:', error)
      )
      updateStateInUrl(id, candidate.sceneRenderTick)
      updateUIImmediate()
      window.dispatchEvent(
        new CustomEvent('definedmotion:scene-ready', {
          detail: { sceneId: id, frame: candidate.sceneRenderTick }
        })
      )
    } catch (error) {
      if (!selectionGeneration.isCurrent(generation)) return
      scene = undefined
      sceneError = error instanceof Error ? error.message : String(error)
      viewerPreferences = { ...viewerPreferences, selectedSceneId: id }
      await persistViewerPreferences().catch((preferenceError) =>
        console.error('Could not persist the selected scene:', preferenceError)
      )
      window.dispatchEvent(
        new CustomEvent('definedmotion:scene-error', {
          detail: { sceneId: id, message: sceneError }
        })
      )
      console.error(`Could not build scene ${id}:`, error)
    } finally {
      if (selectionGeneration.isCurrent(generation)) isSelecting = false
    }
  }

  async function updateReferenceVisibility(enabled: boolean): Promise<void> {
    viewerPreferences = { ...viewerPreferences, showExamplesAndTests: enabled }
    await persistViewerPreferences()
  }

  async function updateFpsMonitorVisibility(enabled: boolean): Promise<void> {
    viewerPreferences = { ...viewerPreferences, showFpsMonitor: enabled }
    connectFpsMonitor(hasInitScene ? scene : undefined)
    await persistViewerPreferences()
  }

  function resetFpsMonitor(): void {
    frameRateMonitor.reset()
    viewerPerformance = undefined
  }

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
    resetFpsMonitor()
    isPlayingStateVar = true
    void scene
      .playSequenceOfAnimation(scene.sceneRenderTick, scene.totalSceneTicks - 1)
      .catch((error) => {
        resetFpsMonitor()
        isPlayingStateVar = false
        console.error('Could not start playback:', error)
      })
  }

  async function saveCurrentFrame(): Promise<void> {
    if (!scene || scene.isPlaying || isRendering || isSavingFrame) return
    isSavingFrame = true
    try {
      const png = await scene.captureViewportPng()
      const bytes = new Uint8Array(await png.arrayBuffer())
      const now = new Date()
      const pad = (value: number): string => String(value).padStart(2, '0')
      const timestamp =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-` +
        `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
      await window.api.saveFrame(`definedmotion-framecapture-${timestamp}.png`, bytes)
    } finally {
      isSavingFrame = false
    }
  }

  async function drainSliderChanges(): Promise<void> {
    while (pendingSliderValue !== undefined) {
      const sliderValue = pendingSliderValue
      pendingSliderValue = undefined
      if (!scene) continue
      const requestedFrame = Math.round(
        (sliderValue / maxSliderValue) * (scene.totalSceneTicks - 1)
      )
      const frame = Math.max(requestedFrame, scene.getViewerMinimumFrame())
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

  function minimumSliderValue(): number {
    if (!scene || scene.totalSceneTicks <= 1) return 0
    return (scene.getViewerMinimumFrame() / (scene.totalSceneTicks - 1)) * maxSliderValue
  }

  function clampSliderValue(value: number): number {
    return Math.max(minimumSliderValue(), value)
  }

  function previewMarkerPercent(): number {
    if (!scene || !previewMarker || scene.totalSceneTicks <= 1) return 0
    return (previewMarker.frame / (scene.totalSceneTicks - 1)) * 100
  }

  async function updatePreviewPreference(enabled: boolean): Promise<void> {
    if (scene?.isPlaying || isRendering || isSelecting) return
    viewerPreferences = { ...viewerPreferences, usePreviewMarker: enabled }
    await persistViewerPreferences()
    if (!scene) return
    const candidate = scene
    isSelecting = true
    candidate.setViewerPreviewEnabled(enabled)
    hasInitScene = false
    sceneError = undefined
    try {
      await candidate.jumpToFrameAtIndex(candidate.sceneRenderTick)
      if (scene !== candidate) return
      previewMarker = candidate.getPreviewMarker()
      hasInitScene = true
      updateUIImmediate()
    } catch (error) {
      if (scene !== candidate) return
      sceneError = error instanceof Error ? error.message : String(error)
      previewMarker = candidate.getPreviewMarker()
    } finally {
      if (scene === candidate) isSelecting = false
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
    const animationWindow = document.getElementById(animationWindowID)
    
    if (!animationWindow || !sliderElement) return

    try {
      viewerPreferences = await window.api.getViewerPreferences()
    } catch (error) {
      console.warn('Could not load viewer preferences:', error)
    }

    sceneSession = new InteractiveSceneSession(animationWindow)
    const storedScene = viewerPreferences.selectedSceneId
    const initial = resolveInitialScene(sceneSummaries, project.defaultScene, storedScene)
    if (initial.fellBack && storedScene) {
      selectionNotice = `Scene “${storedScene}” no longer exists. Opened the configured default.`
    }
    await selectViewerScene(initial.id, restoredFrameForScene(initial.id))
    urlUpdaterInterval = setInterval(() => {
      if (scene && selectedSceneId) updateStateInUrl(selectedSceneId, scene.sceneRenderTick)
    }, 500)

  

   screenRefreshRate = screenFPS

    // ipcRenderer.send('resize-window', { width: 1000, height: 1000 })
  })

  onDestroy(() => {
    clearInterval(urlUpdaterInterval)
    selectionGeneration.invalidate()
    stopObservingFramePresentations?.()
    sceneSession?.dispose()
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
  <div class="mb-2 rounded-md bg-black/[0.035] p-2 text-xs">
    <div class="flex items-center gap-2">
      <label for="scene-selector" class="font-semibold">Scene</label>
      <select
        id="scene-selector"
        data-testid="scene-selector"
        class="min-w-0 flex-1 rounded border border-black/10 bg-white px-2 py-1"
        value={selectedSceneId}
        disabled={isRendering || isSelecting}
        onchange={(event) => {
          void selectViewerScene((event.currentTarget as HTMLSelectElement).value)
        }}
      >
        {#if scenesFor('project').length > 0}
          <optgroup label="Project">
            {#each scenesFor('project') as summary}
              <option value={summary.id}>
                {summary.name}{summary.isDefault ? ' (default)' : ''}
              </option>
            {/each}
          </optgroup>
        {/if}
        {#if scenesFor('example').length > 0}
          <optgroup label="Examples">
            {#each scenesFor('example') as summary}
              <option value={summary.id}>{summary.name}</option>
            {/each}
          </optgroup>
        {/if}
        {#if scenesFor('test').length > 0}
          <optgroup label="Tests">
            {#each scenesFor('test') as summary}
              <option value={summary.id}>{summary.name}</option>
            {/each}
          </optgroup>
        {/if}
      </select>
    </div>
    <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.68rem]">
      <label class="flex items-center gap-1.5">
        <input
          data-testid="show-reference-scenes"
          type="checkbox"
          checked={viewerPreferences.showExamplesAndTests}
          disabled={isRendering || isSelecting}
          onchange={(event) => {
            void updateReferenceVisibility(
              (event.currentTarget as HTMLInputElement).checked
            ).catch((error) => console.error('Could not update scene visibility:', error))
          }}
        />
        Show examples and tests
      </label>
      <label class="flex items-center gap-1.5">
        <input
          data-testid="use-preview-marker"
          type="checkbox"
          checked={viewerPreferences.usePreviewMarker}
          disabled={isRendering || isSelecting || isPlayingStateVar}
          onchange={(event) => {
            void updatePreviewPreference((event.currentTarget as HTMLInputElement).checked).catch(
              (error) => console.error('Could not update the preview preference:', error)
            )
          }}
        />
        Use scene preview marker
      </label>
      <label class="flex items-center gap-1.5">
        <input
          data-testid="show-fps-monitor"
          type="checkbox"
          checked={viewerPreferences.showFpsMonitor}
          onchange={(event) => {
            void updateFpsMonitorVisibility(
              (event.currentTarget as HTMLInputElement).checked
            ).catch((error) => console.error('Could not update the FPS monitor:', error))
          }}
        />
        Show FPS monitor
      </label>
    </div>
    {#if selectionNotice}
      <p class="mt-1 text-[0.65rem] text-amber-700">{selectionNotice}</p>
    {/if}
  </div>
  <div class="relative w-full rounded-sm overflow-clip bg-neutral-100">
    <div
      id={animationWindowID}
      data-viewer-active-scene={hasInitScene ? selectedSceneId : ''}
      class="min-h-[200px] w-full"
      class:invisible={!hasInitScene}
    ></div>
    {#if viewerPreferences.showFpsMonitor && hasInitScene}
      <div
        data-testid="fps-monitor"
        class="pointer-events-none absolute right-2 top-2 z-20 rounded bg-black/70 px-2 py-1 font-mono text-[0.62rem] leading-4 text-white shadow-sm"
      >
        <div>Viewer: {viewerPerformance === undefined ? '—' : viewerPerformance.fps.toFixed(1)} FPS</div>
        <div class="text-white/65">Timeline: {timelineFPS.toFixed(1)} FPS</div>
        <div class="text-white/65">
          Frame time: {viewerPerformance === undefined
            ? '—'
            : `${viewerPerformance.averageFrameTimeMs.toFixed(1)} ms avg / ${viewerPerformance.p95FrameTimeMs.toFixed(1)} ms p95`}
        </div>
        <div class="text-white/65">
          Not presented: {viewerPerformance?.unpresentedTimelineFrames ?? 0}
        </div>
      </div>
    {/if}
    {#if sceneError}
      <div class="absolute inset-0 flex items-center justify-center bg-red-50 px-8 text-center text-xs text-red-800">
        <div>
          <p class="font-bold">Scene could not be built</p>
          <p class="mt-2 whitespace-pre-wrap">{sceneError}</p>
        </div>
      </div>
    {:else if !hasInitScene}
      <div class="absolute inset-0 flex items-center justify-center text-xs text-black/35">
        {isSelecting ? 'Building scene…' : 'Preparing viewer…'}
      </div>
    {/if}
  </div>
  {#if isRendering}
 <p class="text-[17px] self-center p-6 pb-1">Do <strong>not save</strong> code during rendering</p>
   <p class="text-xs self-center pt-0 p-2">The viewer might hot reload and affect the result</p>
  {/if}
  
  <div class="flex justify-between mt-2 font-bold text-sm items-center">

 

    <button
    data-testid="playback-toggle"
    disabled={!hasInitScene || isRendering}
    class="w-[70px] text-xs cursor-pointer bg-black/5 rounded-full p-1 hover:bg-black/10 transition"
          onclick={() => {
            if (scene.isPlaying) {
              scene.pause()
              resetFpsMonitor()
              updateUIImmediate();
              isPlayingStateVar = false
            } else {
              startPlaybackFromCurrent()
            }
          }}>{isPlayingStateVar ? 'Pause' : 'Play'}</button
        >
    

    <div class="flex ">
    <p bind:this={frameValueElement} data-testid="current-frame" class="font-normal text-[0.7rem] leading-none mr-2 w-[83px]">Frame:</p>
      <p bind:this={timeValueElement} class="font-normal text-[0.7rem] leading-none w-[93px] ">Time:</p>
      </div>
    <div class="flex gap-2">
      <button
        disabled={!hasInitScene || isRendering || isPlayingStateVar || isSavingFrame}
        class="w-[80px] text-xs cursor-pointer bg-black/5 rounded-full p-1 hover:bg-black/10 transition"
        onclick={() => {
          void saveCurrentFrame().catch((error) =>
            console.error('Could not save the current frame:', error)
          )
        }}>{isSavingFrame ? 'Saving…' : 'Save frame'}</button
      >
      <button
      disabled={!hasInitScene || isRendering || isPlayingStateVar || isSavingFrame}
      class="w-[70px] text-xs cursor-pointer bg-black/5 rounded-full  p-1 hover:bg-black/10 transition"
        onclick={() => {
          void scene
            .render()
            .catch((error) => console.error('Could not render the scene:', error))
        }}>Render</button
      >
    </div>
  </div>
  {#if previewMarker}
    <div class="mt-2 text-[0.68rem]">
      <p class={viewerPreferences.usePreviewMarker ? 'font-medium text-amber-700' : 'text-black/40'}>
        {viewerPreferences.usePreviewMarker
          ? `Approximate preview · starts ${previewMarker.beat ? `at beat “${previewMarker.beat}” · ` : ''}at frame ${previewMarker.frame}`
          : `Preview marker disabled · frame ${previewMarker.frame}`}
      </p>
    </div>
  {/if}
  <div class="relative w-full px-0 mx-0" class:has-preview-boundary={previewMarker !== undefined && viewerPreferences.usePreviewMarker} style={`--preview-boundary: ${previewMarkerPercent()}%`}>
    {#if previewMarker}
      {#if viewerPreferences.usePreviewMarker && previewMarkerPercent() >= 9}
        <div
          class="pointer-events-none absolute -top-1 z-20 overflow-hidden whitespace-nowrap text-center text-[0.58rem] text-black/45"
          style={`width: ${previewMarkerPercent()}%`}
        >
          Not evaluated in preview
        </div>
      {/if}
      <div
        class="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-amber-600"
        class:opacity-35={!viewerPreferences.usePreviewMarker}
        style={`left: ${previewMarkerPercent()}%`}
        title={viewerPreferences.usePreviewMarker ? 'Preview starts here' : 'Preview marker disabled'}
      ></div>
    {/if}
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
          resetFpsMonitor()
          isPlayingStateVar = false
        }
      }}
      oninput={(e: any) => {
        // while scrubbing: jump visuals quietly; when not scrubbing, behaves like before
        const v = clampSliderValue(Number(e.target.value))
        e.target.value = String(v)
        void handleSliderChange(v).catch((error) =>
          console.error('Could not scrub the scene:', error)
        )
      }}
      onpointerup={async (e: any) => {
        if (!scene) return
        isScrubbing = false
        const v = clampSliderValue(Number((e.target as HTMLInputElement).value))
        ;(e.target as HTMLInputElement).value = String(v)
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
  {#if !previewMarker}
    <p class="text-[0.7rem] opacity-50">Scene preview marker: <strong>Not set</strong></p>
  {/if}
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

  .has-preview-boundary input[type='range']::-webkit-slider-runnable-track {
    background: linear-gradient(
      to right,
      #9ca3af 0,
      #9ca3af var(--preview-boundary),
      #e5e7eb var(--preview-boundary),
      #e5e7eb 100%
    );
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
