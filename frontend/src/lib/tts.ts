import { getAccessToken } from '@/lib/supabase'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

let currentAudio: HTMLAudioElement | null = null

export async function speak(
  text: string,
  onEnd?: () => void,
  onError?: () => void,
): Promise<void> {
  stopSpeaking()

  try {
    const token = await getAccessToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE_URL}/voice/tts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`)
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    currentAudio = new Audio(url)
    currentAudio.onended = () => {
      URL.revokeObjectURL(url)
      currentAudio = null
      onEnd?.()
    }
    currentAudio.onerror = () => {
      URL.revokeObjectURL(url)
      currentAudio = null
      onError?.()
      onEnd?.()
    }

    await currentAudio.play()
  } catch {
    onError?.()
    onEnd?.()
  }
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
}
