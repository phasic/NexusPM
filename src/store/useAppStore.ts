import { addDays, differenceInCalendarDays, parseISO } from 'date-fns'
import { nanoid } from 'nanoid'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AppData, Bucket, ID, MeetingNote, Project, Task, TaskStatus } from '@/domain/types'
import { createSeedData } from '@/store/seed'

type AppState = AppData & {
  createProject: (input: Pick<Project, 'name' | 'description'>) => ID
  updateProject: (id: ID, patch: Partial<Pick<Project, 'name' | 'description'>>) => void

  createTask: (
    input: Pick<Task, 'projectId' | 'title' | 'startDate' | 'endDate'> & {
      status?: TaskStatus
      statusReason?: string
      dependsOn?: ID[]
      description?: string
      owner?: string
    },
  ) => ID
  deleteTask: (id: ID) => void
  updateTask: (id: ID, patch: Partial<Omit<Task, 'id' | 'projectId'>>) => void
  moveTaskByDays: (id: ID, deltaDays: number) => void
  setTaskDates: (id: ID, startDate: Task['startDate'], endDate: Task['endDate']) => void
  reorderTasksInBucket: (bucketId: ID, orderedTaskIds: ID[]) => void

  addDependency: (taskId: ID, dependsOnTaskId: ID) => void
  removeDependency: (taskId: ID, dependsOnTaskId: ID) => void

  createBucket: (input: Pick<Bucket, 'projectId' | 'name'>) => ID
  updateBucket: (id: ID, patch: Partial<Pick<Bucket, 'name' | 'order' | 'description' | 'owner'>>) => void
  deleteBucket: (id: ID, options?: { deleteTasks?: boolean }) => void
  reorderBuckets: (projectId: ID, orderedBucketIds: ID[]) => void
  setTaskBucket: (taskId: ID, bucketId: ID | null) => void

  addMeetingNote: (input: Pick<MeetingNote, 'projectId' | 'content'> & { linkedTaskIds?: ID[] }) => ID
  updateMeetingNote: (id: ID, patch: Partial<Pick<MeetingNote, 'content' | 'linkedTaskIds'>>) => void

  replaceAll: (data: AppData) => void
  exportJson: () => string
  importJson: (json: string) => void

  getProjectTasks: (projectId: ID) => Task[]
  getProjectNotes: (projectId: ID) => MeetingNote[]
  isTaskBlocked: (taskId: ID) => boolean
  getBlockingDependencies: (taskId: ID) => Task[]

  projectInsights: Record<ID, string | null>
  setProjectInsights: (projectId: ID, insights: string | null) => void
}

const STORAGE_KEY = 'nexuspm:data:v1'

