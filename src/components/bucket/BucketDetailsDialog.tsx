import { useEffect, useState } from 'react'

import { Trash2 } from 'lucide-react'

import {
  AlertDialog,
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
import type { Bucket, Task, TaskStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

export function BucketDetailsDialog({
  bucket,
  tasks,
  open,
  onOpenChange,
  onUpdateBucket,
  onDeleteBucket,
  onTaskClick,
  onUpdateTask,
  variant = 'dialog',
}: {
  bucket: Bucket | null
  tasks: Task[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateBucket: (id: string, patch: { name?: string; description?: string; owner?: string }) => void
  onDeleteBucket: (id: string, options?: { deleteTasks?: boolean }) => void
  onTaskClick?: (task: Task) => void
  onUpdateTask?: (taskId: string, patch: Partial<Task>) => void
  variant?: 'dialog' | 'panel'
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (bucket && open) {
      setName(bucket.name)
      setDescription(bucket.description ?? '')
      setOwner(bucket.owner ?? '')
    }
  }, [bucket, open])

  if (!bucket) return null

  const bucketTasks = tasks.filter((t) =>
    bucket.id === '__uncategorized__' ? !t.bucketId : t.bucketId === bucket.id,
  )
  const isUncategorized = bucket.id === '__uncategorized__'

  const handleSave = () => {
    const trimmedName = name.trim()
    const trimmedDesc = description.trim()
    const trimmedOwner = owner.trim()
    const hasChanges =
      trimmedName !== bucket.name ||
      trimmedDesc !== (bucket.description ?? '') ||
      trimmedOwner !== (bucket.owner ?? '')
    if (hasChanges) {
      onUpdateBucket(bucket.id, {
        ...(trimmedName !== bucket.name && { name: trimmedName }),
        ...(trimmedDesc !== (bucket.description ?? '') && { description: trimmedDesc || undefined }),
        ...(trimmedOwner !== (bucket.owner ?? '') && { owner: trimmedOwner || undefined }),
      })
    }
    if (variant === 'dialog') onOpenChange(false)
  }

  const handleDelete = (deleteTasks: boolean) => {
    onDeleteBucket(bucket.id, { deleteTasks })
    setDeleteConfirmOpen(false)
    onOpenChange(false)
  }

  const content = (
    <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bucket name"
                disabled={isUncategorized}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Owner</label>
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Assign to a person"
                disabled={isUncategorized}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Extra info, documentation, links…"
                rows={3}
                className="resize-y min-h-[60px]"
                disabled={isUncategorized}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tasks ({bucketTasks.length})</label>
              {bucketTasks.length === 0 ? (
                <div className="rounded-md border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                  No tasks in this bucket.
                </div>
              ) : (
                <div className="max-h-44 overflow-auto rounded-md border bg-muted/30">
                  {bucketTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/60"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onTaskClick?.(t)
                          if (variant === 'dialog') onOpenChange(false)
                        }}
                        className="min-w-0 flex-1 truncate text-left"
                      >
                        {t.title}
                      </button>
                      <span
                        className={cn(
                          'shrink-0 text-xs text-muted-foreground',
                          t.statusReason && (t.status === 'overdue' || t.status === 'blocked') && 'max-w-28 truncate',
                        )}
                        title={
                          t.statusReason && (t.status === 'overdue' || t.status === 'blocked')
                            ? t.statusReason
                            : undefined
                        }
                      >
                        {t.startDate}
                        {t.statusReason && (t.status === 'overdue' || t.status === 'blocked') && ` · ${t.statusReason}`}
                      </span>
                      {onUpdateTask && (
                        <select
                          value={t.status}
                          onChange={(e) => onUpdateTask(t.id, { status: e.target.value as TaskStatus })}
                          className="h-7 shrink-0 rounded border border-input bg-background px-2 text-xs"
                          aria-label={`Status for ${t.title}`}
                        >
                          <option value="open">Open</option>
                          <option value="started">Started</option>
                          <option value="closed">Closed</option>
                          <option value="overdue">Overdue</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isUncategorized && (
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete bucket
                </Button>
              </div>
            )}
    </div>
  )

  const footer = (
    <div className={cn('flex justify-end gap-2', variant === 'panel' && 'border-t pt-4')}>
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        Close
      </Button>
      {!isUncategorized && (
        <Button
          onClick={handleSave}
          disabled={
            !name.trim() ||
            (name.trim() === bucket.name &&
              description.trim() === (bucket.description ?? '') &&
              owner.trim() === (bucket.owner ?? ''))
          }
        >
          Save
        </Button>
      )}
    </div>
  )

  const alertDialog = (
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bucket</AlertDialogTitle>
            <AlertDialogDescription>
              {bucketTasks.length > 0 ? (
                <>
                  Delete &quot;{bucket.name}&quot;? This bucket has {bucketTasks.length} task(s). Do
                  you want to delete all tasks or just unassign them?
                </>
              ) : (
                <>Delete &quot;{bucket.name}&quot;? This cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {bucketTasks.length > 0 ? (
              <>
                <Button variant="outline" onClick={() => handleDelete(false)}>
                  Unassign tasks
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(true)}>
                  Delete bucket and all tasks
                </Button>
              </>
            ) : (
              <Button variant="destructive" onClick={() => handleDelete(false)}>
                Delete bucket
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  )

  if (variant === 'panel') {
    return (
      <>
        <div className="space-y-4 rounded-xl border bg-background p-4">
          <div>
            <h3 className="text-base font-semibold">Bucket details</h3>
            <p className="text-sm text-muted-foreground">
              {isUncategorized
                ? 'Tasks without a bucket.'
                : 'Edit name, view tasks, or delete this bucket.'}
            </p>
          </div>
          {content}
          {footer}
        </div>
        {alertDialog}
      </>
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(open) => {
          if (!open) {
            setName(bucket.name)
            setDescription(bucket.description ?? '')
            setOwner(bucket.owner ?? '')
          }
          onOpenChange(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bucket details</DialogTitle>
            <DialogDescription>
              {isUncategorized
                ? 'Tasks without a bucket.'
                : 'Edit name, view tasks, or delete this bucket.'}
            </DialogDescription>
          </DialogHeader>
          {content}
          {footer}
        </DialogContent>
      </Dialog>
      {alertDialog}
    </>
  )
}
