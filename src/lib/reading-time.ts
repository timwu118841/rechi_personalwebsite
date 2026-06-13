function lexicalText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const candidate = node as { text?: unknown; children?: unknown[]; root?: unknown }
  const ownText = typeof candidate.text === 'string' ? candidate.text : ''
  const rootText = candidate.root ? lexicalText(candidate.root) : ''
  const childText = Array.isArray(candidate.children)
    ? candidate.children.map(lexicalText).join(' ')
    : ''
  return [ownText, rootText, childText].filter(Boolean).join(' ')
}

export function calculateReadingMinutes(content: unknown, locale: string): number {
  const text = lexicalText(content).trim()
  if (!text) return 1

  if (locale === 'zh-Hant') {
    const characters = text.replace(/\s/g, '').length
    return Math.max(1, Math.ceil(characters / 400))
  }

  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 220))
}
