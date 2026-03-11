import { differenceInCalendarDays, isBefore, parseISO } from 'date-fns'

import type { MeetingNote, Project, Task } from '@/domain/types'

export function getProjectTasks(tasks: Record<string, Task>, projectId: string) {
  return Object.values(tasks).filter((t) => t.projectId === projectId)
}

export function getProjectNotes(
  notes: Record<string, MeetingNote>,
  projectId: string,
) {
  return Object.values(notes)
    .filter((n) => n.projectId === projectId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export function getProjectProgress(tasks: Task[]) {
  if (tasks.length === 0) return 0
  const done = tasks.filter((t) => t.status === 'done').length
  return done / tasks.length
}

export function getProjectNextDeadline(tasks: Task[]) {
  const pending = tasks.filter((t) => t.status !== 'done')
  if (pending.length === 0) return null
  const soonest = pending
    .slice()
    .sort((a, b) => (a.endDate < b.endDate ? -1 : 1))[0]
  return soonest.endDate
}

export function isTaskBlocked(task: Task, taskById: Record<string, Task>) {
  return task.dependsOn.some((id) => {
    const dep = taskById[id]
    return dep ? dep.status !== 'done' : false
  })
}

export function getProjectBlockedTasks(tasks: Task[], taskById: Record<string, Task>) {
  return tasks.filter((t) => t.status !== 'done' && isTaskBlocked(t, taskById))
}

export function isProjectActive(project: Project, tasks: Task[]) {
  void project
  return tasks.some((t) => t.status !== 'done')
}

export function getDueInDays(isoDate: string, now = new Date()) {
  const d = parseISO(isoDate)
  return differenceInCalendarDays(d, now)
}

export function isOverdue(isoDate: string, now = new Date()) {
  return isBefore(parseISO(isoDate), now)
}

