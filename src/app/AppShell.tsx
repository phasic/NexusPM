import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Download, Settings, Upload } from 'lucide-react'

import { AiDownloadToast } from '@/components/AiDownloadToast'
import { NexusIcon } from '@/components/NexusIcon'
import { isTauri } from '@/lib/aiClient'
import { useAiStore } from '@/store/useAiStore'
import { SettingsDialog } from '@/components/SettingsDialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/store/useAppStore'

export function AppShell() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const exportJson = useAppStore((s) => s.exportJson)
  const importJson = useAppStore((s) => s.importJson)
  const setAiStatus = useAiStore((s) => s.setStatus)
  const setDownloadProgress = useAiStore((s) => s.setDownloadProgress)
  const setDownloadError = useAiStore((s) => s.setDownloadError)
  const setLastDownloadOutcome = useAiStore((s) => s.setLastDownloadOutcome)
  const setDownloadCancellable = useAiStore((s) => s.setDownloadCancellable)
  const setTauriDetected = useAiStore((s) => s.setTauriDetected)
  const tauriDetected = useAiStore((s) => s.tauriDetected)

  useEffect(() => {
    import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('ai_model_status'))
      .then(() => {
        setTauriDetected(true)
        import('@/lib/aiClient').then(({ setTauriDetectedByInvoke }) =>
          setTauriDetectedByInvoke(true),
        )
      })
      .catch(() => {})
  }, [setTauriDetected])

  const unlistenRef = useRef<Array<() => void>>([])
  useEffect(() => {
    if (!tauriDetected && !isTauri()) return
    import('@tauri-apps/api/event').then(({ listen }) =>
      Promise.all([
        listen('ai:download-started', (e) => {
          const p = e.payload as { cancellable?: boolean }
          setAiStatus('downloading')
          setDownloadProgress(null)
          setDownloadError(null)
          setDownloadCancellable(p?.cancellable ?? false)
        }),
        listen('ai:download-progress', (e) => {
          const p = e.payload as { downloaded?: number; total?: number }
          if (p?.downloaded != null && p?.total != null) {
            setDownloadProgress({ downloaded: p.downloaded, total: p.total })
          }
        }),
        listen('ai:download-complete', () => {
          setDownloadProgress(null)
          setAiStatus('idle')
          setDownloadCancellable(false)
          setLastDownloadOutcome('completed')
        }),
        listen('ai:download-cancelled', () => {
          setDownloadProgress(null)
          setAiStatus('idle')
          setDownloadCancellable(false)
          setLastDownloadOutcome('cancelled')
        }),
        listen('ai:download-paused', (e) => {
          const p = e.payload as { downloaded?: number; total?: number }
          setDownloadProgress(
            p?.downloaded != null && p?.total != null
              ? { downloaded: p.downloaded, total: p.total }
              : null,
          )
          setAiStatus('paused')
          setDownloadCancellable(false)
        }),
        listen('ai:download-error', (e) => {
          setDownloadError(String(e.payload ?? 'Download failed'))
          setAiStatus('idle')
        }),
        listen('ai:load-started', () => setAiStatus('loading')),
        listen('ai:load-complete', () => setAiStatus('processing')),
      ]),
    ).then((handles) => {
      unlistenRef.current = handles
    })
    return () => {
      unlistenRef.current.forEach((fn) => fn())
      unlistenRef.current = []
    }
  }, [
    tauriDetected,
    setAiStatus,
    setDownloadProgress,
    setDownloadError,
    setLastDownloadOutcome,
    setDownloadCancellable,
  ])

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-90"
            >
              <NexusIcon className="h-7 w-7 shrink-0" />
              NexusPM
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <div className="text-sm text-muted-foreground">
              {isHome ? 'Dashboard' : 'Project'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const text = await file.text()
                importJson(text)
                e.target.value = ''
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const json = exportJson()
                const blob = new Blob([json], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `nexuspm-export-${new Date().toISOString().slice(0, 10)}.json`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              }}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AiDownloadToast />

      <main className="mx-auto max-w-7xl px-3 py-4">
        <Outlet />
      </main>
    </div>
  )
}