function clampDates(startDate: string, endDate: string) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { startDate, endDate }
  }
  if (differenceInCalendarDays(end, start) < 0) {
    return { startDate: endDate, endDate: startDate }
  }
  return { startDate, endDate }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createSeedData(),

      createProject: ({ name, description }) => {
        const id = nanoid()
        const p: Project = {
          id,
          name,
          description,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ projects: { ...s.projects, [id]: p } }))
        return id
      },

      updateProject: (id, patch) => {
        set((s) => {
          const current = s.projects[id]
          if (!current) return s
          return { projects: { ...s.projects, [id]: { ...current, ...patch } } }
        })
      },

      createTask: ({ projectId, title, startDate, endDate, status, statusReason, dependsOn, description, owner }) => {
        const id = nanoid()
        const normalized = clampDates(startDate, endDate)
        const existingInProject = Object.values(get().tasks).filter(
          (t) => t.projectId === projectId,
        )
        const maxOrder = existingInProject.reduce(
          (max, t) => Math.max(max, t.order ?? 0),
          -1,
        )
        const t: Task = {
          id,
          projectId,
          title,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          status: status ?? 'open',
          dependsOn: dependsOn ?? [],
          order: maxOrder + 1,
          ...(statusReason && { statusReason }),
          ...(description && { description }),
          ...(owner && { owner }),
        }
        set((s) => ({ tasks: { ...s.tasks, [id]: t } }))
        return id
      },

      updateTask: (id, patch) => {
        set((s) => {
          const current = s.tasks[id]
          if (!current) return s
          const next: Task = { ...current, ...patch }
          const normalized = clampDates(next.startDate, next.endDate)
          next.startDate = normalized.startDate
          next.endDate = normalized.endDate
          return { tasks: { ...s.tasks, [id]: next } }
        })
      },

      deleteTask: (id) => {
        set((s) => {
          const { [id]: _, ...restTasks } = s.tasks
          const tasks = { ...restTasks }
          for (const tid of Object.keys(tasks)) {
            const t = tasks[tid]
            if (t.dependsOn.includes(id)) {
              tasks[tid] = {
                ...t,
                dependsOn: t.dependsOn.filter((d) => d !== id),
              }
            }
          }
          const meetingNotes = { ...s.meetingNotes }
          for (const nid of Object.keys(meetingNotes)) {
            const note = meetingNotes[nid]
            if (note.linkedTaskIds.includes(id)) {
              meetingNotes[nid] = {
                ...note,
                linkedTaskIds: note.linkedTaskIds.filter((l) => l !== id),
              }
            }
          }
          return { tasks, meetingNotes }
        })
      },

      moveTaskByDays: (id, deltaDays) => {
        set((s) => {
          const current = s.tasks[id]
          if (!current) return s
          const start = addDays(parseISO(current.startDate), deltaDays)
          const end = addDays(parseISO(current.endDate), deltaDays)
          const next: Task = {
            ...current,
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10),
          }
          return { tasks: { ...s.tasks, [id]: next } }
        })
      },

      setTaskDates: (id, startDate, endDate) => {
        const normalized = clampDates(startDate, endDate)
        get().updateTask(id, normalized)
      },

      reorderTasksInBucket: (bucketId, orderedTaskIds) => {
        set((s) => {
          const tasks = { ...s.tasks }
          orderedTaskIds.forEach((taskId, index) => {
            const t = tasks[taskId]
            if (t && (t.bucketId === bucketId || (bucketId === '__uncategorized__' && !t.bucketId))) {
              tasks[taskId] = { ...t, order: index }
            }
          })
          return { tasks }
        })
      },

      addDependency: (taskId, dependsOnTaskId) => {
        set((s) => {
          const t = s.tasks[taskId]
          const dep = s.tasks[dependsOnTaskId]
          if (!t || !dep) return s
          if (taskId === dependsOnTaskId) return s
          if (t.dependsOn.includes(dependsOnTaskId)) return s
          return {
            tasks: {
              ...s.tasks,
              [taskId]: { ...t, dependsOn: [...t.dependsOn, dependsOnTaskId] },
            },
          }
        })
      },

      removeDependency: (taskId, dependsOnTaskId) => {
        set((s) => {
          const t = s.tasks[taskId]
          if (!t) return s
          return {
            tasks: {
              ...s.tasks,
              [taskId]: {
                ...t,
                dependsOn: t.dependsOn.filter((d) => d !== dependsOnTaskId),
              },
            },
          }
        })
      },

      createBucket: ({ projectId, name }) => {
        const id = nanoid()
        const existing = Object.values(get().buckets).filter((b) => b.projectId === projectId)
        const order = existing.length > 0 ? Math.max(...existing.map((b) => b.order)) + 1 : 0
        const b: Bucket = { id, projectId, name, order }
        set((s) => ({ buckets: { ...s.buckets, [id]: b } }))
        return id
      },

      updateBucket: (id, patch) => {
        set((s) => {
          const current = s.buckets[id]
          if (!current) return s
          return { buckets: { ...s.buckets, [id]: { ...current, ...patch } } }
        })
      },

      deleteBucket: (id, options) => {
        const deleteTasks = options?.deleteTasks ?? false
        set((s) => {
          const { [id]: _, ...restBuckets } = s.buckets
          const taskIdsInBucket = Object.values(s.tasks)
            .filter((t) => t.bucketId === id)
            .map((t) => t.id)
          let tasks = { ...s.tasks }
          if (deleteTasks) {
            for (const tid of taskIdsInBucket) {
              const { [tid]: __, ...rest } = tasks
              tasks = { ...rest }
              for (const otherId of Object.keys(tasks)) {
                const t = tasks[otherId]
                if (t.dependsOn.includes(tid)) {
                  tasks[otherId] = {
                    ...t,
                    dependsOn: t.dependsOn.filter((d) => d !== tid),
                  }
                }
              }
            }
            const meetingNotes = { ...s.meetingNotes }
            for (const nid of Object.keys(meetingNotes)) {
              const note = meetingNotes[nid]
              const stillLinked = note.linkedTaskIds.filter((l) => !taskIdsInBucket.includes(l))
              if (stillLinked.length !== note.linkedTaskIds.length) {
                meetingNotes[nid] = { ...note, linkedTaskIds: stillLinked }
              }
            }
            return { buckets: restBuckets, tasks, meetingNotes }
          }
          for (const tid of taskIdsInBucket) {
            tasks[tid] = { ...tasks[tid], bucketId: undefined }
          }
          return { buckets: restBuckets, tasks }
        })
      },

      reorderBuckets: (projectId, orderedBucketIds) => {
        set((s) => {
          const buckets = { ...s.buckets }
          const projects = { ...s.projects }
          let uncategorizedOrder: number | undefined
          orderedBucketIds.forEach((id, index) => {
            if (id === '__uncategorized__') {
              uncategorizedOrder = index
            } else {
              const b = buckets[id]
              if (b && b.projectId === projectId) {
                buckets[id] = { ...b, order: index }
              }
            }
          })
          const project = projects[projectId]
          if (project && uncategorizedOrder !== undefined) {
            projects[projectId] = { ...project, uncategorizedOrder }
          }
          return { buckets, projects }
        })
      },

      setTaskBucket: (taskId, bucketId) => {
        set((s) => {
          const t = s.tasks[taskId]
          if (!t) return s
          const targetBucketId = bucketId ?? undefined
          const tasksInBucket = Object.values(s.tasks).filter(
            (x) => (targetBucketId ? x.bucketId === targetBucketId : !x.bucketId) && x.id !== taskId,
          )
          const maxOrder = tasksInBucket.reduce((m, x) => Math.max(m, x.order ?? 0), -1)
          return {
            tasks: {
              ...s.tasks,
              [taskId]: { ...t, bucketId: targetBucketId, order: maxOrder + 1 },
            },
          }
        })
      },

      addMeetingNote: ({ projectId, content, linkedTaskIds }) => {
        const id = nanoid()
        const note: MeetingNote = {
          id,
          projectId,
          content,
          createdAt: new Date().toISOString(),
          linkedTaskIds: linkedTaskIds ?? [],
        }
        set((s) => ({ meetingNotes: { ...s.meetingNotes, [id]: note } }))
        return id
      },

      updateMeetingNote: (id, patch) => {
        set((s) => {
          const current = s.meetingNotes[id]
          if (!current) return s
          return {
            meetingNotes: { ...s.meetingNotes, [id]: { ...current, ...patch } },
          }
        })
      },

      replaceAll: (data) =>
        set((s) => ({
          ...s,
          projects: data.projects,
          buckets: data.buckets ?? {},
          tasks: data.tasks,
          meetingNotes: data.meetingNotes,
        })),

      exportJson: () => {
        const { projects, buckets, tasks, meetingNotes } = get()
        return JSON.stringify({ projects, buckets, tasks, meetingNotes } satisfies AppData, null, 2)
      },

      importJson: (json) => {
        const parsed: unknown = JSON.parse(json)
        if (!parsed || typeof parsed !== 'object') return
        const data = parsed as Partial<AppData>
        if (!data.projects || !data.tasks || !data.meetingNotes) return
        get().replaceAll({
          projects: data.projects,
          buckets: data.buckets ?? {},
          tasks: data.tasks,
          meetingNotes: data.meetingNotes,
        })
      },

      getProjectTasks: (projectId) =>
        Object.values(get().tasks).filter((t) => t.projectId === projectId),

      getProjectNotes: (projectId) =>
        Object.values(get().meetingNotes)
          .filter((n) => n.projectId === projectId)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),

      isTaskBlocked: (taskId) => {
        const t = get().tasks[taskId]
        if (!t) return false
        return t.dependsOn.some((depId) => {
          const dep = get().tasks[depId]
          return dep ? dep.status !== 'closed' : false
        })
      },

      getBlockingDependencies: (taskId) => {
        const t = get().tasks[taskId]
        if (!t) return []
        return t.dependsOn
          .map((id) => get().tasks[id])
          .filter((dep): dep is Task => Boolean(dep) && dep.status !== 'closed')
      },

      projectInsights: {},
      setProjectInsights: (projectId, insights) => {
        set((s) => ({
          projectInsights: {
            ...s.projectInsights,
            [projectId]: insights,
          },
        }))
      },
    }),
    {
      name: STORAGE_KEY,
      version: 6,
      partialize: (s) => ({
        projects: s.projects,
        buckets: s.buckets,
        tasks: s.tasks,
        meetingNotes: s.meetingNotes,
        projectInsights: s.projectInsights,
      }),
      migrate: (persisted, version) => {
        const p = persisted as Partial<AppData & { projectInsights?: Record<string, string | null> }>
        if (version < 2 && !p.buckets) {
          return { ...p, buckets: {} }
        }
        if (version < 3 && p.tasks) {
          const tasks = { ...p.tasks }
          for (const id of Object.keys(tasks)) {
            if (tasks[id] && tasks[id].order == null) {
              tasks[id] = { ...tasks[id], order: 0 }
            }
          }
          return { ...p, tasks }
        }
        if (version < 4 && !(p as { projectInsights?: unknown }).projectInsights) {
          return { ...p, projectInsights: {} }
        }
        if (version < 5 && p.tasks) {
          const statusMap: Record<string, string> = {
            todo: 'open',
            in_progress: 'started',
            done: 'closed',
          }
          const tasks = { ...p.tasks }
          for (const id of Object.keys(tasks)) {
            const t = tasks[id]
            if (t?.status && statusMap[t.status as string]) {
              tasks[id] = { ...t, status: statusMap[t.status as string] as Task['status'] }
            }
          }
          return { ...p, tasks }
        }
        if (version < 6) {
          return persisted as AppData & { projectInsights: Record<string, string | null> }
        }
        return persisted as AppData & { projectInsights: Record<string, string | null> }
      },
    },
  ),
)

