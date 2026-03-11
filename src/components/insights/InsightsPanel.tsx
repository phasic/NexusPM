import { useEffect, useMemo, useState } from 'react'

import {
  AlertTriangle,
  ArrowRight,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  ClipboardList,
  Eye,
  Link2,
  Loader2,
  Route,
  Settings2,
  TrendingUp,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  chatCompletion,
  getModelConfig,
  setModelConfig,
  testConnection,
  type AIModelConfig,
} from '@/lib/aiClient'
import type { Task } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { buildProjectContextText, type ProjectContext } from '@/lib/insightsContext'
import { formatInlineMarkdown, linkifyInsightText } from '@/lib/linkifyInsights'

const SYSTEM_PROMPT = `You are a project management analyst. Analyze the project data and provide concise, actionable insights.

Task statuses (use these when analyzing): open, started, closed, overdue, blocked. Pay special attention to tasks marked overdue or blocked – use their statusReason when provided. Closed tasks are done.

Use exactly these section headers (omit sections with nothing to report):
- ## Risks – foundational risks: tasks marked overdue or blocked (cite their reasons), schedule pressure
- ## Blind Spots – things that might be missed (missing dependencies, gaps in timeline)
- ## Dependency Health – IT-specific: dependency chains, bottlenecks, coupling
- ## Critical Path – structural view: longest chain, key milestones
- ## Open Points – unresolved blockers, decisions needed
- ## Decision Log Gaps – decisions from meeting notes that lack follow-up or documentation
- ## Timeline Confidence – how reliable the schedule is, buffer, slack
- ## Next Steps – recommended priorities and action items (consider open/started tasks)

When relevant, group items by bucket. Use bullet points (- ) for each item.
For clickable links: use [exact task title] for tasks and {Month DD, YYYY} for notes (e.g. [Design system], {Jan 15, 2024}). Be concise.`

