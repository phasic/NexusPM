import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'nexuspm:theme'

export type Theme = 'light' | 'dark' | 'system'

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* ignore */
  }
  return 'system'
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
  window.dispatchEvent(new CustomEvent('nexuspm:theme-change', { detail: theme }))
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => getTheme())

  useEffect(() => {
    const handler = () => setThemeState(getTheme())
    window.addEventListener('nexuspm:theme-change', handler)
    return () => window.removeEventListener('nexuspm:theme-change', handler)
  }, [])

  const set = useCallback((t: Theme) => {
    setTheme(t)
    setThemeState(t)
  }, [])

  return [theme, set]
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function initTheme() {
  applyTheme(getTheme())
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getTheme() === 'system') applyTheme('system')
    })
  }
}
