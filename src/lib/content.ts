import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import type { Category, Post, SiteSetting } from '@/payload-types'
import type { Locale } from './i18n'

const published: Where = {
  _status: {
    equals: 'published',
  },
}

export async function getPosts(
  locale: Locale,
  options: { category?: string; featured?: boolean; limit?: number; query?: string } = {},
): Promise<Post[]> {
  try {
    const payload = await getPayload({ config: configPromise })
    const conditions: Where[] = [
      published,
      {
        translationReady: {
          equals: true,
        },
      },
    ]

    if (options.category) {
      conditions.push({
        'categories.slug': {
          equals: options.category,
        },
      })
    }

    if (options.featured) {
      conditions.push({
        featured: {
          equals: true,
        },
      })
    }

    if (options.query) {
      conditions.push({
        or: [
          { title: { contains: options.query } },
          { excerpt: { contains: options.query } },
        ],
      })
    }

    const result = await payload.find({
      collection: 'posts',
      locale,
      fallbackLocale: false,
      depth: 2,
      limit: options.limit ?? 20,
      sort: '-publishedAt',
      where: {
        and: conditions,
      },
    })

    return result.docs
  } catch {
    return []
  }
}

export async function getPostBySlug(locale: Locale, slug: string): Promise<Post | null> {
  const posts = await getPosts(locale, { limit: 1 })
  const directMatch = posts.find((post) => post.slug === slug)
  if (directMatch) return directMatch

  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'posts',
      locale,
      fallbackLocale: false,
      depth: 2,
      limit: 1,
      where: {
        and: [published, { slug: { equals: slug } }],
      },
    })
    return result.docs[0] ?? null
  } catch {
    return null
  }
}

export async function getCategories(locale: Locale): Promise<Category[]> {
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'categories',
      locale,
      fallbackLocale: false,
      limit: 50,
      sort: 'title',
    })
    return result.docs
  } catch {
    return []
  }
}

export async function getSiteSettings(locale: Locale): Promise<SiteSetting | null> {
  try {
    const payload = await getPayload({ config: configPromise })
    return await payload.findGlobal({
      slug: 'site-settings',
      locale,
      fallbackLocale: false,
      depth: 1,
    })
  } catch {
    return null
  }
}
