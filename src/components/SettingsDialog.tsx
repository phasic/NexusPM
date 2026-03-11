import { Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
