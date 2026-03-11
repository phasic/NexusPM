import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BucketDetailsDialog } from '@/components/bucket/BucketDetailsDialog'
import { GanttChart } from '@/components/gantt/GanttChart'
import { InsightsPanel } from '@/components/insights/InsightsPanel'
import { MeetingNotesPanel } from '@/components/notes/MeetingNotesPanel'
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
            .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
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
  const notebookById = useAppStore((s) => s.notebooks ?? {})
  const moveTaskByDays = useAppStore((s) => s.moveTaskByDays)
  const reorderTasksInBucket = useAppStore((s) => s.reorderTasksInBucket)
  const reorderBuckets = useAppStore((s) => s.reorderBuckets)
  const addDependency = useAppStore((s) => s.addDependency)
  const removeDependency = useAppStore((s) => s.removeDependency)
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
  const [noteIdToSelect, setNoteIdToSelect] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null)

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

  useEffect(() => {
    setSelectedNoteId(null)
    setSelectedNotebookId(null)
  }, [projectId])

  useEffect(() => {
    if (noteIdToSelect && allNotes[noteIdToSelect]) {
      const note = allNotes[noteIdToSelect]
      setSelectedNotebookId(note.notebookId)
      setSelectedNoteId(noteIdToSelect)
      setNoteIdToSelect(null)
    }
  }, [noteIdToSelect, allNotes])

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
          <TabsTrigger value="notes">Notebook</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
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
                          linkedNotes={
                            selectedTask
                              ? notes.filter((n) => n.linkedTaskIds?.includes(selectedTask.id))
                              : []
                          }
                          onNoteClick={(noteId) => {
                            setNoteIdToSelect(noteId)
                            setActiveTab('notes')
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
                          linkedNotes={
                            selectedBucket
                              ? notes.filter((n) => n.linkedBucketIds?.includes(selectedBucket.id))
                              : []
                          }
                          onNoteClick={(noteId) => {
                            setNoteIdToSelect(noteId)
                            setActiveTab('notes')
                          }}
                        />
                      )}
                    </div>
                  )}
          </div>
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
              notebookById,
            }}
            onTaskClick={(task) => {
              setSelectedTask(task)
              setActiveTab('timeline')
            }}
            onNoteClick={(noteId) => {
              const note = allNotes[noteId]
              if (note) {
                setSelectedNotebookId(note.notebookId)
                setSelectedNoteId(noteId)
              }
              setActiveTab('notes')
            }}
          />
        </TabsContent>

        <TabsContent value="notes">
          <MeetingNotesPanel
                projectId={projectId}
                tasks={orderedTasks}
                buckets={buckets}
                noteIdToSelect={noteIdToSelect}
                selectedNoteId={selectedNoteId}
                selectedNotebookId={selectedNotebookId}
                onSelectNote={setSelectedNoteId}
                onSelectNotebook={setSelectedNotebookId}
              />
        </TabsContent>
      </Tabs>
    </div>
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

