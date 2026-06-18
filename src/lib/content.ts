import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Where } from 'payload'

import type { Category, Footer, Header, Page, Post, SiteSetting } from '@/payload-types'
import type { Locale } from './i18n'
import { decodeSlugParam } from './routes'

const CONTENT_CACHE_SECONDS = 300

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

const getCachedPosts = unstable_cache(
  async (
    locale: Locale,
    options: {
      category?: string
      featured?: boolean
      featuredFirst?: boolean
      limit?: number
      query?: string
      staticParams?: boolean
    } = {},
  ): Promise<Post[]> => {
    try {
      const payload = await getPayload({ config: configPromise })
      const conditions: Where[] = [...localizedPublicContent]

      if (options.category) {
        conditions.push({
          'categories.slug': {
            equals: decodeSlugParam(options.category),
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
          or: [{ title: { contains: options.query } }, { excerpt: { contains: options.query } }],
        })
      }

      const result = await payload.find({
        collection: 'posts',
        locale,
        fallbackLocale: false,
        depth: 1,
        limit: options.limit ?? 20,
        sort: options.featuredFirst ? ['-featured', '-publishedAt'] : '-publishedAt',
        context: { skipPopulateAuthors: true },
        where: {
          and: conditions,
        },
      })

      return result.docs
    } catch {
      return []
    }
  },
  ['posts'],
  { revalidate: CONTENT_CACHE_SECONDS, tags: ['posts'] },
)

export async function getPosts(
  locale: Locale,
  options: {
    category?: string
    featured?: boolean
    featuredFirst?: boolean
    limit?: number
    query?: string
    staticParams?: boolean
  } = {},
): Promise<Post[]> {
  return getCachedPosts(locale, options)
}

const getCachedPostBySlug = unstable_cache(
  async (locale: Locale, slug: string): Promise<Post | null> => {
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
  },
  ['post-by-slug'],
  { revalidate: CONTENT_CACHE_SECONDS, tags: ['posts'] },
)

export async function getPostBySlug(locale: Locale, slug: string): Promise<Post | null> {
  return getCachedPostBySlug(locale, decodeSlugParam(slug))
}

const getCachedPageBySlug = unstable_cache(
  async (locale: Locale, slug: string): Promise<Page | null> => {
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
            { slug: { equals: decodeSlugParam(slug) } },
          ],
        },
      })

      return result.docs[0] ?? null
    } catch {
      return null
    }
  },
  ['page-by-slug'],
  { revalidate: CONTENT_CACHE_SECONDS, tags: ['pages'] },
)

export async function getPageBySlug(locale: Locale, slug: string): Promise<Page | null> {
  return getCachedPageBySlug(locale, slug)
}

const getCachedPages = unstable_cache(
  async (locale: Locale): Promise<Page[]> => {
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
  },
  ['pages'],
  { revalidate: CONTENT_CACHE_SECONDS, tags: ['pages'] },
)

export async function getPages(locale: Locale): Promise<Page[]> {
  return getCachedPages(locale)
}

const getCachedCategories = unstable_cache(
  async (locale: Locale): Promise<Category[]> => {
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
  },
  ['categories'],
  { revalidate: CONTENT_CACHE_SECONDS, tags: ['categories'] },
)

export async function getCategories(locale: Locale): Promise<Category[]> {
  return getCachedCategories(locale)
}

const getCachedSiteSettings = unstable_cache(
  async (locale: Locale): Promise<SiteSetting | null> => {
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
  },
  ['site-settings'],
  { revalidate: CONTENT_CACHE_SECONDS, tags: ['site-settings'] },
)

export async function getSiteSettings(locale: Locale): Promise<SiteSetting | null> {
  return getCachedSiteSettings(locale)
}

const getCachedNavigation = unstable_cache(
  async (
    locale: Locale,
  ): Promise<{
    footer: Footer | null
    header: Header | null
  }> => {
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
  },
  ['navigation'],
  { revalidate: CONTENT_CACHE_SECONDS, tags: ['global_header', 'global_footer'] },
)

export async function getNavigation(locale: Locale): Promise<{
  footer: Footer | null
  header: Header | null
}> {
  return getCachedNavigation(locale)
}
