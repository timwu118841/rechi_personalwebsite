import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

import type { Post } from '../../../payload-types'
import { locales } from '../../../lib/i18n'
import { localizedCategoryHref, localizedPostHref } from '../../../lib/routes'

type RevalidatablePost = Pick<Post, '_status' | 'categories'> & { slug?: unknown }

function hasUsableSlug<T extends { slug?: unknown }>(
  doc: T | null | undefined,
): doc is T & { slug: string } {
  return typeof doc?.slug === 'string' && doc.slug.trim().length > 0
}

function revalidatePostDetailPaths(doc: { slug?: unknown } | null | undefined) {
  if (!hasUsableSlug(doc)) return

  for (const locale of locales) revalidatePath(localizedPostHref(locale, doc.slug))
}

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
    const currentDoc = doc as RevalidatablePost
    const oldDoc = previousDoc as RevalidatablePost | undefined

    if (currentDoc._status === 'published') {
      if (hasUsableSlug(currentDoc)) {
        for (const locale of locales) {
          const path = localizedPostHref(locale, currentDoc.slug)
          payload.logger.info(`Revalidating post at path: ${path}`)
          revalidatePath(path)
        }
      }
      revalidatePostListPaths(currentDoc)
      if (oldDoc?._status === 'published') revalidatePostListPaths(oldDoc)
      revalidatePostCache()
    }

    // If the post was previously published, we need to revalidate the old path
    if (oldDoc?._status === 'published' && currentDoc._status !== 'published') {
      if (hasUsableSlug(oldDoc)) {
        for (const locale of locales) {
          const oldPath = localizedPostHref(locale, oldDoc.slug)
          payload.logger.info(`Revalidating old post at path: ${oldPath}`)
          revalidatePath(oldPath)
        }
      }
      revalidatePostListPaths(oldDoc)
      revalidatePostCache()
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) {
    revalidatePostDetailPaths(doc)
    revalidatePostListPaths(doc)
    revalidatePostCache()
  }

  return doc
}
