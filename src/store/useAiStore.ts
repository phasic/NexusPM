import { create } from 'zustand'

export type AiStatus =
  | 'idle'
  | 'starting'
  | 'downloading'
  | 'loading'
  | 'processing'
  | 'paused'

type AiStore = {
  status: AiStatus
  tauriDetected: boolean
  downloadProgress: { downloaded: number; total: number } | null
  downloadError: string | null
  downloadCancellable: boolean
  lastDownloadOutcome: 'completed' | 'cancelled' | null
  setStatus: (status: AiStatus) => void
  setTauriDetected: (detected: boolean) => void
  setDownloadProgress: (progress: { downloaded: number; total: number } | null) => void
  setDownloadError: (error: string | null) => void
  setDownloadCancellable: (cancellable: boolean) => void
  setLastDownloadOutcome: (outcome: 'completed' | 'cancelled' | null) => void
}

export const useAiStore = create<AiStore>((set) => ({
  status: 'idle',
  tauriDetected: false,
  downloadProgress: null,
  downloadError: null,
  downloadCancellable: false,
  lastDownloadOutcome: null,
  setStatus: (status) => set({ status }),
  setTauriDetected: (tauriDetected) => set({ tauriDetected }),
  setDownloadProgress: (downloadProgress) => set({ downloadProgress }),
  setDownloadError: (downloadError) => set({ downloadError }),
  setDownloadCancellable: (downloadCancellable) => set({ downloadCancellable }),
  setLastDownloadOutcome: (lastDownloadOutcome) => set({ lastDownloadOutcome }),
}))
