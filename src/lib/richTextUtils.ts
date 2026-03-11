import { marked } from 'marked'

/** Check if string looks like HTML (has tags) */
export function isHtml(s: string): boolean {
  const trimmed = s.trim()
  return trimmed.startsWith('<') && trimmed.includes('>')
}

/** Convert plain text to HTML (wrap in paragraphs, escape entities) */
export function plainTextToHtml(text: string): string {
  if (!text.trim()) return '<p></p>'
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
  return `<p>${escaped.replace(/\n/g, '</p><p>')}</p>`
}

/** Normalize content for editor: plain text → HTML, existing HTML → as-is */
export function toEditorHtml(content: string): string {
  if (!content.trim()) return '<p></p>'
  if (isHtml(content)) return content
  return plainTextToHtml(content)
}

/** Strip HTML to plain text (e.g. for AI input) */
export function htmlToPlainText(html: string): string {
  if (!html.trim()) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent?.trim() ?? ''
}

/** Convert markdown to HTML (e.g. for AI output) */
export function markdownToHtml(md: string): string {
  if (!md.trim()) return '<p></p>'
  try {
    const result = marked.parse(md)
    return (typeof result === 'string' ? result : String(result)) || '<p></p>'
  } catch {
    return plainTextToHtml(md)
  }
}
