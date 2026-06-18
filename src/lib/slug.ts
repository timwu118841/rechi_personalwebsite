export function slugifyUnicode({
  valueToSlugify,
}: {
  valueToSlugify?: unknown
}): string | undefined {
  if (typeof valueToSlugify !== 'string') return undefined

  const slug = valueToSlugify
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return slug || undefined
}
