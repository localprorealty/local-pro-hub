/** Simple energy-based VAD using Web Audio API */
export function createVAD(
  stream: MediaStream,
  onSilence: () => void,
  options?: { silenceThreshold?: number; silenceDurationMs?: number },
): () => void {
  const audioContext = new AudioContext()
  const analyser = audioContext.createAnalyser()
  const source = audioContext.createMediaStreamSource(stream)
  source.connect(analyser)
  analyser.fftSize = 256

  const dataArray = new Uint8Array(analyser.frequencyBinCount)
  let silenceStart: number | null = null
  let stopped = false
  let rafId = 0

  const silenceThreshold = options?.silenceThreshold ?? 15
  const silenceDurationMs = options?.silenceDurationMs ?? 1500

  function check() {
    if (stopped) return

    analyser.getByteFrequencyData(dataArray)
    const energy = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length

    if (energy < silenceThreshold) {
      if (!silenceStart) silenceStart = Date.now()
      else if (Date.now() - silenceStart > silenceDurationMs) {
        stopped = true
        onSilence()
        return
      }
    } else {
      silenceStart = null
    }

    rafId = requestAnimationFrame(check)
  }

  rafId = requestAnimationFrame(check)

  return () => {
    stopped = true
    cancelAnimationFrame(rafId)
    void audioContext.close()
  }
}

export function getAudioEnergy(stream: MediaStream): {
  getEnergy: () => number
  cleanup: () => void
} {
  const audioContext = new AudioContext()
  const analyser = audioContext.createAnalyser()
  const source = audioContext.createMediaStreamSource(stream)
  source.connect(analyser)
  analyser.fftSize = 256
  const dataArray = new Uint8Array(analyser.frequencyBinCount)

  return {
    getEnergy: () => {
      analyser.getByteFrequencyData(dataArray)
      return dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    },
    cleanup: () => {
      void audioContext.close()
    },
  }
}
