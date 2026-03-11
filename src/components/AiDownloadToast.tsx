import { useState } from 'react'
import { Download, Loader2, Pause, Play, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  requestDownloadCancel,
  resumeBackgroundDownload,
  isTauri,
} from '@/lib/aiClient'
import { useAiStore } from '@/store/useAiStore'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AiDownloadToast() {
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false)
  const aiStatus = useAiStore((s) => s.status)
  const downloadProgress = useAiStore((s) => s.downloadProgress)
  const downloadError = useAiStore((s) => s.downloadError)
  const downloadCancellable = useAiStore((s) => s.downloadCancellable)

  if (!isTauri()) return null
  if (
    aiStatus !== 'starting' &&
    aiStatus !== 'downloading' &&
    aiStatus !== 'loading' &&
    aiStatus !== 'paused' &&
    !downloadError
  )
    return null
  const isDownloading = aiStatus === 'downloading'
  const isStarting = aiStatus === 'starting'
  const isPaused = aiStatus === 'paused'
  const progress = downloadProgress
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.downloaded / progress.total) * 100)
      : null

  return (
    <>
      <div className="h-[3.25rem] shrink-0" aria-hidden />
      <div
        className="fixed left-0 right-0 top-12 z-40 flex flex-col border-b bg-card/95 shadow-sm backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          {isDownloading ? (
            <Download className="h-4 w-4 animate-pulse text-primary" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {downloadError
              ? 'AI model download failed'
              : isPaused
                ? 'Download paused'
                : isStarting
                  ? 'Preparing AI model…'
                  : isDownloading
                    ? 'Downloading AI model'
                    : 'Loading AI model…'}
          </p>
          {downloadError ? (
            <p className="truncate text-xs text-destructive">{downloadError}</p>
          ) : progress && progress.total > 0 ? (
            <p className="text-xs text-muted-foreground">
              {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
              {percent != null && ` (${percent}%)`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isDownloading
                ? 'This may take several minutes on first run'
                : isPaused
                  ? 'Click Resume to continue'
                  : 'Almost ready…'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isDownloading && downloadCancellable && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => requestDownloadCancel(false)}
              >
                <Pause className="h-3.5 w-3.5" />
                Pause
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => setStopConfirmOpen(true)}
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            </>
          )}
          {isPaused && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => resumeBackgroundDownload()}
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </Button>
          )}
        </div>
      </div>
      {!downloadError && progress && progress.total > 0 && (
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${Math.min(100, (progress.downloaded / progress.total) * 100)}%`,
            }}
          />
        </div>
      )}
      </div>
      <AlertDialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop download?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the download and delete the partially downloaded file.
              You will need to start over if you want to download again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                requestDownloadCancel(true)
                setStopConfirmOpen(false)
              }}
            >
              Stop download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