export function InsightsPanel({
  projectId,
  context,
  onTaskClick,
  onNoteClick,
}: {
  projectId: string
  context: ProjectContext
  onTaskClick?: (task: Task) => void
  onNoteClick?: (noteId: string) => void
}) {
  const projectInsights = useAppStore((s) => s.projectInsights)
  const projectInsightsGeneratedAt = useAppStore((s) => s.projectInsightsGeneratedAt)
  const setProjectInsights = useAppStore((s) => s.setProjectInsights)
  const insights = projectId ? (projectInsights[projectId] ?? null) : null
  const generatedAt = projectId ? (projectInsightsGeneratedAt[projectId] ?? null) : null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [config, setConfig] = useState<AIModelConfig>(getModelConfig)
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    if (insights) setExpandedSections(new Set())
  }, [insights])

  const handleAnalyze = async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    setProjectInsights(projectId, null)
    try {
      const text = buildProjectContextText(context)
      const userPrompt = `Analyze this project:\n\n${text}`
      const response = await chatCompletion([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ])
      setProjectInsights(projectId, response)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = () => {
    setModelConfig(config)
    setSettingsOpen(false)
  }

  const handleTestConnection = async () => {
    setTestStatus('Testing…')
    const result = await testConnection(config)
    setTestStatus(result.ok ? `✓ ${result.message}` : `✗ ${result.message}`)
  }

  const cleanSectionTitle = (raw: string) =>
    raw
      .replace(/\*+(.+?)\*+/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/:+$/, '')
      .trim()

  type SectionVariant =
    | 'risk'
    | 'blind'
    | 'dependency'
    | 'critical'
    | 'open'
    | 'decision'
    | 'timeline'
    | 'next'
    | 'default'

  const insightSections = useMemo(() => {
    if (!insights) return []
    const sections: { title: string; explanation: string | null; icon: React.ReactNode; variant: SectionVariant; content: string }[] = []
    const sectionConfig: Record<string, { icon: React.ReactNode; variant: SectionVariant }> = {
      risks: { icon: <AlertTriangle className="h-4 w-4" />, variant: 'risk' },
      'blind spots': { icon: <Eye className="h-4 w-4" />, variant: 'blind' },
      'dependency health': { icon: <Link2 className="h-4 w-4" />, variant: 'dependency' },
      'critical path': { icon: <Route className="h-4 w-4" />, variant: 'critical' },
      'open points': { icon: <CircleHelp className="h-4 w-4" />, variant: 'open' },
      'decision log gaps': { icon: <ClipboardList className="h-4 w-4" />, variant: 'decision' },
      'timeline confidence': { icon: <TrendingUp className="h-4 w-4" />, variant: 'timeline' },
      'next steps': { icon: <ArrowRight className="h-4 w-4" />, variant: 'next' },
    }
    const blocks = insights.split(/(?=^##\s)/m).filter(Boolean)
    for (const block of blocks) {
      const match = block.match(/^##\s+(.+?)(?:\n|$)/)
      const rawTitle = match ? match[1].trim() : 'Insights'
      const fullTitle = cleanSectionTitle(rawTitle)
      const dashMatch = fullTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/)
      const title = dashMatch ? dashMatch[1].trim() : fullTitle
      const explanation = dashMatch ? dashMatch[2].trim() : null
      const content = match ? block.slice(match[0].length).trim() : block.trim()
      const key = title.toLowerCase()
      const config = sectionConfig[key] ?? { icon: <Brain className="h-4 w-4" />, variant: 'default' as const }
      sections.push({ title, explanation, icon: config.icon, variant: config.variant, content })
    }
    return sections
  }, [insights])

  const renderTextWithLinks = (raw: string) => {
    const cleaned = raw.replace(/^[-*]\s*/, '')
    if (!onTaskClick && !onNoteClick) return <>{formatInlineMarkdown(cleaned)}</>
    return linkifyInsightText(
      cleaned,
      context.tasks,
      context.notes,
      onTaskClick ?? (() => {}),
      onNoteClick ?? (() => {}),
    )
  }

  const renderSectionContent = (content: string) => {
    const lines = content.split('\n')
    const items: React.ReactNode[] = []
    let currentGroup: string | null = null
    let groupItems: string[] = []
    let key = 0

    const flushGroup = () => {
      if (currentGroup && groupItems.length > 0) {
        items.push(
          <div key={key++} className="mt-2 first:mt-0">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
              {currentGroup}
            </div>
            <ul className="mt-1 space-y-1 border-l-2 border-muted-foreground/20 pl-3">
              {groupItems.map((item, i) => (
                <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {renderTextWithLinks(item)}
                </li>
              ))}
            </ul>
          </div>,
        )
        groupItems = []
      }
      currentGroup = null
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith('### ')) {
        flushGroup()
        currentGroup = cleanSectionTitle(trimmed.replace(/^###\s*/, ''))
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const item = trimmed.replace(/^[-*]\s*/, '').trim()
        if (currentGroup) {
          groupItems.push(item)
        } else {
          flushGroup()
          items.push(
            <div key={key++} className="flex gap-2.5 text-sm leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="text-muted-foreground">{renderTextWithLinks(item)}</span>
            </div>
          )
        }
      } else if (trimmed) {
        flushGroup()
        items.push(
          <p key={key++} className="text-sm leading-relaxed text-muted-foreground">
            {renderTextWithLinks(trimmed)}
          </p>
        )
      }
    }
    flushGroup()
    return <div className="space-y-2">{items}</div>
  }

  const sectionStyles: Record<SectionVariant, string> = {
    risk: 'border border-amber-500/25 border-l-4 border-l-amber-500 bg-amber-500/10 dark:border-amber-400/30 dark:border-l-amber-400 dark:bg-amber-500/15',
    blind: 'border border-violet-500/25 border-l-4 border-l-violet-500 bg-violet-500/10 dark:border-violet-400/30 dark:border-l-violet-400 dark:bg-violet-500/15',
    dependency: 'border border-sky-500/25 border-l-4 border-l-sky-500 bg-sky-500/10 dark:border-sky-400/30 dark:border-l-sky-400 dark:bg-sky-500/15',
    critical: 'border border-orange-500/25 border-l-4 border-l-orange-500 bg-orange-500/10 dark:border-orange-400/30 dark:border-l-orange-400 dark:bg-orange-500/15',
    open: 'border border-blue-500/25 border-l-4 border-l-blue-500 bg-blue-500/10 dark:border-blue-400/30 dark:border-l-blue-400 dark:bg-blue-500/15',
    decision: 'border border-purple-500/25 border-l-4 border-l-purple-500 bg-purple-500/10 dark:border-purple-400/30 dark:border-l-purple-400 dark:bg-purple-500/15',
    timeline: 'border border-teal-500/25 border-l-4 border-l-teal-500 bg-teal-500/10 dark:border-teal-400/30 dark:border-l-teal-400 dark:bg-teal-500/15',
    next: 'border border-emerald-500/25 border-l-4 border-l-emerald-500 bg-emerald-500/10 dark:border-emerald-400/30 dark:border-l-emerald-400 dark:bg-emerald-500/15',
    default: 'border border-border border-l-4 border-l-muted-foreground/50 bg-muted/30',
  }

  const iconStyles: Record<SectionVariant, string> = {
    risk: 'bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300',
    blind: 'bg-violet-500/20 text-violet-700 dark:bg-violet-500/25 dark:text-violet-300',
    dependency: 'bg-sky-500/20 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300',
    critical: 'bg-orange-500/20 text-orange-700 dark:bg-orange-500/25 dark:text-orange-300',
    open: 'bg-blue-500/20 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300',
    decision: 'bg-purple-500/20 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300',
    timeline: 'bg-teal-500/20 text-teal-700 dark:bg-teal-500/25 dark:text-teal-300',
    next: 'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300',
    default: 'bg-muted-foreground/20 text-muted-foreground',
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Insights
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConfig(getModelConfig())
                setSettingsOpen(true)
              }}
              title="Model settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Uses a local AI model to analyze tasks, dependencies, and meeting notes across risks,
          blind spots, critical path, timeline confidence, and more.
        </p>
        {generatedAt && (
          <p className="text-xs text-muted-foreground">
            Last generated: {new Date(generatedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {insights ? (
          <div className="space-y-3">
            {insightSections.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allExpanded = expandedSections.size === 0
                    setExpandedSections(
                      allExpanded ? new Set(insightSections.map((_, i) => i)) : new Set(),
                    )
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {expandedSections.size === 0 ? (
                    <>
                      <ChevronUp className="mr-1.5 h-4 w-4" />
                      Collapse all
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1.5 h-4 w-4" />
                      Expand all
                    </>
                  )}
                </Button>
              </div>
            )}
            {insightSections.map((section, i) => {
              const isExpanded = !expandedSections.has(i)
              return (
                <div
                  key={i}
                  className={`rounded-xl border ${sectionStyles[section.variant]}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedSections((prev) => {
                        const next = new Set(prev)
                        if (next.has(i)) next.delete(i)
                        else next.add(i)
                        return next
                      })
                    }}
                    className="flex w-full items-start gap-2 p-3 text-left transition-colors hover:opacity-90"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center pt-0.5 text-muted-foreground">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStyles[section.variant]}`}>
                      {section.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold tracking-tight text-foreground">
                        {section.title}
                      </h3>
                      {section.explanation && (
                        <p className="mt-0.5 text-sm font-normal text-muted-foreground">
                          {section.explanation}
                        </p>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 border-t border-black/5 px-3 pb-3 pt-2 dark:border-white/5">
                      {renderSectionContent(section.content)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : !loading && !error ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Click <strong>Analyze</strong> to run AI analysis on this project.
          </div>
        ) : null}
      </CardContent>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI model settings</DialogTitle>
            <DialogDescription>
              Configure the local model endpoint. Works with Ollama, LM Studio, or any
              OpenAI-compatible API.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Base URL</label>
              <Input
                value={config.baseUrl}
                onChange={(e) => {
                  setConfig((c) => ({ ...c, baseUrl: e.target.value }))
                  setTestStatus(null)
                }}
                placeholder="http://192.168.1.35:1234/api/v1"
              />
              <p className="text-xs text-muted-foreground">
                LM Studio: http://localhost:1234/api/v1 (or use your machine IP, e.g. 192.168.1.35)
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Input
                value={config.model}
                onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
                placeholder="qwen2.5-coder-14b"
              />
              <p className="text-xs text-muted-foreground">
                e.g. qwen2.5-coder-14b, qwen2.5:7b, llama3.2
              </p>
            </div>
            {testStatus && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  testStatus.startsWith('✓')
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {testStatus}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleTestConnection}>
              Test connection
            </Button>
            <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
