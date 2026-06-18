function normalizeSlugInput(value: string): string | undefined {
  const slug = value
    .normalize('NFKC')
    .replace(/[\u3100-\u312F\u31A0-\u31BF\u02CA\u02C7\u02CB\u02D9]+/g, '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return slug || undefined
}

export function slugifyUnicode({
  data,
  valueToSlugify,
}: {
  data?: { title?: unknown }
  valueToSlugify?: unknown
}): string | undefined {
  if (typeof valueToSlugify === 'string') {
    const slug = normalizeSlugInput(valueToSlugify)
    if (slug) return slug
  }

  if (typeof data?.title === 'string' && data.title !== valueToSlugify) {
    return normalizeSlugInput(data.title)
  }

  return undefined
}
