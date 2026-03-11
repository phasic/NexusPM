import React from 'react'

import type { MeetingNote, Task } from '@/domain/types'

/**
 * Renders **bold** and *italic* markdown as React elements.
 */
export function formatInlineMarkdown(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  let remaining = text
  const boldRe = /\*\*(.+?)\*\*/g
  const boldMixedRe = /\*([^*]+?)\*\*/g
  const italicRe = /\*([^*]+?)\*/g

  while (remaining.length > 0) {
    boldRe.lastIndex = 0
    boldMixedRe.lastIndex = 0
    italicRe.lastIndex = 0

    let earliest = remaining.length
    let match: { type: 'bold' | 'italic'; start: number; end: number; content: string } | null = null

    const b = boldRe.exec(remaining)
    if (b && b.index < earliest) {
      earliest = b.index
      match = { type: 'bold', start: b.index, end: b.index + b[0].length, content: b[1] }
    }

    const bm = boldMixedRe.exec(remaining)
    if (bm && bm.index < earliest) {
      earliest = bm.index
      match = { type: 'bold', start: bm.index, end: bm.index + bm[0].length, content: bm[1] }
    }

    const i = italicRe.exec(remaining)
    if (i && i.index < earliest) {
      earliest = i.index
      match = { type: 'italic', start: i.index, end: i.index + i[0].length, content: i[1] }
    }

    if (!match) {
      result.push(remaining)
      break
    }

    if (match.start > 0) {
      result.push(remaining.slice(0, match.start))
    }

    const inner = formatInlineMarkdown(match.content)
    result.push(match.type === 'bold' ? <strong>{inner}</strong> : <em>{inner}</em>)
    remaining = remaining.slice(match.end)
  }

  return result
}

/**
 * Replaces [taskName] and {noteName} patterns in text with clickable elements.
 * Renders **bold** and *italic* in plain text segments.
 * Only bracketed formats are linked; plain task names are not.
 */
export function linkifyInsightText(
  text: string,
  tasks: Task[],
  notes: MeetingNote[],
  onTaskClick: (task: Task) => void,
  onNoteClick: (noteId: string) => void,
): React.ReactNode[] {
  const result: React.ReactNode[] = []
  let remaining = text

  const taskByTitle = new Map(tasks.map((t) => [t.title, t]))

  const noteByDate = new Map<string, MeetingNote>()
  for (const n of notes) {
    const d = new Date(n.createdAt)
    const formats = [
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
      d.toLocaleDateString(),
    ]
    for (const f of formats) {
      noteByDate.set(f, n)
    }
  }

  const makeLink = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className="mx-0.5 inline-flex cursor-pointer items-baseline rounded px-0.5 font-medium text-primary underline-offset-2 hover:underline"
    >
      {label}
    </button>
  )

  const taskBracketRe = /\[([^\]]+)\]/g
  const noteBracketRe = /\{([^}]+)\}/g

  while (remaining.length > 0) {
    taskBracketRe.lastIndex = 0
    noteBracketRe.lastIndex = 0

    let earliest = remaining.length
    let match:
      | { type: 'task'; task: Task; label: string; start: number; end: number }
      | { type: 'note'; noteId: string; label: string; start: number; end: number }
      | { type: 'plain'; start: number; end: number; raw: string }
      | null = null

    const taskM = taskBracketRe.exec(remaining)
    if (taskM) {
      const task = taskByTitle.get(taskM[1].trim())
      if (task && taskM.index < earliest) {
        earliest = taskM.index
        match = { type: 'task', task, label: taskM[1].trim(), start: taskM.index, end: taskM.index + taskM[0].length }
      } else if (!task && taskM.index < earliest) {
        earliest = taskM.index
        match = { type: 'plain', start: taskM.index, end: taskM.index + taskM[0].length, raw: taskM[0] }
      }
    }

    const noteM = noteBracketRe.exec(remaining)
    if (noteM) {
      const note = noteByDate.get(noteM[1].trim())
      if (note && noteM.index < earliest) {
        earliest = noteM.index
        match = { type: 'note', noteId: note.id, label: noteM[1].trim(), start: noteM.index, end: noteM.index + noteM[0].length }
      } else if (!note && noteM.index < earliest) {
        earliest = noteM.index
        match = { type: 'plain', start: noteM.index, end: noteM.index + noteM[0].length, raw: noteM[0] }
      }
    }

    if (!match) {
      result.push(...formatInlineMarkdown(remaining))
      break
    }

    if (match.start > 0) {
      result.push(...formatInlineMarkdown(remaining.slice(0, match.start)))
    }

    if (match.type === 'task') {
      const { task } = match
      result.push(makeLink(task.title, () => onTaskClick(task)))
    } else if (match.type === 'note') {
      const { noteId, label } = match
      result.push(makeLink(label, () => onNoteClick(noteId)))
    } else {
      result.push(...formatInlineMarkdown(match.raw))
    }

    remaining = remaining.slice(match.end)
  }

  return result
}
