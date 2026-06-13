export function isPublishedDocument(document: {
  _status?: 'draft' | 'published' | null
  slug?: string | null
  title?: string | null
}): boolean {
  return (
    document._status === 'published' &&
    Boolean(document.slug?.trim() && document.title?.trim())
  )
}
