import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

import type { Post } from '../../../payload-types'
import { locales } from '../../../lib/i18n'
import { localizedCategoryHref, localizedPostHref } from '../../../lib/routes'

function revalidatePostListPaths(doc: Pick<Post, 'categories'> | null | undefined) {
  for (const locale of locales) revalidatePath(`/${locale}`)

  const categories = doc?.categories || []
  for (const category of categories) {
    if (typeof category === 'object' && category?.slug) {
      for (const locale of locales) revalidatePath(localizedCategoryHref(locale, category.slug))
    }
  }
}

function revalidatePostCache() {
  revalidateTag('posts', 'max')
  revalidateTag('posts-sitemap', 'max')
}

export const revalidatePost: CollectionAfterChangeHook<Post> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    if (doc._status === 'published') {
      for (const locale of locales) {
        const path = localizedPostHref(locale, doc.slug)
        payload.logger.info(`Revalidating post at path: ${path}`)
        revalidatePath(path)
      }
      revalidatePostListPaths(doc)
      if (previousDoc?._status === 'published') revalidatePostListPaths(previousDoc)
      revalidatePostCache()
    }

    // If the post was previously published, we need to revalidate the old path
    if (previousDoc._status === 'published' && doc._status !== 'published') {
      for (const locale of locales) {
        const oldPath = localizedPostHref(locale, previousDoc.slug)
        payload.logger.info(`Revalidating old post at path: ${oldPath}`)
        revalidatePath(oldPath)
      }
      revalidatePostListPaths(previousDoc)
      revalidatePostCache()
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) {
    for (const locale of locales) revalidatePath(localizedPostHref(locale, doc.slug))
    revalidatePostListPaths(doc)
    revalidatePostCache()
  }

  return doc
}
