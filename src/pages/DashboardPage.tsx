import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowRight, Ban, Calendar } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  getDueInDays,
  getProjectBlockedTasks,
  getProjectNextDeadline,
  getProjectProgress,
  getProjectTasks,
  isOverdue,
  isProjectActive,
} from '@/domain/stats'
import { useAppStore } from '@/store/useAppStore'

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className="h-2 rounded-full bg-primary transition-[width]"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  )
}

export function DashboardPage() {
  const projects = useAppStore((s) => s.projects)
  const tasks = useAppStore((s) => s.tasks)

  const projectList = Object.values(projects)
    .map((p) => {
      const projectTasks = getProjectTasks(tasks, p.id)
      const active = isProjectActive(p, projectTasks)
      const progress = getProjectProgress(projectTasks)
      const nextDeadline = getProjectNextDeadline(projectTasks)
      const blocked = getProjectBlockedTasks(projectTasks, tasks)
      return { p, active, progress, nextDeadline, blocked }
    })
    .sort((a, b) => (a.p.createdAt < b.p.createdAt ? 1 : -1))

  const activeProjects = projectList.filter((x) => x.active)
  const blockedTasks = projectList.flatMap((x) => x.blocked.map((t) => ({ project: x.p, task: t })))

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">Projects</div>
          <div className="text-sm text-muted-foreground">
            Active work, upcoming deadlines, and blockers.
          </div>
        </div>
        <Button variant="outline" disabled>
          New project
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Active projects</CardTitle>
            <CardDescription>Currently in progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{activeProjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Blocked tasks</CardTitle>
            <CardDescription>Needs dependencies resolved</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{blockedTasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next deadline</CardTitle>
            <CardDescription>Soonest task end date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {projectList
                .map((x) => x.nextDeadline)
                .filter((d): d is string => Boolean(d))
                .sort()[0] ? (
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(projectList.map((x) => x.nextDeadline).filter(Boolean).sort()[0] as string), 'MMM d, yyyy')}
                </span>
              ) : (
                '—'
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">All projects</div>
          <div className="space-y-3">
            {projectList.map(({ p, active, progress, nextDeadline, blocked }) => {
              const dueDays = nextDeadline ? getDueInDays(nextDeadline) : null
              const overdue = nextDeadline ? isOverdue(nextDeadline) : false
              return (
                <Card key={p.id} className="transition-colors hover:bg-accent/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-[15px]">{p.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {p.description}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {!active && <Badge variant="muted">Archived</Badge>}
                        {blocked.length > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="h-3.5 w-3.5" />
                            {blocked.length} blocked
                          </Badge>
                        )}
                        {nextDeadline && (
                          <Badge
                            variant={overdue ? 'destructive' : 'secondary'}
                            className={cn(overdue ? '' : 'text-foreground')}
                          >
                            Due {dueDays === null ? '—' : dueDays === 0 ? 'today' : dueDays > 0 ? `in ${dueDays}d` : `${Math.abs(dueDays)}d ago`}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ProgressBar value={progress} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div>{Math.round(progress * 100)}% complete</div>
                      <Link
                        to={`/projects/${p.id}`}
                        className="inline-flex items-center gap-1 text-foreground hover:underline"
                      >
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Blocked</div>
          <Card>
            <CardHeader>
              <CardTitle>Tasks needing attention</CardTitle>
              <CardDescription>Unresolved dependencies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {blockedTasks.length === 0 ? (
                <div className="text-sm text-muted-foreground">No blockers.</div>
              ) : (
                <div className="space-y-2">
                  {blockedTasks.slice(0, 8).map(({ project, task }) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-4 rounded-lg border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{task.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {project.name}
                        </div>
                      </div>
                      <Link to={`/projects/${project.id}`} className="shrink-0">
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

