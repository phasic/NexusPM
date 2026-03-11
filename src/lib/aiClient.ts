/**
 * AI client for local models (Ollama, LM Studio, etc.).
 * Uses OpenAI-compatible Chat Completions API.
 * Model can be swapped via getModel/setModel.
 */

const STORAGE_KEY = 'nexuspm:ai:model'
const DEFAULT_BASE_URL = 'http://localhost:1234/api/v1'
const DEFAULT_MODEL = 'qwen2.5-coder-14b'

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
 * Test if the AI endpoint is reachable (GET /models).
 * Use this to verify the server is running and the URL is correct.
 */
export async function testConnection(config?: Partial<AIModelConfig>): Promise<{
  ok: boolean
  message: string
  models?: string[]
}> {
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
