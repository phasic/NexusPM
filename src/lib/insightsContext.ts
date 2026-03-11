import { parseISO } from 'date-fns'

import type { Bucket, MeetingNote, Project, Task } from '@/domain/types'

export type ProjectContext = {
  project: Project
  tasks: Task[]
  buckets: Bucket[]
  notes: MeetingNote[]
  taskById: Record<string, Task>
  bucketById: Record<string, Bucket>
}

/**
 * Build a text summary of the project for AI analysis.
 */
export function buildProjectContextText(ctx: ProjectContext): string {
  const lines: string[] = []

  lines.push(`# Project: ${ctx.project.name}`)
  if (ctx.project.description) {
    lines.push(ctx.project.description)
  }
  lines.push('')

  lines.push('## Tasks')
  if (ctx.tasks.length === 0) {
    lines.push('(No tasks)')
  } else {
    for (const t of ctx.tasks) {
      const bucket = t.bucketId ? ctx.bucketById[t.bucketId] : null
      const bucketName = bucket ? bucket.name : 'Uncategorized'
      const deps = t.dependsOn.length > 0
        ? t.dependsOn
            .map((id) => ctx.taskById[id]?.title ?? id)
            .join(', ')
        : 'none'
      lines.push(`- **${t.title}** (${t.status})`)
      if (t.statusReason && (t.status === 'overdue' || t.status === 'blocked')) {
        lines.push(`  - Reason: ${t.statusReason}`)
      }
      lines.push(`  - Dates: ${t.startDate} → ${t.endDate}`)
      lines.push(`  - Bucket: ${bucketName}`)
      lines.push(`  - Depends on: ${deps}`)
    }
  }
  lines.push('')

  const overdueTasks = ctx.tasks.filter((t) => t.status === 'overdue')
  const blockedTasks = ctx.tasks.filter((t) => t.status === 'blocked')
  if (overdueTasks.length > 0 || blockedTasks.length > 0) {
    lines.push('## Pre-flagged status')
    if (overdueTasks.length > 0) {
      lines.push('### Overdue')
      overdueTasks.forEach((t) => {
        lines.push(`- **${t.title}**: ${t.statusReason || '(no reason given)'}`)
      })
    }
    if (blockedTasks.length > 0) {
      lines.push('### Blocked')
      blockedTasks.forEach((t) => {
        lines.push(`- **${t.title}**: ${t.statusReason || '(no reason given)'}`)
      })
    }
    lines.push('')
  }

  lines.push('## Dependencies')
  const depsList: string[] = []
  const depRisks: string[] = []
  for (const t of ctx.tasks) {
    for (const depId of t.dependsOn) {
      const dep = ctx.taskById[depId]
      if (dep) {
        depsList.push(`${t.title} → ${dep.title}`)
        const depEnd = parseISO(dep.endDate)
        const taskStart = parseISO(t.startDate)
        if (depEnd > taskStart) {
          depRisks.push(
            `RISK: "${t.title}" starts ${t.startDate} but depends on "${dep.title}" which ends ${dep.endDate}`,
          )
        }
      }
    }
  }
  if (depsList.length === 0) {
    lines.push('(None)')
  } else {
    depsList.forEach((d) => lines.push(`- ${d}`))
  }
  if (depRisks.length > 0) {
    lines.push('')
    lines.push('### Pre-flagged dependency risks')
    depRisks.forEach((r) => lines.push(`- ${r}`))
  }
  lines.push('')

  lines.push('## Meeting notes')
  if (ctx.notes.length === 0) {
    lines.push('(No notes)')
  } else {
    for (const n of ctx.notes) {
      const linked = n.linkedTaskIds
        .map((id) => ctx.taskById[id]?.title ?? id)
        .join(', ')
      const dateStr = new Date(n.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      lines.push(`### ${dateStr}`)
      lines.push(n.content)
      if (linked) lines.push(`Linked tasks: ${linked}`)
      lines.push('')
    }
  }
  lines.push('')
  lines.push('LINK FORMAT (required for clickable links):')
  lines.push('- Tasks: wrap the exact task title in square brackets, e.g. [Design system] or [test]')
  lines.push('- Notes: wrap the note date in curly braces, e.g. {Jan 15, 2024}')
  lines.push('Only use these formats when you want the reader to click through to that task or note.')

  return lines.join('\n')
}
