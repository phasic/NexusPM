import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BucketDetailsDialog } from '@/components/bucket/BucketDetailsDialog'
import { GanttChart } from '@/components/gantt/GanttChart'
import { InsightsPanel } from '@/components/insights/InsightsPanel'
import { TaskDetailsDialog, type CreateTaskData } from '@/components/task/TaskDetailsDialog'
import type { Bucket, Task } from '@/domain/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

export function ProjectPage() {
  const { projectId } = useParams()
  const project = useAppStore((s) => (projectId ? s.projects[projectId] : undefined))
  const allTasks = useAppStore((s) => s.tasks)
  const allNotes = useAppStore((s) => s.meetingNotes)
  const tasks = useMemo(
    () =>
      projectId
        ? Object.values(allTasks).filter((t) => t.projectId === projectId)
        : [],
    [projectId, allTasks],
  )
  const notes = useMemo(
    () =>
      projectId
        ? Object.values(allNotes)
            .filter((n) => n.projectId === projectId)
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        : [],
    [projectId, allNotes],
  )
  const allBuckets = useAppStore((s) => s.buckets)
  const buckets = useMemo(
    () =>
      projectId
        ? Object.values(allBuckets)
            .filter((b) => b.projectId === projectId)
            .sort((a, b) => a.order - b.order)
        : [],
    [projectId, allBuckets],
  )
  const bucketById = allBuckets
  const taskById = allTasks
  const moveTaskByDays = useAppStore((s) => s.moveTaskByDays)
  const reorderTasksInBucket = useAppStore((s) => s.reorderTasksInBucket)
  const reorderBuckets = useAppStore((s) => s.reorderBuckets)
  const addDependency = useAppStore((s) => s.addDependency)
  const removeDependency = useAppStore((s) => s.removeDependency)
  const addMeetingNote = useAppStore((s) => s.addMeetingNote)
  const createBucket = useAppStore((s) => s.createBucket)
  const deleteBucket = useAppStore((s) => s.deleteBucket)
  const updateBucket = useAppStore((s) => s.updateBucket)
  const createTask = useAppStore((s) => s.createTask)
  const deleteTask = useAppStore((s) => s.deleteTask)
  const setTaskBucket = useAppStore((s) => s.setTaskBucket)
  const updateTask = useAppStore((s) => s.updateTask)

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [addBucketDialogOpen, setAddBucketDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('timeline')

  const handleAddTask = () => {
    if (!projectId) return
    setCreateDialogOpen(true)
  }

  const handleCreateTask = (data: CreateTaskData) => {
    if (!projectId) return
    const id = createTask({
      projectId,
      title: data.title,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      statusReason: data.statusReason,
      dependsOn: data.dependsOn,
    })
    if (data.color) updateTask(id, { color: data.color })
    setTaskBucket(id, data.bucketId)
    setCreateDialogOpen(false)
  }

  const handleAddBucket = () => {
    if (!projectId) return
    setAddBucketDialogOpen(true)
  }

  if (!projectId) return <Navigate to="/" replace />
  if (!project) return <Navigate to="/" replace />

  const done = tasks.filter((t) => t.status === 'closed').length
  const orderedTasks = useMemo(
    () =>
      tasks.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)),
    [tasks],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">{project.name}</div>
          <div className="text-sm text-muted-foreground">{project.description}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-foreground">
            {done}/{tasks.length} closed
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Meeting notes</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <GanttChart
                    projectId={projectId}
                    uncategorizedOrder={project.uncategorizedOrder}
                    tasks={orderedTasks}
                    taskById={taskById}
                    buckets={buckets}
                    bucketById={bucketById}
                    onMoveTaskByDays={moveTaskByDays}
                    onTaskClick={setSelectedTask}
                    onUpdateTask={updateTask}
                    onReorderTasksInBucket={reorderTasksInBucket}
                    onSetTaskBucket={setTaskBucket}
                    onReorderBuckets={reorderBuckets}
                    onAddTask={handleAddTask}
                    onAddBucket={handleAddBucket}
                    onBucketClick={setSelectedBucket}
                  />

                  <TaskDetailsDialog
                    task={selectedTask}
                    buckets={buckets}
                    tasks={orderedTasks}
                    taskById={taskById}
                    open={createDialogOpen || selectedTask !== null}
                    onOpenChange={(open) => {
                      if (!open) {
                        setCreateDialogOpen(false)
                        setSelectedTask(null)
                      }
                    }}
                    onUpdate={updateTask}
                    onAddDependency={addDependency}
                    onRemoveDependency={removeDependency}
                    onSetBucket={setTaskBucket}
                    onDelete={deleteTask}
                    createMode={createDialogOpen}
                    projectId={projectId}
                    onCreate={handleCreateTask}
                  />

                  <BucketDetailsDialog
                    bucket={selectedBucket}
                    tasks={orderedTasks}
                    open={selectedBucket !== null}
                    onOpenChange={(open) => !open && setSelectedBucket(null)}
                    onUpdateBucket={(id, patch) => updateBucket(id, patch)}
                    onDeleteBucket={deleteBucket}
                    onTaskClick={setSelectedTask}
                    onUpdateTask={updateTask}
                  />

                  <AddBucketDialog
                    open={addBucketDialogOpen}
                    onOpenChange={setAddBucketDialogOpen}
                    onCreateBucket={(name) => {
                      createBucket({ projectId, name })
                      setAddBucketDialogOpen(false)
                    }}
                  />

                  <BucketPanel
                    buckets={buckets}
                    tasks={orderedTasks}
                    onCreateBucket={(name) => createBucket({ projectId, name })}
                    onSetTaskBucket={setTaskBucket}
                    onDeleteBucket={deleteBucket}
                    onBucketClick={setSelectedBucket}
                  />

                <DependencyPanel
                  tasks={orderedTasks}
                  taskById={taskById}
                  onAdd={(taskId, depId) => addDependency(taskId, depId)}
                  onRemove={(taskId, depId) => removeDependency(taskId, depId)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <InsightsPanel
            projectId={projectId}
            context={{
              project,
              tasks: orderedTasks,
              buckets,
              notes,
              taskById,
              bucketById,
            }}
            onTaskClick={(task) => {
              setSelectedTask(task)
              setActiveTab('timeline')
            }}
            onNoteClick={(noteId) => {
              setActiveTab('notes')
              setTimeout(() => {
                document.getElementById(`note-${noteId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 100)
            }}
          />
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Meeting notes</CardTitle>
                <NewNoteDialog
                  tasks={orderedTasks}
                  onAdd={(content, linkedTaskIds) =>
                    addMeetingNote({ projectId, content, linkedTaskIds })
                  }
                />
              </div>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No notes yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <div key={n.id} id={`note-${n.id}`} className="rounded-xl border bg-background p-4 scroll-mt-4">
                      <div className="text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm">
                        {n.content}
                      </div>
                      {n.linkedTaskIds.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {n.linkedTaskIds.map((id) => (
                            <Badge key={id} variant="secondary" className="text-foreground">
                              {taskById[id]?.title ?? id}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function NewNoteDialog({
  tasks,
  onAdd,
}: {
  tasks: Array<{ id: string; title: string }>
  onAdd: (content: string, linkedTaskIds: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [linked, setLinked] = useState<string[]>([])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          New note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New meeting note</DialogTitle>
          <DialogDescription>
            Notes are timestamped and can be linked to tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Note</div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What was discussed? Decisions, next steps, risks…"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Link to tasks</div>
            <div className="max-h-44 overflow-auto rounded-md border bg-background p-2">
              {tasks.length === 0 ? (
                <div className="px-2 py-1 text-sm text-muted-foreground">
                  No tasks available.
                </div>
              ) : (
                <div className="grid gap-1">
                  {tasks.map((t) => {
                    const checked = linked.includes(t.id)
                    return (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/40"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setLinked((prev) =>
                              e.target.checked
                                ? [...prev, t.id]
                                : prev.filter((x) => x !== t.id),
                            )
                          }}
                        />
                        <span className="truncate text-sm">{t.title}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!content.trim()) return
              onAdd(content.trim(), linked)
              setContent('')
              setLinked([])
              setOpen(false)
            }}
            disabled={!content.trim()}
          >
            Add note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddBucketDialog({
  open,
  onOpenChange,
  onCreateBucket,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateBucket: (name: string) => void
}) {
  const [newName, setNewName] = useState('')
  useEffect(() => {
    if (open) setNewName('')
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) setNewName('')
        onOpenChange(open)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New bucket</DialogTitle>
          <DialogDescription>
            Create a group to organize tasks on the timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Phase 1, Backend, …"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!newName.trim()) return
              onCreateBucket(newName.trim())
              setNewName('')
              onOpenChange(false)
            }}
            disabled={!newName.trim()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BucketPanel({
  buckets,
  tasks,
  onCreateBucket,
  onSetTaskBucket,
  onDeleteBucket,
  onBucketClick,
}: {
  buckets: Bucket[]
  tasks: Array<{ id: string; title: string; bucketId?: string }>
  onCreateBucket: (name: string) => void
  onSetTaskBucket: (taskId: string, bucketId: string | null) => void
  onDeleteBucket: (id: string, options?: { deleteTasks?: boolean }) => void
  onBucketClick?: (bucket: Bucket) => void
}) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '')
  const [bucketId, setBucketId] = useState<string>('')
  const [deleteBucketId, setDeleteBucketId] = useState<string | null>(null)

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Buckets</div>
          <div className="text-sm text-muted-foreground">
            Group tasks visually on the timeline.
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Assign to bucket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign task to bucket</DialogTitle>
                <DialogDescription>
                  Move a task into a bucket for visual grouping.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Task</div>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                  >
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Bucket</div>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={bucketId}
                    onChange={(e) => setBucketId(e.target.value)}
                  >
                    <option value="">— None (Uncategorized) —</option>
                    {buckets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setAssignOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!taskId) return
                    onSetTaskBucket(taskId, bucketId || null)
                    setAssignOpen(false)
                  }}
                >
                  Assign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                New bucket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New bucket</DialogTitle>
                <DialogDescription>
                  Create a group to organize tasks on the timeline.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Name</div>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Phase 1, Backend, …"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!newName.trim()) return
                    onCreateBucket(newName.trim())
                    setNewName('')
                    setOpen(false)
                  }}
                  disabled={!newName.trim()}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {buckets.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No buckets yet. Create one to group tasks.
          </div>
        ) : (
          buckets.map((b) => {
            const count = tasks.filter((t) => t.bucketId === b.id).length
            return (
              <div
                key={b.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2',
                  onBucketClick && 'cursor-pointer hover:bg-muted/50',
                )}
                role={onBucketClick ? 'button' : undefined}
                tabIndex={onBucketClick ? 0 : undefined}
                onClick={() => onBucketClick?.(b)}
                onKeyDown={(e) => {
                  if (onBucketClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onBucketClick(b)
                  }
                }}
              >
                <div className="text-sm font-medium">{b.name}</div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-sm text-muted-foreground">{count} tasks</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteBucketId(b.id)}
                    title="Delete bucket"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <Dialog open={deleteBucketId !== null} onOpenChange={(open) => !open && setDeleteBucketId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete bucket</DialogTitle>
            <DialogDescription>
              {deleteBucketId && tasks.filter((t) => t.bucketId === deleteBucketId).length > 0 ? (
                <>
                  Delete &quot;{buckets.find((b) => b.id === deleteBucketId)?.name}&quot;? This bucket
                  has {tasks.filter((t) => t.bucketId === deleteBucketId).length} task(s). Do you want
                  to delete all tasks or just unassign them?
                </>
              ) : (
                <>
                  Delete &quot;{buckets.find((b) => b.id === deleteBucketId)?.name}&quot;? This
                  cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteBucketId(null)}>
              Cancel
            </Button>
            {deleteBucketId &&
            tasks.filter((t) => t.bucketId === deleteBucketId).length > 0 ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (deleteBucketId) {
                      onDeleteBucket(deleteBucketId, { deleteTasks: false })
                      setDeleteBucketId(null)
                    }
                  }}
                >
                  Unassign tasks
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (deleteBucketId) {
                      onDeleteBucket(deleteBucketId, { deleteTasks: true })
                      setDeleteBucketId(null)
                    }
                  }}
                >
                  Delete bucket and all tasks
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteBucketId) {
                    onDeleteBucket(deleteBucketId)
                    setDeleteBucketId(null)
                  }
                }}
              >
                Delete bucket
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DependencyPanel({
  tasks,
  taskById,
  onAdd,
  onRemove,
}: {
  tasks: Array<{ id: string; title: string; dependsOn: string[] }>
  taskById: Record<string, { id: string; title: string }>
  onAdd: (taskId: string, dependsOnTaskId: string) => void
  onRemove: (taskId: string, dependsOnTaskId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '')
  const [depId, setDepId] = useState('')

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Dependencies</div>
          <div className="text-sm text-muted-foreground">
            Link tasks so downstream work can be marked blocked.
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Link dependency
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link dependency</DialogTitle>
              <DialogDescription>
                Task B can’t start until Task A is done.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Task (blocked)</div>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Depends on</div>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={depId}
                  onChange={(e) => setDepId(e.target.value)}
                >
                  <option value="">Select a dependency…</option>
                  {tasks
                    .filter((t) => t.id !== taskId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!taskId || !depId) return
                  onAdd(taskId, depId)
                  setDepId('')
                  setOpen(false)
                }}
                disabled={!taskId || !depId}
              >
                Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 grid gap-2">
        {tasks.every((t) => t.dependsOn.length === 0) ? (
          <div className="text-sm text-muted-foreground">
            No dependencies yet.
          </div>
        ) : (
          tasks
            .filter((t) => t.dependsOn.length > 0)
            .map((t) => (
              <div
                key={t.id}
                className="rounded-lg border bg-background px-3 py-2"
              >
                <div className="text-sm font-medium">{t.title}</div>
                <div className="mt-2 grid gap-2">
                  {t.dependsOn.map((dep) => (
                    <div
                      key={dep}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-2 py-1"
                    >
                      <div className="min-w-0 text-sm text-muted-foreground">
                        Depends on{' '}
                        <span className="text-foreground">
                          {taskById[dep]?.title ?? dep}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemove(t.id, dep)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  )
}

