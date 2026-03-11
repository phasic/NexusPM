import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfDay,
  subMonths,
} from 'date-fns'
import { ChevronDown, ChevronRight, Folder, FolderPlus, GripVertical, Minus, Plus, SquarePlus, Target } from 'lucide-react'

import type { Bucket, ID, Task, TaskStatus } from '@/domain/types'
import {
  getCustomColorStyle,
  isPresetColor,
  TASK_COLOR_PRESET_STYLES,
} from '@/lib/taskColors'
import { cn } from '@/lib/utils'

type DragState = {
  taskId: ID
  startClientX: number
  startClientY: number
  baseStartDate: string
  baseEndDate: string
  capturedElement: HTMLElement
}

type GanttRow =
  | { type: 'bucket'; bucket: Bucket; taskIds: string[] }
  | { type: 'task'; task: Task }

const CLICK_THRESHOLD_PX = 5
const BUCKET_DROP_PREFIX = '__bucket_'

export function GanttChart({
  projectId,
  uncategorizedOrder,
  tasks,
  taskById,
  buckets,
  bucketById,
  onMoveTaskByDays,
  onTaskClick,
  onUpdateTask,
  onReorderTasksInBucket,
  onSetTaskBucket,
  onReorderBuckets,
  onAddTask,
  onAddBucket,
  onBucketClick,
}: {
  projectId: ID
  uncategorizedOrder?: number
  tasks: Task[]
  taskById: Record<ID, Task>
  buckets: Bucket[]
  bucketById: Record<ID, Bucket>
  onMoveTaskByDays: (taskId: ID, deltaDays: number) => void
  onTaskClick?: (task: Task) => void
  onUpdateTask?: (taskId: ID, patch: Partial<Task>) => void
  onReorderTasksInBucket?: (bucketId: ID, orderedTaskIds: ID[]) => void
  onSetTaskBucket?: (taskId: ID, bucketId: ID | null) => void
  onReorderBuckets?: (projectId: ID, orderedBucketIds: ID[]) => void
  onAddTask?: () => void
  onAddBucket?: () => void
  onBucketClick?: (bucket: Bucket) => void
}) {
  const ZOOM_LEVELS = [12, 16, 24, 32, 48] as const
  const [zoomIndex, setZoomIndex] = useState(2)
  const dayWidth = ZOOM_LEVELS[zoomIndex]
  const rowHeight = 36
  const bucketRowHeight = 32

  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<ID>>(new Set())
  const [reorderMode, setReorderMode] = useState(false)
  useEffect(() => {
    if (!reorderMode) {
      setReorderDrag(null)
      setReorderDragOver(null)
      setBucketReorderDrag(null)
      setBucketReorderDragOver(null)
      reorderThrottleRef.current = null
    }
  }, [reorderMode])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const extendThreshold = 150
  const isExtendingRef = useRef(false)

  const { rows, taskToRowIndex } = useMemo(() => {
    const sortedBuckets = buckets.slice().sort((a, b) => a.order - b.order)
    const uncategorized: Task[] = []
    const byBucket = new Map<ID, Task[]>()
    for (const b of sortedBuckets) {
      byBucket.set(b.id, [])
    }
    for (const t of tasks) {
      if (t.bucketId && bucketById[t.bucketId]) {
        const list = byBucket.get(t.bucketId)
        if (list) list.push(t)
        else uncategorized.push(t)
      } else {
        uncategorized.push(t)
      }
    }
    for (const list of byBucket.values()) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))
    }
    uncategorized.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id))

    const virtualUncategorized: Bucket = {
      id: '__uncategorized__',
      projectId: '',
      name: 'Uncategorized',
      order: uncategorizedOrder ?? sortedBuckets.length,
    }
    const orderedBuckets: Bucket[] = []
    if (sortedBuckets.length === 0) {
      orderedBuckets.push(virtualUncategorized)
    } else {
      const uncatOrder = Math.min(
        Math.max(0, uncategorizedOrder ?? sortedBuckets.length),
        sortedBuckets.length,
      )
      let bi = 0
      for (let i = 0; i <= sortedBuckets.length; i++) {
        if (i === uncatOrder) {
          orderedBuckets.push(virtualUncategorized)
        }
        if (bi < sortedBuckets.length) {
          orderedBuckets.push(sortedBuckets[bi])
          bi++
        }
      }
      if (!orderedBuckets.some((b) => b.id === '__uncategorized__')) {
        orderedBuckets.push(virtualUncategorized)
      }
    }

    const rows: GanttRow[] = []
    const taskToRowIndex = new Map<ID, number>()
    let rowIdx = 0

    for (const b of orderedBuckets) {
      const taskList = b.id === '__uncategorized__' ? uncategorized : (byBucket.get(b.id) ?? [])
      rows.push({ type: 'bucket', bucket: b, taskIds: taskList.map((t) => t.id) })
      rowIdx++
      const collapsed = collapsedBuckets.has(b.id)
      if (!collapsed) {
        for (const t of taskList) {
          rows.push({ type: 'task', task: t })
          taskToRowIndex.set(t.id, rowIdx)
          rowIdx++
        }
      } else {
        for (const t of taskList) {
          taskToRowIndex.set(t.id, rowIdx - 1)
        }
      }
    }

    return { rows, taskToRowIndex }
  }, [tasks, buckets, bucketById, collapsedBuckets, uncategorizedOrder])

  const today = startOfDay(new Date())
  const EXTEND_MONTHS = 6
  const [rangeStart, setRangeStart] = useState(() => subMonths(today, EXTEND_MONTHS))
  const [rangeEnd, setRangeEnd] = useState(() => addMonths(today, EXTEND_MONTHS))

  const { start, days } = useMemo(() => {
    const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart) + 1)
    const d = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i))
    return { start: rangeStart, end: rangeEnd, days: d }
  }, [rangeStart, rangeEnd])

  const [drag, setDrag] = useState<DragState | null>(null)
  const [previewDelta, setPreviewDelta] = useState<Record<ID, number>>({})
  const [reorderDrag, setReorderDrag] = useState<{ taskId: ID; bucketId: ID } | null>(null)
  const [reorderDragOver, setReorderDragOver] = useState<string | null>(null)
  const [bucketReorderDrag, setBucketReorderDrag] = useState<ID | null>(null)
  const [bucketReorderDragOver, setBucketReorderDragOver] = useState<ID | null>(null)
  const reorderThrottleRef = useRef<{ taskId: string; time: number } | null>(null)

  const totalWidth = days.length * dayWidth

  const { yearCells, monthCells } = useMemo(() => {
    const years: { year: number; startIdx: number; endIdx: number }[] = []
    const months: { month: string; year: number; startIdx: number; endIdx: number }[] = []
    let curYear = -1
    let curYearStart = 0
    let curMonth = ''
    let curMonthStart = 0
    days.forEach((d, i) => {
      const y = d.getFullYear()
      const m = format(d, 'yyyy-MM')
      if (y !== curYear) {
        if (curYear >= 0) years.push({ year: curYear, startIdx: curYearStart, endIdx: i - 1 })
        curYear = y
        curYearStart = i
      }
      if (m !== curMonth) {
        if (curMonth) months.push({ month: curMonth, year: curYear, startIdx: curMonthStart, endIdx: i - 1 })
        curMonth = m
        curMonthStart = i
      }
    })
    if (curYear >= 0) years.push({ year: curYear, startIdx: curYearStart, endIdx: days.length - 1 })
    if (curMonth) months.push({ month: curMonth, year: curYear, startIdx: curMonthStart, endIdx: days.length - 1 })
    return { yearCells: years, monthCells: months }
  }, [days])

  const getRowY = (rowIndex: number) => {
    let y = 0
    for (let i = 0; i < rowIndex; i++) {
      const r = rows[i]
      y += r.type === 'bucket' ? bucketRowHeight : rowHeight
    }
    return y
  }

  const getRowCenterY = (rowIndex: number) => {
    const r = rows[rowIndex]
    const h = r.type === 'bucket' ? bucketRowHeight : rowHeight
    return getRowY(rowIndex) + h / 2
  }

  const handlePointerDown = (task: Task, e: ReactPointerEvent) => {
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    setDrag({
      taskId: task.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      baseStartDate: task.startDate,
      baseEndDate: task.endDate,
      capturedElement: el,
    })
  }

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!drag) return
    const deltaPx = e.clientX - drag.startClientX
    const deltaDays = Math.round(deltaPx / dayWidth)
    setPreviewDelta((p) => ({ ...p, [drag.taskId]: deltaDays }))
  }

  const handlePointerUp = (e: ReactPointerEvent) => {
    if (!drag) return
    try {
      drag.capturedElement.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore if element unmounted */
    }
    const deltaPx = Math.abs(e.clientX - drag.startClientX) + Math.abs(e.clientY - drag.startClientY)
    const deltaDays = previewDelta[drag.taskId] ?? 0
    if (deltaPx < CLICK_THRESHOLD_PX && deltaDays === 0) {
      const task = taskById[drag.taskId]
      if (task) onTaskClick?.(task)
    } else if (deltaDays !== 0) {
      onMoveTaskByDays(drag.taskId, deltaDays)
    }
    setPreviewDelta((p) => {
      const { [drag.taskId]: _, ...rest } = p
      return rest
    })
    setDrag(null)
  }

  const handleReorderDragStart = (e: React.DragEvent, taskId: ID, bucketId: ID) => {
    const row = (e.currentTarget as HTMLElement).closest('[data-task-row]') as HTMLElement
    if (row) {
      const clone = row.cloneNode(true) as HTMLElement
      clone.style.width = `${row.offsetWidth}px`
      clone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
      clone.style.borderRadius = '6px'
      clone.style.opacity = '0.96'
      clone.style.background = 'hsl(var(--background))'
      clone.style.pointerEvents = 'none'
      document.body.appendChild(clone)
      clone.style.position = 'absolute'
      clone.style.top = '-9999px'
      const rect = row.getBoundingClientRect()
      e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top)
      requestAnimationFrame(() => clone.remove())
    }
    setReorderDrag({ taskId, bucketId })
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleReorderDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!reorderDrag || reorderDrag.taskId === targetId) return
    const now = Date.now()
    const last = reorderThrottleRef.current
    const throttleMs = 80
    if (!last || last.taskId === targetId || now - last.time >= throttleMs) {
      setReorderDragOver(targetId)
      reorderThrottleRef.current = { taskId: targetId, time: now }
    }
  }

  const handleReorderDrop = (e: React.DragEvent, targetTaskId: string, targetBucketId: ID) => {
    e.preventDefault()
    setReorderDragOver(null)
    if (!reorderDrag) {
      setReorderDrag(null)
      return
    }
    const draggedTaskId = reorderDrag.taskId
    const isDropOnEmptyBucket = targetTaskId.startsWith(BUCKET_DROP_PREFIX)
    if (isDropOnEmptyBucket) {
      const newBucketId = targetBucketId === '__uncategorized__' ? null : targetBucketId
      onSetTaskBucket?.(draggedTaskId, newBucketId)
      onReorderTasksInBucket?.(targetBucketId, [draggedTaskId])
      setReorderDrag(null)
      return
    }
    if (reorderDrag.taskId === targetTaskId) {
      setReorderDrag(null)
      return
    }
    const targetBucketTaskIds = rows
      .filter((r): r is { type: 'task'; task: Task } => {
        if (r.type !== 'task') return false
        if (targetBucketId === '__uncategorized__') return !r.task.bucketId
        return r.task.bucketId === targetBucketId
      })
      .map((r) => r.task.id)
    const targetIdx = targetBucketTaskIds.indexOf(targetTaskId)
    if (targetIdx === -1) {
      setReorderDrag(null)
      return
    }
    const isSameBucket = reorderDrag.bucketId === targetBucketId
    if (isSameBucket) {
      const draggedIdx = targetBucketTaskIds.indexOf(draggedTaskId)
      if (draggedIdx === -1) {
        setReorderDrag(null)
        return
      }
      const reordered = [...targetBucketTaskIds]
      reordered.splice(draggedIdx, 1)
      reordered.splice(targetIdx, 0, draggedTaskId)
      onReorderTasksInBucket?.(targetBucketId, reordered)
    } else {
      const newBucketId = targetBucketId === '__uncategorized__' ? null : targetBucketId
      onSetTaskBucket?.(draggedTaskId, newBucketId)
      const reordered = [
        ...targetBucketTaskIds.slice(0, targetIdx),
        draggedTaskId,
        ...targetBucketTaskIds.slice(targetIdx),
      ]
      onReorderTasksInBucket?.(targetBucketId, reordered)
    }
    setReorderDrag(null)
  }

  const handleReorderDragEnd = () => {
    setReorderDrag(null)
    setReorderDragOver(null)
    reorderThrottleRef.current = null
  }

  const orderedBucketIds = useMemo(() => {
    const sorted = buckets.filter((b) => b.projectId === projectId).sort((a, b) => a.order - b.order)
    const uncatOrder = uncategorizedOrder ?? sorted.length
    const ids: ID[] = []
    let bi = 0
    for (let i = 0; i <= sorted.length; i++) {
      if (i === uncatOrder) ids.push('__uncategorized__')
      if (bi < sorted.length) ids.push(sorted[bi++].id)
    }
    return ids
  }, [buckets, projectId, uncategorizedOrder])

  const handleBucketReorderDragStart = (e: React.DragEvent, bucketId: ID) => {
    const row = (e.currentTarget as HTMLElement).closest('[data-bucket-row]') as HTMLElement
    if (row) {
      const clone = row.cloneNode(true) as HTMLElement
      clone.style.width = `${row.offsetWidth}px`
      clone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
      clone.style.borderRadius = '6px'
      clone.style.opacity = '0.96'
      clone.style.background = 'hsl(var(--muted))'
      clone.style.pointerEvents = 'none'
      document.body.appendChild(clone)
      clone.style.position = 'absolute'
      clone.style.top = '-9999px'
      const rect = row.getBoundingClientRect()
      e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top)
      requestAnimationFrame(() => clone.remove())
    }
    setBucketReorderDrag(bucketId)
    e.dataTransfer.setData('text/plain', bucketId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleBucketReorderDragOver = (e: React.DragEvent, targetBucketId: ID) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!bucketReorderDrag || bucketReorderDrag === targetBucketId) return
    setBucketReorderDragOver(targetBucketId)
  }

  const handleBucketReorderDrop = (e: React.DragEvent, targetBucketId: ID) => {
    e.preventDefault()
    setBucketReorderDragOver(null)
    if (!bucketReorderDrag || bucketReorderDrag === targetBucketId || !onReorderBuckets) {
      setBucketReorderDrag(null)
      return
    }
    const draggedIdx = orderedBucketIds.indexOf(bucketReorderDrag)
    const targetIdx = orderedBucketIds.indexOf(targetBucketId)
    if (draggedIdx === -1 || targetIdx === -1) {
      setBucketReorderDrag(null)
      return
    }
    const reordered = [...orderedBucketIds]
    reordered.splice(draggedIdx, 1)
    reordered.splice(targetIdx, 0, bucketReorderDrag)
    onReorderBuckets(projectId, reordered)
    setBucketReorderDrag(null)
  }

  const handleBucketReorderDragEnd = () => {
    setBucketReorderDrag(null)
    setBucketReorderDragOver(null)
  }

  const toggleBucket = (bucketId: ID) => {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev)
      if (next.has(bucketId)) next.delete(bucketId)
      else next.add(bucketId)
      return next
    })
  }

  const getTaskDates = (t: Task) => {
    const delta = previewDelta[t.id] ?? 0
    if (delta === 0) return { startDate: t.startDate, endDate: t.endDate }
    const s = addDays(parseISO(t.startDate), delta)
    const e = addDays(parseISO(t.endDate), delta)
    return { startDate: s.toISOString().slice(0, 10), endDate: e.toISOString().slice(0, 10) }
  }

  const arrows = useMemo(() => {
    return tasks.flatMap((t) =>
      t.dependsOn
        .map((depId) => taskById[depId])
        .filter(Boolean)
        .map((dep) => {
          const depRow = taskToRowIndex.get(dep.id)
          const tRow = taskToRowIndex.get(t.id)
          if (depRow == null || tRow == null) return null
          const depDates = getTaskDates(dep)
          const tDates = getTaskDates(t)
          const depX2 =
            differenceInCalendarDays(parseISO(depDates.endDate), start) * dayWidth + dayWidth
          const depY = getRowCenterY(depRow)
          const tX1 = differenceInCalendarDays(parseISO(tDates.startDate), start) * dayWidth
          const tY = getRowCenterY(tRow)
          const midX = Math.max(depX2 + 16, (depX2 + tX1) / 2)
          const path = `M ${depX2} ${depY} C ${midX} ${depY}, ${midX} ${tY}, ${tX1} ${tY}`
          return { key: `${dep.id}->${t.id}`, path }
        })
        .filter((x): x is { key: string; path: string } => Boolean(x)),
    )
  }, [tasks, start, taskById, previewDelta, taskToRowIndex, rows])

  const totalChartHeight = rows.reduce(
    (acc, r) => acc + (r.type === 'bucket' ? bucketRowHeight : rowHeight),
    0,
  )

  const centerOnToday = () => {
    const el = scrollRef.current
    if (!el) return
    const daysFromStart = differenceInCalendarDays(today, start)
    const todayDayIndex = Math.max(0, Math.min(daysFromStart, days.length - 1))
    const todayCenterX = 260 + todayDayIndex * dayWidth + dayWidth / 2
    el.scrollLeft = Math.max(
      0,
      Math.min(todayCenterX - el.clientWidth / 2, 260 + totalWidth - el.clientWidth),
    )
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el || isExtendingRef.current) return
    const { scrollLeft, clientWidth, scrollWidth } = el
    if (scrollLeft < extendThreshold) {
      isExtendingRef.current = true
      const prevStart = rangeStart
      const newStart = subMonths(prevStart, EXTEND_MONTHS)
      const addedDays = differenceInCalendarDays(prevStart, newStart)
      setRangeStart(newStart)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollLeft + addedDays * dayWidth
          }
          isExtendingRef.current = false
        })
      })
    } else if (scrollLeft + clientWidth > scrollWidth - extendThreshold) {
      isExtendingRef.current = true
      setRangeEnd((prev) => addMonths(prev, EXTEND_MONTHS))
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isExtendingRef.current = false
        })
      })
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-background px-2 py-1.5">
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReorderMode((v) => !v)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded border px-2 text-xs hover:bg-muted',
              reorderMode
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title={reorderMode ? 'Disable reordering' : 'Enable reordering'}
          >
            <GripVertical className="h-3.5 w-3.5" />
            Reorder
          </button>
          <button
            type="button"
            onClick={onAddTask}
            className="flex h-7 items-center gap-1.5 rounded border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Add task"
          >
            <SquarePlus className="h-3.5 w-3.5" />
            Add task
          </button>
          <button
            type="button"
            onClick={onAddBucket}
            className="flex h-7 items-center gap-1.5 rounded border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Add bucket"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Add bucket
          </button>
          </div>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
            className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={centerOnToday}
            className="flex h-7 items-center gap-1.5 rounded border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Center on today"
          >
            <Target className="h-3.5 w-3.5" />
            Today
          </button>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="relative flex-1 overflow-auto border-b bg-background"
          onScroll={handleScroll}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="flex flex-col" style={{ minWidth: 260 + totalWidth }}>
            <div className="sticky top-0 z-30 flex shrink-0 bg-background">
              <div className="sticky left-0 z-20 flex w-[260px] shrink-0 items-center border-r bg-background px-4 text-xs font-medium text-muted-foreground">
                Tasks
              </div>
              <div className="flex min-w-0 flex-1 flex-col shrink-0" style={{ width: totalWidth }}>
                <div className="flex shrink-0" style={{ width: totalWidth }}>
                  {yearCells.map(({ year, startIdx, endIdx }) => (
                <div
                  key={year}
                  className="flex h-7 items-center justify-center border-r px-2 text-[10px] font-medium text-muted-foreground"
                  style={{
                    width: (endIdx - startIdx + 1) * dayWidth,
                    minWidth: (endIdx - startIdx + 1) * dayWidth,
                  }}
                >
                  {year}
                </div>
                  ))}
                </div>
                <div className="flex shrink-0" style={{ width: totalWidth }}>
                  {monthCells.map(({ month, startIdx, endIdx }) => (
                <div
                  key={month}
                  className="flex h-7 items-center justify-center border-r px-2 text-[10px] text-muted-foreground"
                  style={{
                    width: (endIdx - startIdx + 1) * dayWidth,
                    minWidth: (endIdx - startIdx + 1) * dayWidth,
                  }}
                  title={format(parseISO(`${month}-01`), 'MMMM yyyy')}
                >
                  {format(parseISO(`${month}-01`), 'MMM')}
                </div>
                  ))}
                </div>
                <div className="flex h-10 shrink-0 items-end" style={{ width: totalWidth }}>
                  {days.map((d) => {
                const label = format(d, 'd')
                const isMonday = format(d, 'i') === '1'
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      'flex h-10 shrink-0 items-end justify-center border-r pb-1 text-[10px] text-muted-foreground',
                      isMonday && 'text-foreground',
                    )}
                    style={{ width: dayWidth, minWidth: dayWidth }}
                    title={format(d, 'MMM d, yyyy')}
                  >
                    {label}
                  </div>
                )
                  })}
                </div>
              </div>
            </div>

            {/* Body - task list sticky left */}
            <div className="flex shrink-0">
            <div
              className="sticky left-0 z-10 w-[260px] shrink-0 border-r bg-background"
              onDragLeave={(e) => {
                const related = e.relatedTarget as Node | null
                if (!related || !e.currentTarget.contains(related)) {
                  setReorderDragOver(null)
                }
              }}
            >
              {rows.map((row) => {
                if (row.type === 'bucket') {
                  const collapsed = collapsedBuckets.has(row.bucket.id)
                  const isEmpty = row.taskIds.length === 0
                  const isReorderableBucket = true
                  const bucketDropId = `${BUCKET_DROP_PREFIX}${row.bucket.id}`
                  const isTaskDropTarget = isEmpty && reorderDragOver === bucketDropId
                  const isBucketDropTarget = isReorderableBucket && bucketReorderDragOver === row.bucket.id
                  return (
                    <div
                      key={row.bucket.id}
                      data-bucket-row
                      role={onBucketClick ? 'button' : undefined}
                      tabIndex={onBucketClick ? 0 : undefined}
                      className={cn(
                        'flex h-8 items-center gap-2 border-b bg-muted/30 px-3 text-sm font-medium',
                        reorderMode && (isTaskDropTarget || isBucketDropTarget) && 'bg-primary/10 ring-1 ring-primary/30',
                        onBucketClick && 'cursor-pointer hover:bg-muted/50',
                      )}
                      onClick={(e) => {
                        if (!reorderMode && onBucketClick && !(e.target as HTMLElement).closest('button')) {
                          onBucketClick(row.bucket)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (onBucketClick && (e.key === 'Enter' || e.key === ' ') && !reorderMode) {
                          e.preventDefault()
                          onBucketClick(row.bucket)
                        }
                      }}
                      {...(reorderMode && {
                        onDragOver: (e: React.DragEvent) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          if (bucketReorderDrag && isReorderableBucket) {
                            handleBucketReorderDragOver(e, row.bucket.id)
                          } else if (reorderDrag && isEmpty) {
                            handleReorderDragOver(e, bucketDropId)
                          }
                        },
                        onDrop: (e: React.DragEvent) => {
                          e.preventDefault()
                          if (bucketReorderDrag && isReorderableBucket) {
                            handleBucketReorderDrop(e, row.bucket.id)
                          } else if (reorderDrag && isEmpty) {
                            handleReorderDrop(e, bucketDropId, row.bucket.id)
                          }
                        },
                      })}
                    >
                      {reorderMode && isReorderableBucket && (
                        <div
                          className="flex shrink-0 cursor-grab items-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
                          draggable
                          onDragStart={(e) => handleBucketReorderDragStart(e, row.bucket.id)}
                          onDragEnd={handleBucketReorderDragEnd}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleBucket(row.bucket.id)}
                        className="flex shrink-0 items-center justify-center rounded p-0.5 hover:bg-muted"
                        aria-label={collapsed ? 'Expand' : 'Collapse'}
                      >
                        {collapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{row.bucket.name}</span>
                      <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground">
                        {row.taskIds.length}
                      </span>
                    </div>
                  )
                }
                const taskBucketId = row.task.bucketId ?? '__uncategorized__'
                const isDropTarget = reorderDragOver === row.task.id
                const isDragging = reorderDrag?.taskId === row.task.id
                return (
                  <div
                    key={row.task.id}
                    className="transition-[min-height] duration-150 ease-out"
                    {...(reorderMode && !bucketReorderDrag && {
                      onDragOver: (e: React.DragEvent) => handleReorderDragOver(e, row.task.id),
                      onDrop: (e: React.DragEvent) => handleReorderDrop(e, row.task.id, taskBucketId),
                    })}
                  >
                    {reorderMode && isDropTarget && (
                      <div
                        className="border-b border-dashed border-primary/40 bg-primary/5"
                        style={{ height: 36 }}
                      />
                    )}
                    <div
                      data-task-row
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'flex h-9 cursor-pointer items-center gap-2 border-b px-4 text-sm hover:bg-muted/50',
                        reorderMode ? 'pl-6' : 'pl-3',
                        isDropTarget && 'bg-muted/30',
                        isDragging && 'opacity-40',
                      )}
                      onClick={() => onTaskClick?.(row.task)}
                      onKeyDown={(e) => e.key === 'Enter' && onTaskClick?.(row.task)}
                    >
                    {reorderMode && (
                      <div
                        className="flex shrink-0 cursor-grab items-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => handleReorderDragStart(e, row.task.id, taskBucketId)}
                        onDragEnd={handleReorderDragEnd}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 truncate">{row.task.title}</div>
                    {onUpdateTask && (
                      <select
                        value={row.task.status}
                        onChange={(e) => {
                          e.stopPropagation()
                          onUpdateTask(row.task.id, { status: e.target.value as TaskStatus })
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-6 shrink-0 rounded border border-input bg-background px-2 text-xs"
                        aria-label={`Status for ${row.task.title}`}
                      >
                        <option value="open">Open</option>
                        <option value="started">Started</option>
                        <option value="closed">Closed</option>
                        <option value="overdue">Overdue</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="relative shrink-0" style={{ width: totalWidth, minHeight: totalChartHeight }}>
              {today >= start && today <= days[days.length - 1] && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary/80 pointer-events-none z-10"
                  style={{
                    left: differenceInCalendarDays(today, start) * dayWidth + dayWidth / 2 - 1,
                  }}
                  title={format(today, 'MMM d, yyyy')}
                />
              )}
              <svg
                className="pointer-events-none absolute left-0 top-0"
                width={totalWidth}
                height={totalChartHeight}
              >
                <defs>
                  <marker
                    id="arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" fill="hsl(var(--muted-foreground))" />
                  </marker>
                </defs>
                {arrows.map((a) => (
                  <path
                    key={a.key}
                    d={a.path}
                    fill="none"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth="1.25"
                    markerEnd="url(#arrow)"
                    opacity="0.55"
                  />
                ))}
              </svg>

              {rows.map((row, rowIdx) => {
                if (row.type === 'bucket') {
                  const taskIds = row.taskIds
                  const y = getRowY(rowIdx)
                  const bucketTasks = taskIds
                    .map((id) => taskById[id])
                    .filter(Boolean) as Task[]
                  if (bucketTasks.length === 0) return null
                  const minStart = minDate(bucketTasks.map((t) => parseISO(getTaskDates(t).startDate)))
                  const maxEnd = maxDate(bucketTasks.map((t) => parseISO(getTaskDates(t).endDate)))
                  const barX = differenceInCalendarDays(minStart, start) * dayWidth
                  const barW =
                    (differenceInCalendarDays(maxEnd, minStart) + 1) * dayWidth
                  const h = bucketRowHeight
                  return (
                    <div
                      key={row.bucket.id}
                      className="absolute left-0 right-0 border-b"
                      style={{ top: y, height: h }}
                    >
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded border border-dashed border-muted-foreground/40 bg-muted/20"
                        style={{
                          left: barX,
                          width: Math.max(dayWidth, barW),
                          height: h - 8,
                        }}
                      />
                    </div>
                  )
                }

                const t = row.task
                const dates = getTaskDates(t)
                const offset = differenceInCalendarDays(parseISO(dates.startDate), start)
                const duration =
                  differenceInCalendarDays(parseISO(dates.endDate), parseISO(dates.startDate)) + 1
                const x = offset * dayWidth
                const w = Math.max(dayWidth, duration * dayWidth)
                const done = t.status === 'closed'
                const overdue = t.status === 'overdue'
                const blockedStatus = t.status === 'blocked'
                const y = getRowY(rowIdx)
                const presetStyles =
                  t.color && isPresetColor(t.color)
                    ? TASK_COLOR_PRESET_STYLES[t.color]
                    : null
                const customStyle =
                  t.color && !isPresetColor(t.color) && /^#[0-9A-Fa-f]{6}$/.test(t.color)
                    ? getCustomColorStyle(t.color)
                    : null

                return (
                  <div
                    key={t.id}
                    className="absolute left-0 right-0 border-b"
                    style={{ top: y, height: rowHeight }}
                  >
                    {days.map((d) => (
                      <div
                        key={d.toISOString()}
                        className="absolute top-0 h-full border-r"
                        style={{
                          left: differenceInCalendarDays(d, start) * dayWidth,
                          width: dayWidth,
                        }}
                      />
                    ))}

                    <div
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-md border px-2 py-1 text-xs font-medium select-none',
                        done
                          ? 'bg-muted text-muted-foreground'
                          : overdue
                            ? 'bg-amber-500/20 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200 border-amber-500/40'
                            : blockedStatus
                              ? 'bg-muted/80 text-muted-foreground border-muted-foreground/30'
                              : presetStyles
                                ? `${presetStyles.bg} ${presetStyles.border} ${presetStyles.text}`
                                : customStyle
                                  ? ''
                                  : 'bg-primary/10 text-foreground border-primary/20',
                      )}
                      style={{
                        left: x,
                        width: w,
                        ...(customStyle ?? {}),
                      }}
                      onPointerDown={(e) => handlePointerDown(t, e)}
                      onPointerUp={handlePointerUp}
                      role="button"
                      tabIndex={0}
                      title={`${t.title}\n${dates.startDate} → ${dates.endDate}`}
                    >
                      <div className="min-w-0 flex-1 truncate">
                        {t.title}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
