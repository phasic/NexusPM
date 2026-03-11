import type { TaskColorPreset } from '@/domain/types'

export const TASK_COLOR_PRESETS: TaskColorPreset[] = ['green', 'orange', 'red']

export const TASK_COLOR_PRESET_STYLES: Record<
  TaskColorPreset,
  { bg: string; border: string; text: string }
> = {
  green: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  orange: {
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/40',
    text: 'text-orange-700 dark:text-orange-300',
  },
  red: {
    bg: 'bg-red-500/15',
    border: 'border-red-500/40',
    text: 'text-red-700 dark:text-red-300',
  },
}

const COLOR_HISTORY_KEY = 'nexuspm:color-history'
const COLOR_HISTORY_MAX = 3

export function getColorHistory(): string[] {
  try {
    const raw = localStorage.getItem(COLOR_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string' && /^#[0-9A-Fa-f]{6}$/.test(x))
  } catch {
    return []
  }
}

export function addColorToHistory(hex: string): void {
  const normalized = hex.startsWith('#') ? hex : `#${hex}`
  if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) return
  const current = getColorHistory().filter((c) => c.toLowerCase() !== normalized.toLowerCase())
  const next = [normalized, ...current].slice(0, COLOR_HISTORY_MAX)
  localStorage.setItem(COLOR_HISTORY_KEY, JSON.stringify(next))
}

export function isPresetColor(color: string | undefined): color is TaskColorPreset {
  return color === 'green' || color === 'orange' || color === 'red'
}

export function isCustomColor(color: string | undefined): boolean {
  return Boolean(color && !isPresetColor(color) && /^#[0-9A-Fa-f]{6}$/.test(color))
}

/** Returns inline style for custom hex, or null for presets */
export function getCustomColorStyle(hex: string): Record<string, string> {
  return {
    backgroundColor: `${hex}26`,
    borderColor: `${hex}66`,
    color: hex,
  }
}
