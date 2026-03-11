export type ID = string

export type ISODate = string
export type ISODateTime = string

export type TaskStatus = 'open' | 'started' | 'closed' | 'overdue' | 'blocked'

export type Project = {
  id: ID
  name: string
  description: string
  createdAt: ISODateTime
  /** Display order of Uncategorized in the bucket list (0 = first). Defaults to last. */
  uncategorizedOrder?: number
}

export type Bucket = {
  id: ID
  projectId: ID
  name: string
  order: number
  description?: string
  owner?: string
}

export type TaskColorPreset = 'green' | 'orange' | 'red'

/** Preset key or hex string for custom colors */
export type TaskColor = TaskColorPreset | string

export type Task = {
  id: ID
  projectId: ID
  title: string
  startDate: ISODate
  endDate: ISODate
  status: TaskStatus
  dependsOn: ID[]
  bucketId?: ID
  color?: TaskColor
  /** Display order within bucket (lower = first). */
  order?: number
  /** Reason when status is overdue or blocked. */
  statusReason?: string
  description?: string
  owner?: string
}

export type MeetingNote = {
  id: ID
  projectId: ID
  content: string
  createdAt: ISODateTime
  linkedTaskIds: ID[]
}

export type AppData = {
  projects: Record<ID, Project>
  buckets: Record<ID, Bucket>
  tasks: Record<ID, Task>
  meetingNotes: Record<ID, MeetingNote>
}

