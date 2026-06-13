export function isPublishedDocument(document: {
  _status?: 'draft' | 'published' | null
  slug?: string | null
  title?: string | null
  translationReady?: boolean | null
}): boolean {
  return (
    document._status === 'published' &&
    document.translationReady === true &&
    Boolean(document.slug?.trim() && document.title?.trim())
  )
}
