# Assets and audio

Project assets live under `src/assets` and are referenced through the scene so the correct project/reference namespace is retained:

```ts
const narration = scene.asset('audio/narration.mp3')
scene.registerAudio(narration)
scene.playAudio(narration, 0.8)
```

Asset paths are relative, use forward slashes, and cannot contain parent traversal, queries, or fragments. `SceneAsset` can also return a response, text, JSON, blob, or array buffer.

Register audio during build before scheduling playback. Audio events use the same global frame timeline and are reconstructed on seek. Media helpers under `definedmotion/media` integrate video with exact and real-time frame preparation.

Reference examples use `referenceAsset()`; library-owned fonts and environments use `packageAsset()`. Consumer scenes normally use `scene.asset()`.
