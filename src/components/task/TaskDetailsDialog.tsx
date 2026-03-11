import { useEffect, useState } from 'react'
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns'

import { Trash2 } from 'lucide-react'

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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  addColorToHistory,
  getColorHistory,
  isPresetColor,
  TASK_COLOR_PRESET_STYLES,
  TASK_COLOR_PRESETS,
} from '@/lib/taskColors'
import type { Bucket, Task, TaskStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

type DateMode = 'range' | 'duration'

const TASK_STATUSES: TaskStatus[] = ['open', 'started', 'closed', 'overdue', 'blocked']

export type CreateTaskData = {
  title: string
  bucketId: string | null
  startDate: string
  endDate: string
  color: string
  status: TaskStatus
  statusReason?: string
  dependsOn: string[]
  description?: string
  owner?: string
}

export function TaskDetailsDialog({
  task,
  buckets,
  tasks,
  taskById,
  open,
  onOpenChange,
  onUpdate,
  onAddDependency,
  onRemoveDependency,
  onSetBucket,
  onDelete,
  createMode,
  projectId,
  onCreate,
  variant = 'dialog',
  onBucketClick,
}: {
  task: Task | null
  buckets: Bucket[]
  tasks: Task[]
  taskById: Record<string, Task>
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, patch: Partial<Task>) => void
  onAddDependency: (taskId: string, dependsOnTaskId: string) => void
  onRemoveDependency: (taskId: string, dependsOnTaskId: string) => void
  onSetBucket: (taskId: string, bucketId: string | null) => void
  onDelete?: (taskId: string) => void
  createMode?: boolean
  projectId?: string
  onCreate?: (data: CreateTaskData) => void
  variant?: 'dialog' | 'panel'
  onBucketClick?: (bucket: Bucket) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('open')
  const [statusReason, setStatusReason] = useState('')
  const [bucketId, setBucketId] = useState<string>('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [duration, setDuration] = useState(1)
  const [dateMode, setDateMode] = useState<DateMode>('range')
  const [color, setColor] = useState<string>('')
  const [newDepId, setNewDepId] = useState('')
  const [pendingDeps, setPendingDeps] = useState<string[]>([])
  const [colorHistory, setColorHistory] = useState<string[]>(() => getColorHistory())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (createMode && open) {
      const t = new Date().toISOString().slice(0, 10)
      setTitle('')
      setOwner('')
      setDescription('')
      setStatus('open')
      setStatusReason('')
      setBucketId('')
      setStartDate(t)
      setEndDate(t)
      setDuration(1)
      setDateMode('range')
      setColor('')
      setNewDepId('')
      setPendingDeps([])
      setColorHistory(getColorHistory())
      return
    }
    if (!task) return
    setTitle(task.title)
    setOwner(task.owner ?? '')
    setDescription(task.description ?? '')
    setStatus(task.status)
    setStatusReason(task.statusReason ?? '')
    setBucketId(task.bucketId ?? '')
    setStartDate(task.startDate)
    setEndDate(task.endDate)
    setDuration(
      Math.max(1, differenceInCalendarDays(parseISO(task.endDate), parseISO(task.startDate)) + 1),
    )
    setDateMode('range')
    setColor(task.color ?? '')
    setColorHistory(getColorHistory())
    setNewDepId('')
    setPendingDeps([])
  }, [task, createMode, open])

  if (!task && !createMode) return null

  const handleSave = () => {
    const end =
      dateMode === 'duration'
        ? addDays(parseISO(startDate), duration - 1).toISOString().slice(0, 10)
        : endDate

    if (createMode && onCreate && projectId) {
      if (!title.trim()) return
      onCreate({
        title: title.trim(),
        bucketId: bucketId || null,
        startDate,
        endDate: end,
        color: color || '',
        status,
        statusReason: (status === 'overdue' || status === 'blocked') ? statusReason.trim() || undefined : undefined,
        dependsOn: pendingDeps,
        description: description.trim() || undefined,
        owner: owner.trim() || undefined,
      })
      if (color && !isPresetColor(color) && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        addColorToHistory(color)
      }
      onOpenChange(false)
      return
    }

    if (!task) return
    if (bucketId !== (task.bucketId ?? '')) {
      onSetBucket(task.id, bucketId || null)
    }
    const patch: Partial<Task> = {
      title,
      status,
      startDate,
      endDate: end,
      color: color || undefined,
      statusReason: (status === 'overdue' || status === 'blocked') ? statusReason.trim() || undefined : undefined,
      description: description.trim() || undefined,
      owner: owner.trim() || undefined,
    }
    if (status !== 'overdue' && status !== 'blocked') {
      patch.statusReason = undefined
    }
    const hasChanges =
      title !== task.title ||
      status !== task.status ||
      startDate !== task.startDate ||
      end !== task.endDate ||
      (color || '') !== (task.color ?? '') ||
      (patch.statusReason ?? '') !== (task.statusReason ?? '') ||
      (description.trim() || '') !== (task.description ?? '') ||
      (owner.trim() || '') !== (task.owner ?? '')
    if (hasChanges) {
      onUpdate(task.id, patch)
      if (color && !isPresetColor(color) && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        addColorToHistory(color)
        setColorHistory(getColorHistory())
      }
    }
    onOpenChange(false)
  }

  const otherTasks = tasks.filter((t) => t.id !== task?.id)
  const currentDepIds = createMode ? pendingDeps : (task?.dependsOn ?? [])

  const formContent = (
    <>
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="text-sm font-medium">Title</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Owner</div>
            <Input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Assign to a person"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Description</div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Extra info, documentation, links…"
              rows={3}
              className="resize-y min-h-[60px]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Dates</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDateMode('range')}
                  className={cn(
                    'text-xs',
                    dateMode === 'range' ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  Start & end
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  type="button"
                  onClick={() => setDateMode('duration')}
                  className={cn(
                    'text-xs',
                    dateMode === 'duration' ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  Duration
                </button>
              </div>
            </div>
            {dateMode === 'range' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Start</div>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">End</div>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Start</div>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setEndDate(
                        addDays(parseISO(e.target.value), duration - 1)
                          .toISOString()
                          .slice(0, 10),
                      )
                    }}
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Duration (days)</div>
                  <Input
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) => {
                      const d = Math.max(1, parseInt(e.target.value, 10) || 1)
                      setDuration(d)
                      setEndDate(
                        addDays(parseISO(startDate), d - 1).toISOString().slice(0, 10),
                      )
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Dependencies</div>
            <div className="flex gap-2">
              <select
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                value={newDepId}
                onChange={(e) => setNewDepId(e.target.value)}
              >
                <option value="">Add dependency…</option>
                {otherTasks
                  .filter((t) => !currentDepIds.includes(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={!newDepId}
                onClick={() => {
                  if (newDepId) {
                    if (createMode) {
                      setPendingDeps((d) => [...d, newDepId])
                    } else if (task) {
                      onAddDependency(task.id, newDepId)
                    }
                    setNewDepId('')
                  }
                }}
              >
                Add
              </Button>
            </div>
            {currentDepIds.length > 0 && (
              <div className="mt-2 space-y-1">
                {currentDepIds.map((depId) => (
                  <div
                    key={depId}
                    className="flex items-center justify-between rounded-md bg-muted/60 px-2 py-1.5 text-sm"
                  >
                    <span>{taskById[depId]?.title ?? depId}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (createMode) {
                          setPendingDeps((d) => d.filter((id) => id !== depId))
                        } else if (task) {
                          onRemoveDependency(task.id, depId)
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Status</div>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {(status === 'overdue' || status === 'blocked') && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Reason</div>
              <Input
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder={status === 'overdue' ? 'Why is this overdue?' : 'What is blocking this?'}
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium">Bucket</div>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={bucketId}
              onChange={(e) => setBucketId(e.target.value)}
            >
              <option value="">— None —</option>
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Color</div>
            <div className="flex flex-wrap items-center gap-2">
              {TASK_COLOR_PRESETS.map((c) => {
                const styles = TASK_COLOR_PRESET_STYLES[c]
                const selected = color === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(selected ? '' : c)}
                    className={cn(
                      'h-8 w-8 rounded-md border-2 transition-colors',
                      styles.bg,
                      styles.border,
                      selected ? 'ring-2 ring-offset-2 ring-foreground' : 'hover:opacity-80',
                    )}
                    title={c}
                  />
                )
              })}
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={
                    color && color.startsWith('#') && /^#[0-9A-Fa-f]{6}$/.test(color)
                      ? color
                      : '#94a3b8'
                  }
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded-md border border-input bg-transparent p-0"
                  title="Custom color"
                />
                <span className="text-xs text-muted-foreground">Custom</span>
              </div>
            </div>
            {colorHistory.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Recent:</span>
                {colorHistory.map((hex) => {
                  const selected = color.toLowerCase() === hex.toLowerCase()
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setColor(selected ? '' : hex)}
                      className={cn(
                        'h-6 w-6 rounded border-2 transition-colors',
                        selected ? 'ring-2 ring-offset-2 ring-foreground' : 'hover:opacity-80',
                      )}
                      style={{
                        backgroundColor: hex,
                        borderColor: `${hex}99`,
                      }}
                      title={hex}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {!createMode && task && onDelete && (
          <div className="border-t pt-4">
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete task
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Delete &quot;{task.title}&quot;? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      onDelete(task.id)
                      onOpenChange(false)
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
    </>
  )

  const footer = (
    <div className={cn('flex justify-end gap-2', variant === 'panel' && 'border-t pt-4')}>
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        {variant === 'panel' ? 'Close' : 'Cancel'}
      </Button>
      <Button onClick={handleSave} disabled={createMode && !title.trim()}>
        {createMode ? 'Add task' : 'Save'}
      </Button>
    </div>
  )

  const currentBucket = task?.bucketId ? buckets.find((b) => b.id === task.bucketId) : null
  const headerTitle = createMode
    ? 'New task'
    : currentBucket && onBucketClick
      ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onBucketClick(currentBucket)}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              {currentBucket.name}
            </button>
            <span className="text-muted-foreground">›</span>
            <span>{task?.title}</span>
          </span>
        )
      : task
        ? task.title
        : 'Task details'

  if (variant === 'panel') {
    return (
      <div className="space-y-4 rounded-xl border bg-background p-4">
        <div>
          <h3 className="text-base font-semibold">{headerTitle}</h3>
          <p className="text-sm text-muted-foreground">
            {createMode
              ? 'Add a new task. Set name, bucket, dates, color, and dependencies.'
              : 'Edit bucket, dates, duration, color, and dependencies.'}
          </p>
        </div>
        {formContent}
        {footer}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{headerTitle}</DialogTitle>
          <DialogDescription>
            {createMode
              ? 'Add a new task. Set name, bucket, dates, color, and dependencies.'
              : 'Edit bucket, dates, duration, color, and dependencies.'}
          </DialogDescription>
        </DialogHeader>
        {formContent}
        {footer}
      </DialogContent>
    </Dialog>
  )
}
