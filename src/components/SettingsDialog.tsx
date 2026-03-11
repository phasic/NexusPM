import { useEffect, useState } from 'react'
import { Download, Loader2, Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isTauri, startBackgroundDownload } from '@/lib/aiClient'
import { useAiStore } from '@/store/useAiStore'
import { useTheme, type Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
]

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [currentTheme, setCurrentTheme] = useTheme()
  const [downloadState, setDownloadState] = useState<
    'idle' | 'downloading' | 'success' | 'error'
  >('idle')
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null)
  const aiStatus = useAiStore((s) => s.status)
  const lastDownloadOutcome = useAiStore((s) => s.lastDownloadOutcome)

  const handleDownloadModel = async () => {
    setDownloadState('downloading')
    setDownloadMessage(null)
    try {
      const result = await startBackgroundDownload()
      if (result === 'cached') {
        setDownloadState('success')
        setDownloadMessage('Model already downloaded.')
      } else {
        setDownloadMessage('Download started. Use the toast to pause or stop.')
      }
    } catch (e) {
      setDownloadState('error')
      setDownloadMessage(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    if (downloadState === 'downloading' && aiStatus === 'idle' && lastDownloadOutcome) {
      setDownloadState(lastDownloadOutcome === 'completed' ? 'success' : 'idle')
      setDownloadMessage(
        lastDownloadOutcome === 'completed' ? 'Model downloaded successfully.' : null,
      )
    }
  }, [downloadState, aiStatus, lastDownloadOutcome])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize the app appearance and behavior.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
            <div className="flex gap-2">
              {THEME_OPTIONS.map(({ value, label, icon }) => (
                <Button
                  key={value}
                  variant={currentTheme === value ? 'secondary' : 'outline'}
                  size="sm"
                  className={cn(
                    'flex-1 gap-2',
                    currentTheme === value && 'ring-2 ring-primary ring-offset-2',
                  )}
                  onClick={() => setCurrentTheme(value)}
                >
                  {icon}
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentTheme === 'system'
                ? 'Follows your device theme'
                : currentTheme === 'dark'
                  ? 'Dark mode'
                  : 'Light mode'}
            </p>
          </div>

          {(useAiStore((s) => s.tauriDetected) || isTauri()) && (
            <div className="space-y-2">
              <label className="text-sm font-medium">AI Model</label>
              <p className="text-xs text-muted-foreground">
                Download Qwen2.5-Coder (~8.5GB) for offline AI insights and meeting
                notes cleanup.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleDownloadModel}
                disabled={aiStatus === 'downloading'}
              >
                {aiStatus === 'downloading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {aiStatus === 'downloading'
                  ? 'Downloading…'
                  : 'Download AI model'}
              </Button>
              {downloadMessage && (
                <p
                  className={cn(
                    'text-xs',
                    downloadState === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  {downloadMessage}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
