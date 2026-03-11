/**
 * AI client for local models (Ollama, LM Studio, etc.).
 * Uses OpenAI-compatible Chat Completions API.
 * When running in Tauri desktop app, uses embedded model (download-on-first-run).
 * Model can be swapped via getModel/setModel (browser only).
 */

const STORAGE_KEY = 'nexuspm:ai:model'
const DEFAULT_BASE_URL = 'http://localhost:1234/api/v1'
const DEFAULT_MODEL = 'qwen2.5-coder-14b'

let tauriDetectedByInvoke = false
export function setTauriDetectedByInvoke(value: boolean) {
  tauriDetectedByInvoke = value
}

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
    __TAURI_METADATA__?: unknown
  }
  if (w.__TAURI__ ?? w.__TAURI_INTERNALS__ ?? w.__TAURI_METADATA__) return true
  return tauriDetectedByInvoke
}

export type AIModelConfig = {
  baseUrl: string
  model: string
}

export function getModelConfig(): AIModelConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AIModelConfig>
      return {
        baseUrl: parsed.baseUrl ?? DEFAULT_BASE_URL,
        model: parsed.model ?? DEFAULT_MODEL,
      }
    }
  } catch {
    /* ignore */
  }
  return { baseUrl: DEFAULT_BASE_URL, model: DEFAULT_MODEL }
}

export function setModelConfig(config: Partial<AIModelConfig>) {
  const current = getModelConfig()
  const next = { ...current, ...config }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

/**
 * Start downloading the AI model in the background (Tauri only).
 * Call on app launch. Returns "cached" | "started" | "already_started".
 */
export async function startBackgroundDownload(): Promise<
  'cached' | 'started' | 'already_started'
> {
  if (!isTauri()) return 'cached'
  const { invoke } = await import('@tauri-apps/api/core')
  const result = (await invoke('start_background_download')) as string
  if (result === 'cached' || result === 'started' || result === 'already_started') return result
  throw new Error(result)
}

/**
 * Request cancellation of the in-progress download (Tauri only).
 * deletePartial: true = stop and delete partial file, false = pause and keep partial.
 */
export async function requestDownloadCancel(deletePartial: boolean): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('request_download_cancel', { deletePartial })
}

/**
 * Resume a paused download (Tauri only).
 */
export async function resumeBackgroundDownload(): Promise<
  'cached' | 'started' | 'already_started'
> {
  if (!isTauri()) return 'cached'
  const { invoke } = await import('@tauri-apps/api/core')
  const result = (await invoke('resume_background_download')) as string
  if (result === 'cached' || result === 'started' || result === 'already_started') return result
  throw new Error(result)
}

/**
 * Download the embedded AI model (Tauri only).
 * Returns "already_cached" | "downloaded" or throws on error.
 */
export async function downloadAiModel(): Promise<'already_cached' | 'downloaded'> {
  if (!isTauri()) throw new Error('Download only available in desktop app')
  const { invoke } = await import('@tauri-apps/api/core')
  const result = (await invoke('download_ai_model')) as string
  if (result === 'already_cached' || result === 'downloaded') return result
  throw new Error(result)
}

/**
 * Test if the AI endpoint is reachable (GET /models).
 * In Tauri: checks embedded model status.
 */
export async function testConnection(config?: Partial<AIModelConfig>): Promise<{
  ok: boolean
  message: string
  models?: string[]
}> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const status = (await invoke('ai_model_status')) as string
      return {
        ok: status === 'loaded',
        message:
          status === 'loaded'
            ? 'Embedded model ready.'
            : 'Model not loaded yet. First AI request will download and load it (~8.5GB).',
        models: status === 'loaded' ? ['Qwen2.5-Coder-14B (embedded)'] : undefined,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, message: msg }
    }
  }
  const { baseUrl } = config ? { ...getModelConfig(), ...config } : getModelConfig()
  const url = `${baseUrl.replace(/\/$/, '')}/models`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}: ${await res.text()}` }
    }
    const data = (await res.json()) as { data?: Array<{ id?: string }> }
    const models = data.data?.map((m) => m.id ?? 'unknown') ?? []
    return {
      ok: true,
      message: models.length > 0 ? `Connected. Models: ${models.join(', ')}` : 'Connected.',
      models,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      message: msg.includes('fetch') ? `${msg} (check URL, CORS, and that LM Studio is running)` : msg,
    }
  }
}

export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  config?: Partial<AIModelConfig>,
): Promise<string> {
  if (isTauri()) {
    const { useAiStore } = await import('@/store/useAiStore')
    useAiStore.getState().setStatus('starting')
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke('chat_completion', {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }) as Promise<string>
  }
  const { baseUrl, model } = config ? { ...getModelConfig(), ...config } : getModelConfig()
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AI request failed (${res.status}): ${err}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  return content.trim()
}

export type CleanMeetingNotesInput = {
  title: string
  content: string
  peoplePresent?: string
  preparation?: string
}

/**
 * Clean up raw meeting notes into structured takeaways, next steps, PTAs, and timelines.
 */
export async function cleanMeetingNotes(
  input: CleanMeetingNotesInput,
  config?: Partial<AIModelConfig>,
): Promise<string> {
  const systemPrompt = `You are a meeting notes assistant. Clean up raw meeting notes into a structured, actionable format.

Output format (use markdown headers and lists):

## Takeaways
- Key decisions and conclusions from the meeting

## Next steps (with PTA and timeline)
For each action, include subject, PTA, and timeline. If no date is mentioned, use TBD:
- Next step: [action item]
  PTA: @[person]
  Timeline: [date or TBD]

Example:
- Next step: Finalize the design mockups
  PTA: @Sarah
  Timeline: March 15
- Next step: Review API documentation
  PTA: @Yoran
  Timeline: TBD

Keep the same tone and level of detail. If information is missing (e.g. no people named, no dates), say so briefly. Output only the cleaned notes, no preamble.`

  const parts: string[] = []
  if (input.peoplePresent) parts.push(`People present: ${input.peoplePresent}`)
  if (input.preparation) parts.push(`Preparation/context: ${input.preparation}`)
  parts.push(`\nRaw meeting notes:\n${input.content}`)

  const userContent = parts.join('\n\n')
  const result = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    config,
  )
  return result
}
