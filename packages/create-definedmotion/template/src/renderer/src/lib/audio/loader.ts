export interface AudioInScene {
  audioPath: string
  volume: number
  atFrame: number
}

// Global caches for audio assets
// The key is a file path and the value is the loaded AudioBuffer.
let loadedAudio = new Map<string, AudioBuffer>()

let registeredAudios = new Set<string>()

// Create or reuse an AudioContext instance.
const audioContext = new AudioContext()

/**
 * Registers an audio file path and returns a corresponding ID.
 * @param audioPath - The path to the audio file.
 * @returns A unique audio ID.
 */
export const registerAudio = (audioPath: string) => {
  registeredAudios.add(audioPath)
}

/**
 * Loads all registered audio files into the global cache.
 * Every audio file referenced in the audioIDMappings will be fetched
 * and decoded; results are stored in the loadedAudio map.
 */
export const loadAllAudio = async (): Promise<void> => {
  const loadPromises: Promise<void>[] = []

  // Loop over each registered audio file.
  for (const [path, _] of registeredAudios.entries()) {
    // If this audio file isn't already loaded, load it.
    if (!loadedAudio.has(path)) {
      const promise = fetch(path)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load audio file at ${path}: ${response.statusText}`)
          }
          return response.arrayBuffer()
        })
        .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
        .then((decodedBuffer) => {
          loadedAudio.set(path, decodedBuffer)
          console.log(`Loaded audio [path: ${path}] from: ${path}`)
        })
        .catch((error) => {
          console.error(`Error loading audio from ${path}:`, error)
        })
      loadPromises.push(promise)
    }
  }

  await Promise.all(loadPromises)
  console.log('All audio files have been loaded.')
}

/**
 * Plays the audio corresponding to the given audioID with the specified volume.
 * @param audioID - The registered audio ID to play.
 * @param volume - The volume level (e.g., 0.0 to 1.0).
 */
export const playAudio = (audioPath: string, volume: number) => {
  const hasAudio = registeredAudios.has(audioPath)
  if (!hasAudio) {
    console.warn(`Audio path ${audioPath} not registered.`)
    return
  }

  const buffer = loadedAudio.get(audioPath)
  if (!buffer) {
    console.warn(`Audio file for ${audioPath} has not been loaded.`)
    return
  }

  // Create a buffer source node to play the audio.
  const source = audioContext.createBufferSource()
  source.buffer = buffer

  // Create a gain node to control the volume.
  const gainNode = audioContext.createGain()
  gainNode.gain.value = volume

  // Connect the nodes: source -> gain -> audio context destination.
  source.connect(gainNode)
  gainNode.connect(audioContext.destination)

  // Start playback immediately.
  source.start(0)
}

/**
 * Cleans up all audio resources.
 * This function:
 *  - Clears the loaded audio cache.
 *  - Clears the audio ID mapping.
 *  - Resets the last registered ID counter.
 */
export const cleanupAudioData = async (): Promise<void> => {
  // Clear the caches.
  loadedAudio.clear()
}
