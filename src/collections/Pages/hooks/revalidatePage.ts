import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

import type { Page } from '../../../payload-types'
import { locales } from '../../../lib/i18n'
import { localizedPageHref } from '../../../lib/routes'

function hasUsableSlug(doc: { slug?: unknown } | null | undefined): doc is { slug: string } {
  return typeof doc?.slug === 'string' && doc.slug.trim().length > 0
}

function addPagePaths(paths: Set<string>, doc: { slug?: unknown } | null | undefined) {
  if (!hasUsableSlug(doc)) return

  const { slug } = doc
  for (const locale of locales) paths.add(localizedPageHref(locale, slug))
}

export const revalidatePage: CollectionAfterChangeHook<Page> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    const paths = new Set<string>()

    if (doc._status === 'published') {
      addPagePaths(paths, doc)
      if (
        previousDoc?._status === 'published' &&
        hasUsableSlug(previousDoc) &&
        (!hasUsableSlug(doc) || previousDoc.slug !== doc.slug)
      ) {
        addPagePaths(paths, previousDoc)
      }
      revalidateTag('pages', 'max')
      revalidateTag('pages-sitemap', 'max')
    }

    // If the page was previously published, we need to revalidate the old path
    if (previousDoc?._status === 'published' && doc._status !== 'published') {
      addPagePaths(paths, previousDoc)
      revalidateTag('pages', 'max')
      revalidateTag('pages-sitemap', 'max')
    }

    for (const path of paths) {
      payload.logger.info(`Revalidating page path: ${path}`)
      revalidatePath(path)
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Page> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) {
    const paths = new Set<string>()
    addPagePaths(paths, doc)
    for (const path of paths) revalidatePath(path)
    revalidateTag('pages', 'max')
    revalidateTag('pages-sitemap', 'max')
  }

  return doc
}
