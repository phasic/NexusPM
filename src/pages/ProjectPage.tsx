import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

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
      description: data.description,
      owner: data.owner,
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
                    onTaskClick={(task) => {
                      setSelectedTask(task)
                      setSelectedBucket(null)
                    }}
                    onUpdateTask={updateTask}
                    onReorderTasksInBucket={reorderTasksInBucket}
                    onSetTaskBucket={setTaskBucket}
                    onReorderBuckets={reorderBuckets}
                    onAddTask={handleAddTask}
                    onAddBucket={handleAddBucket}
                    onBucketClick={(bucket) => {
                      setSelectedBucket(bucket)
                      setSelectedTask(null)
                    }}
                  />

                  <AddBucketDialog
                    open={addBucketDialogOpen}
                    onOpenChange={setAddBucketDialogOpen}
                    onCreateBucket={(name) => {
                      createBucket({ projectId, name })
                      setAddBucketDialogOpen(false)
                    }}
                  />

                  {(createDialogOpen || selectedTask !== null || selectedBucket !== null) && (
                    <div className="mt-4 border-t pt-4">
                      {createDialogOpen || selectedTask !== null ? (
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
                          variant="panel"
                          onBucketClick={(bucket) => {
                            setSelectedBucket(bucket)
                            setSelectedTask(null)
                          }}
                        />
                      ) : (
                        <BucketDetailsDialog
                          bucket={selectedBucket}
                          tasks={orderedTasks}
                          open={selectedBucket !== null}
                          onOpenChange={(open) => !open && setSelectedBucket(null)}
                          onUpdateBucket={(id, patch) => updateBucket(id, patch)}
                          onDeleteBucket={deleteBucket}
                          onTaskClick={(task) => {
                            setSelectedTask(task)
                            setSelectedBucket(null)
                          }}
                          onUpdateTask={updateTask}
                          variant="panel"
                        />
                      )}
                    </div>
                  )}
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

