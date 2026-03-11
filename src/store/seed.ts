import { addDays, formatISO } from 'date-fns'
import { nanoid } from 'nanoid'

import type { AppData, Bucket, MeetingNote, Notebook, Project, Task } from '@/domain/types'

const isoDate = (d: Date) => formatISO(d, { representation: 'date' })
const isoDateTime = (d: Date) => formatISO(d)

export function createSeedData(now = new Date()): AppData {
  const projectId = nanoid()
  const p: Project = {
    id: projectId,
    name: 'NexusPM v1',
    description: 'First cut: dashboard, timeline, notes, and JSON export/import.',
    createdAt: isoDateTime(now),
  }

  const bucket1: Bucket = {
    id: nanoid(),
    projectId,
    name: 'Foundation',
    order: 0,
  }
  const bucket2: Bucket = {
    id: nanoid(),
    projectId,
    name: 'Features',
    order: 1,
  }

  const t1: Task = {
    id: nanoid(),
    projectId,
    title: 'Dashboard + store scaffold',
    startDate: isoDate(addDays(now, -2)),
    endDate: isoDate(addDays(now, 2)),
    status: 'started',
    dependsOn: [],
    bucketId: bucket1.id,
    order: 0,
  }

  const t2: Task = {
    id: nanoid(),
    projectId,
    title: 'Timeline / Gantt with drag',
    startDate: isoDate(addDays(now, 1)),
    endDate: isoDate(addDays(now, 6)),
    status: 'open',
    dependsOn: [t1.id],
    bucketId: bucket2.id,
    order: 0,
  }

  const t3: Task = {
    id: nanoid(),
    projectId,
    title: 'Meeting notes linked to tasks',
    startDate: isoDate(addDays(now, 4)),
    endDate: isoDate(addDays(now, 8)),
    status: 'open',
    dependsOn: [t2.id],
    bucketId: bucket2.id,
    order: 1,
  }

  const notebook1: Notebook = {
    id: nanoid(),
    projectId,
    name: 'Meeting notes',
    order: 0,
  }

  const n1: MeetingNote = {
    id: nanoid(),
    projectId,
    notebookId: notebook1.id,
    title: 'Kickoff',
    content:
      'Kickoff: keep UI minimal (Linear-ish). Prioritize serializable store + a simple, reliable custom Gantt.',
    createdAt: isoDateTime(addDays(now, -1)),
    updatedAt: isoDateTime(addDays(now, -1)),
    linkedTaskIds: [t1.id],
    linkedBucketIds: [],
  }

  return {
    projects: { [p.id]: p },
    buckets: { [bucket1.id]: bucket1, [bucket2.id]: bucket2 },
    tasks: { [t1.id]: t1, [t2.id]: t2, [t3.id]: t3 },
    notebooks: { [notebook1.id]: notebook1 },
    meetingNotes: { [n1.id]: n1 },
  }
}

