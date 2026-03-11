import { useEffect, useMemo, useState } from 'react'

import { BookOpen, CheckSquare, ChevronRight, Folder, PanelLeftClose, PanelRight, Plus, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Bucket, MeetingNote, Task } from '@/domain/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

function AddPillSelect({
  tasks,
  buckets,
  linkedTaskIds,
  linkedBucketIds,
  onSelect,
}: {
  tasks: Task[]
  buckets: Bucket[]
  linkedTaskIds: string[]
  linkedBucketIds: string[]
  onSelect: (id: string, type: 'task' | 'bucket') => void
}) {
  const availableTasks = tasks.filter((t) => !linkedTaskIds.includes(t.id))
  const availableBuckets = buckets.filter((b) => !linkedBucketIds.includes(b.id))
  const hasOptions = availableTasks.length > 0 || availableBuckets.length > 0

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 rounded-full border-dashed px-2.5 text-xs"
          title="Add task or bucket"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-48 min-w-[180px]">
        {!hasOptions ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">None available</div>
        ) : (
          <>
            {availableTasks.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel>Tasks</DropdownMenuLabel>
                {availableTasks.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onSelect={() => onSelect(t.id, 'task')}
                    className="flex items-center gap-2"
                  >
                    <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                    {t.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}
            {availableBuckets.length > 0 && (
              <>
                {availableTasks.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Buckets</DropdownMenuLabel>
                  {availableBuckets.map((b) => (
                    <DropdownMenuItem
                      key={b.id}
                      onSelect={() => onSelect(b.id, 'bucket')}
                      className="flex items-center gap-2"
                    >
                      <Folder className="h-3.5 w-3.5 shrink-0" />
                      {b.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MeetingNotesPanel({
  projectId,
  tasks,
  buckets,
  noteIdToSelect,
  selectedNoteId,
  selectedNotebookId,
  onSelectNote,
  onSelectNotebook,
}: {
  projectId: string
  tasks: Task[]
  buckets: Bucket[]
  noteIdToSelect?: string | null
  selectedNoteId?: string | null
  selectedNotebookId?: string | null
  onSelectNote?: (noteId: string | null) => void
  onSelectNotebook?: (notebookId: string | null) => void
}) {
  const notebooksRecord = useAppStore((s) => s.notebooks)
  const notebooks = useMemo(
    () =>
      Object.values(notebooksRecord ?? {})
        .filter((n) => n.projectId === projectId)
        .sort((a, b) => a.order - b.order),
    [projectId, notebooksRecord],
  )
  const createNotebook = useAppStore((s) => s.createNotebook)
  const addMeetingNote = useAppStore((s) => s.addMeetingNote)
  const updateMeetingNote = useAppStore((s) => s.updateMeetingNote)
  const deleteMeetingNote = useAppStore((s) => s.deleteMeetingNote)

  const allNotes = useAppStore((s) => s.meetingNotes)

  const [internalNotebookId, setInternalNotebookId] = useState<string | null>(null)
  const [internalNoteId, setInternalNoteId] = useState<string | null>(null)
  const isControlled = selectedNotebookId !== undefined && selectedNoteId !== undefined
  const selectedNotebookIdVal = isControlled ? selectedNotebookId : internalNotebookId
  const selectedNoteIdVal = isControlled ? selectedNoteId : internalNoteId
  const setSelectedNotebookId = (id: string | null) => {
    if (isControlled) onSelectNotebook?.(id)
    else setInternalNotebookId(id)
  }
  const setSelectedNoteId = (id: string | null) => {
    if (isControlled) onSelectNote?.(id)
    else setInternalNoteId(id)
  }
  const [newNotebookName, setNewNotebookName] = useState('')
  const [showNewNotebook, setShowNewNotebook] = useState(false)
  const [notebooksCollapsed, setNotebooksCollapsed] = useState(false)
  const [notesCollapsed, setNotesCollapsed] = useState(false)

  const notes = useMemo(
    () =>
      selectedNotebookIdVal
        ? Object.values(allNotes)
            .filter((n) => n.notebookId === selectedNotebookIdVal)
            .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
        : [],
    [selectedNotebookIdVal, allNotes],
  )

  const selectedNote = selectedNoteIdVal ? allNotes[selectedNoteIdVal] : null

  useEffect(() => {
    if (noteIdToSelect && allNotes[noteIdToSelect]) {
      const note = allNotes[noteIdToSelect]
      setSelectedNotebookId(note.notebookId)
      setSelectedNoteId(noteIdToSelect)
    }
  }, [noteIdToSelect, allNotes])

  const handleCreateNotebook = () => {
    if (!newNotebookName.trim()) return
    const id = createNotebook({ projectId, name: newNotebookName.trim() })
    setNewNotebookName('')
    setShowNewNotebook(false)
    setSelectedNotebookId(id)
    setSelectedNoteId(null)
  }

  const handleCreateNote = () => {
    if (!selectedNotebookIdVal) return
    const id =     addMeetingNote({
      projectId,
      notebookId: selectedNotebookIdVal,
      title: 'Untitled',
      content: '',
    })
    setSelectedNoteId(id)
  }

  const selectedNotebook = selectedNotebookIdVal
    ? notebooks.find((n) => n.id === selectedNotebookIdVal)
    : null

  return (
    <div className="flex h-[600px] overflow-hidden rounded-xl border bg-background">
      {/* Left sidebar - notebooks */}
      <div
        className={cn(
          'flex shrink-0 flex-col border-r bg-muted/30 transition-[width] duration-200',
          notebooksCollapsed ? 'w-10' : 'w-56',
        )}
      >
        {notebooksCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setNotebooksCollapsed(false)}
              title="Expand notebooks"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium text-muted-foreground">Notebooks</span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowNewNotebook(true)}
                  title="New notebook"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setNotebooksCollapsed(true)}
                  title="Collapse notebooks"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {showNewNotebook && (
              <div className="flex items-center gap-1 border-b px-2 py-2">
                <Input
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  placeholder="Notebook name"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNotebook()
                    if (e.key === 'Escape') setShowNewNotebook(false)
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={handleCreateNotebook} disabled={!newNotebookName.trim()}>
                  Add
                </Button>
              </div>
            )}
            <div className="flex-1 overflow-auto">
              {notebooks.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  No notebooks. Create one to get started.
                </div>
              ) : (
                notebooks.map((nb) => (
                  <button
                    key={nb.id}
                    type="button"
                    onClick={() => {
                      setSelectedNotebookId(nb.id)
                      setSelectedNoteId(null)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                      selectedNotebookIdVal === nb.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{nb.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Middle - notes list */}
      <div
        className={cn(
          'flex shrink-0 flex-col border-r transition-[width] duration-200',
          notesCollapsed ? 'w-10' : 'w-56',
        )}
      >
        {notesCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setNotesCollapsed(false)}
              title="Expand notes"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
            {selectedNotebook && (
              <span className="text-[10px] text-muted-foreground -rotate-90 whitespace-nowrap">
                {selectedNotebook.name}
              </span>
            )}
          </div>
        ) : selectedNotebook ? (
          <>
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="min-w-0 truncate font-medium">{selectedNotebook.name}</span>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={handleCreateNote}
                  title="New note"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setNotesCollapsed(true)}
                  title="Collapse notes"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {notes.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  No notes yet.
                </div>
              ) : (
                notes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNoteId(n.id)}
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors',
                      selectedNoteIdVal === n.id ? 'bg-primary/10' : 'hover:bg-muted/50',
                    )}
                  >
                    <span className="truncate font-medium">{n.title || 'Untitled'}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(n.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a notebook
          </div>
        )}
      </div>

      {/* Main content - note editor */}
      <div className="min-w-0 flex-1">
        {selectedNote ? (
          <NoteEditor
            note={selectedNote}
            tasks={tasks}
            buckets={buckets}
            onUpdate={updateMeetingNote}
            onDelete={() => {
              deleteMeetingNote(selectedNote.id)
              setSelectedNoteId(null)
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select or create a note
          </div>
        )}
      </div>
    </div>
  )
}

function NoteEditor({
  note,
  tasks,
  buckets,
  onUpdate,
  onDelete,
}: {
  note: MeetingNote
  tasks: Task[]
  buckets: Bucket[]
  onUpdate: (id: string, patch: Partial<MeetingNote>) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [peoplePresent, setPeoplePresent] = useState(note.peoplePresent ?? '')
  const [preparation, setPreparation] = useState(note.preparation ?? '')
  const [linkedTaskIds, setLinkedTaskIds] = useState(note.linkedTaskIds)
  const [linkedBucketIds, setLinkedBucketIds] = useState(note.linkedBucketIds ?? [])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
    setPeoplePresent(note.peoplePresent ?? '')
    setPreparation(note.preparation ?? '')
    setLinkedTaskIds(note.linkedTaskIds)
    setLinkedBucketIds(note.linkedBucketIds ?? [])
    setDeleteConfirmOpen(false)
  }, [note.id])

  const handleBlur = () => {
    if (title !== note.title) onUpdate(note.id, { title })
    if (content !== note.content) onUpdate(note.id, { content })
    if (peoplePresent !== (note.peoplePresent ?? '')) onUpdate(note.id, { peoplePresent: peoplePresent || undefined })
    if (preparation !== (note.preparation ?? '')) onUpdate(note.id, { preparation: preparation || undefined })
    if (
      JSON.stringify(linkedTaskIds) !== JSON.stringify(note.linkedTaskIds) ||
      JSON.stringify(linkedBucketIds) !== JSON.stringify(note.linkedBucketIds ?? [])
    ) {
      onUpdate(note.id, { linkedTaskIds, linkedBucketIds })
    }
  }

  const addLink = (id: string, type: 'task' | 'bucket') => {
    if (type === 'task') {
      if (linkedTaskIds.includes(id)) return
      const next = [...linkedTaskIds, id]
      setLinkedTaskIds(next)
      onUpdate(note.id, { linkedTaskIds: next, linkedBucketIds })
    } else {
      if (linkedBucketIds.includes(id)) return
      const next = [...linkedBucketIds, id]
      setLinkedBucketIds(next)
      onUpdate(note.id, { linkedTaskIds, linkedBucketIds: next })
    }
  }

  const removeLink = (id: string, type: 'task' | 'bucket') => {
    if (type === 'task') {
      const next = linkedTaskIds.filter((x) => x !== id)
      setLinkedTaskIds(next)
      onUpdate(note.id, { linkedTaskIds: next, linkedBucketIds })
    } else {
      const next = linkedBucketIds.filter((x) => x !== id)
      setLinkedBucketIds(next)
      onUpdate(note.id, { linkedTaskIds, linkedBucketIds: next })
    }
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleBlur}
          placeholder="Meeting title"
          className="text-lg font-semibold"
        />
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteConfirmOpen(true)}
            title="Delete note"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete meeting note?</AlertDialogTitle>
              <AlertDialogDescription>
                Delete &quot;{note.title || 'Untitled'}&quot;? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onDelete()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="mb-4 flex gap-4 text-xs text-muted-foreground">
        <span>Created: {new Date(note.createdAt).toLocaleString()}</span>
        <span>Last edited: {new Date(note.updatedAt).toLocaleString()}</span>
      </div>

      {/* Linked tasks & buckets */}
      <div className="mb-4 space-y-2">
        <div className="text-sm font-medium">Linked</div>
        <div className="flex flex-wrap items-center gap-2">
          {linkedTaskIds.map((id) => {
            const t = tasks.find((x) => x.id === id)
            if (!t) return null
            return (
              <Badge
                key={`task-${t.id}`}
                variant="default"
                className="cursor-pointer gap-1 pr-1"
                onClick={() => removeLink(t.id, 'task')}
              >
                <CheckSquare className="h-3 w-3 shrink-0" />
                {t.title}
                <X className="h-3 w-3" />
              </Badge>
            )
          })}
          {linkedBucketIds.map((id) => {
            const b = buckets.find((x) => x.id === id)
            if (!b) return null
            return (
              <Badge
                key={`bucket-${b.id}`}
                variant="default"
                className="cursor-pointer gap-1 pr-1"
                onClick={() => removeLink(b.id, 'bucket')}
              >
                <Folder className="h-3 w-3 shrink-0" />
                {b.name}
                <X className="h-3 w-3" />
              </Badge>
            )
          })}
          <AddPillSelect
            tasks={tasks}
            buckets={buckets}
            linkedTaskIds={linkedTaskIds}
            linkedBucketIds={linkedBucketIds}
            onSelect={addLink}
          />
        </div>
      </div>

      {/* People present */}
      <div className="mb-4 space-y-2">
        <div className="text-sm font-medium">People present</div>
        <Input
          value={peoplePresent}
          onChange={(e) => setPeoplePresent(e.target.value)}
          onBlur={handleBlur}
          placeholder="e.g. John, Jane, Bob"
        />
      </div>

      {/* Preparation */}
      <div className="mb-4 space-y-2">
        <div className="text-sm font-medium">Meeting preparation</div>
        <Textarea
          value={preparation}
          onChange={(e) => setPreparation(e.target.value)}
          onBlur={handleBlur}
          placeholder="Agenda, pre-reads, context…"
          rows={3}
          className="resize-y"
        />
      </div>

      {/* Meeting notes */}
      <div className="flex-1 space-y-2">
        <div className="text-sm font-medium">Meeting notes</div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          placeholder="What was discussed? Decisions, next steps…"
          rows={12}
          className="min-h-[200px] resize-y"
        />
      </div>
    </div>
  )
}
