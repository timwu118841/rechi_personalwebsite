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

function addPostDetailPaths(paths: Set<string>, doc: { slug?: unknown } | null | undefined) {
  if (!hasUsableSlug(doc)) return

  for (const locale of locales) paths.add(localizedPostHref(locale, doc.slug))
}

function addPostListPaths(paths: Set<string>, doc: Pick<Post, 'categories'> | null | undefined) {
  for (const locale of locales) paths.add(`/${locale}`)

  const categories = doc?.categories || []
  for (const category of categories) {
    if (typeof category === 'object' && category?.slug) {
      for (const locale of locales) paths.add(localizedCategoryHref(locale, category.slug))
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
    const paths = new Set<string>()
    const currentDoc = doc as RevalidatablePost
    const oldDoc = previousDoc as RevalidatablePost | undefined

    if (currentDoc._status === 'published') {
      addPostDetailPaths(paths, currentDoc)
      if (
        oldDoc?._status === 'published' &&
        hasUsableSlug(oldDoc) &&
        (!hasUsableSlug(currentDoc) || oldDoc.slug !== currentDoc.slug)
      ) {
        addPostDetailPaths(paths, oldDoc)
      }
      addPostListPaths(paths, currentDoc)
      if (oldDoc?._status === 'published') addPostListPaths(paths, oldDoc)
      revalidatePostCache()
    }

    // If the post was previously published, we need to revalidate the old path
    if (oldDoc?._status === 'published' && currentDoc._status !== 'published') {
      addPostDetailPaths(paths, oldDoc)
      addPostListPaths(paths, oldDoc)
      revalidatePostCache()
    }

    for (const path of paths) {
      payload.logger.info(`Revalidating post path: ${path}`)
      revalidatePath(path)
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) {
    const paths = new Set<string>()
    addPostDetailPaths(paths, doc)
    addPostListPaths(paths, doc)
    for (const path of paths) revalidatePath(path)
    revalidatePostCache()
  }

  return doc
}
