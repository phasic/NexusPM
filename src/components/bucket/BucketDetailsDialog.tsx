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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Bucket, Task } from '@/domain/types'

export function BucketDetailsDialog({
  bucket,
  tasks,
  open,
  onOpenChange,
  onUpdateBucket,
  onDeleteBucket,
  onTaskClick,
}: {
  bucket: Bucket | null
  tasks: Task[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateBucket: (id: string, patch: { name: string }) => void
  onDeleteBucket: (id: string, options?: { deleteTasks?: boolean }) => void
  onTaskClick?: (task: Task) => void
}) {
  const [name, setName] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (bucket && open) {
      setName(bucket.name)
    }
  }, [bucket, open])

  if (!bucket) return null

  const bucketTasks = tasks.filter((t) =>
    bucket.id === '__uncategorized__' ? !t.bucketId : t.bucketId === bucket.id,
  )
  const isUncategorized = bucket.id === '__uncategorized__'

  const handleSaveName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== bucket.name) {
      onUpdateBucket(bucket.id, { name: trimmed })
    }
    onOpenChange(false)
  }

  const handleDelete = (deleteTasks: boolean) => {
    onDeleteBucket(bucket.id, { deleteTasks })
    setDeleteConfirmOpen(false)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(open) => {
          if (!open) setName(bucket.name)
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
              <label className="text-sm font-medium">Tasks ({bucketTasks.length})</label>
              {bucketTasks.length === 0 ? (
                <div className="rounded-md border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                  No tasks in this bucket.
                </div>
              ) : (
                <div className="max-h-44 overflow-auto rounded-md border bg-muted/30">
                  {bucketTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onTaskClick?.(t)
                        onOpenChange(false)
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/60"
                    >
                      <span className="truncate">{t.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t.status} • {t.startDate}
                      </span>
                    </button>
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

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {!isUncategorized && (
              <Button onClick={handleSaveName} disabled={!name.trim() || name.trim() === bucket.name}>
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  )
}
