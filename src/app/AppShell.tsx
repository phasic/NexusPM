import { useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Download, Settings, Upload } from 'lucide-react'

import { NexusIcon } from '@/components/NexusIcon'
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

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
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

      <main className="mx-auto max-w-7xl px-3 py-4">
        <Outlet />
      </main>
    </div>
  )
}

