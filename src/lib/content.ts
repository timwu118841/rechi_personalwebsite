import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'

import type { Category, Footer, Header, Page, Post, SiteSetting } from '@/payload-types'
import type { Locale } from './i18n'

const published: Where = {
  _status: {
    equals: 'published',
  },
}

const localizedPublicContent: Where[] = [
  published,
  {
    title: {
      exists: true,
    },
  },
  {
    slug: {
      exists: true,
    },
  },
]

export async function getPosts(
  locale: Locale,
  options: { category?: string; featured?: boolean; limit?: number; query?: string } = {},
): Promise<Post[]> {
  try {
    const payload = await getPayload({ config: configPromise })
    const conditions: Where[] = [...localizedPublicContent]

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
        and: [...localizedPublicContent, { slug: { equals: slug } }],
      },
    })
    return result.docs[0] ?? null
  } catch {
    return null
  }
}

export async function getPageBySlug(locale: Locale, slug: string): Promise<Page | null> {
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'pages',
      locale,
      fallbackLocale: false,
      depth: 2,
      limit: 1,
      where: {
        and: [
          published,
          { title: { exists: true } },
          { slug: { equals: slug } },
        ],
      },
    })

    return result.docs[0] ?? null
  } catch {
    return null
  }
}

export async function getPages(locale: Locale): Promise<Page[]> {
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'pages',
      locale,
      fallbackLocale: false,
      depth: 0,
      limit: 100,
      where: {
        and: [published, { title: { exists: true } }, { slug: { exists: true } }],
      },
    })

    return result.docs
  } catch {
    return []
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

export async function getNavigation(locale: Locale): Promise<{
  footer: Footer | null
  header: Header | null
}> {
  try {
    const payload = await getPayload({ config: configPromise })
    const [header, footer] = await Promise.all([
      payload.findGlobal({
        slug: 'header',
        locale,
        fallbackLocale: false,
        depth: 2,
      }),
      payload.findGlobal({
        slug: 'footer',
        locale,
        fallbackLocale: false,
        depth: 2,
      }),
    ])

    return { header, footer }
  } catch {
    return { header: null, footer: null }
  }
}
