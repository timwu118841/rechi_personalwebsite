import { getCategories, getPages, getPosts } from './content'
import { locales, type Locale } from './i18n'

const RESERVED_PAGE_SLUGS = new Set(['home', 'search', 'about', 'posts', 'categories'])

function hasUsableSlug(document: { slug?: unknown }): document is { slug: string } {
  return typeof document.slug === 'string' && document.slug.trim().length > 0
}

export const CONTENT_REVALIDATE_SECONDS = 300

export function localeStaticParams(): Array<{ locale: Locale }> {
  return locales.map((locale) => ({ locale }))
}

export async function postStaticParams(): Promise<Array<{ locale: Locale; slug: string }>> {
  const params = await Promise.all(
    locales.map(async (locale) => {
      const posts = await getPosts(locale, { limit: 1000, staticParams: true })
      return posts.filter(hasUsableSlug).map((post) => ({ locale, slug: post.slug }))
    }),
  )

  return params.flat()
}

export async function categoryStaticParams(): Promise<Array<{ locale: Locale; slug: string }>> {
  const params = await Promise.all(
    locales.map(async (locale) => {
      const categories = await getCategories(locale)
      return categories.filter(hasUsableSlug).map((category) => ({ locale, slug: category.slug }))
    }),
  )

  return params.flat()
}

export async function pageStaticParams(): Promise<Array<{ locale: Locale; slug: string }>> {
  const params = await Promise.all(
    locales.map(async (locale) => {
      const pages = await getPages(locale)
      return pages
        .filter(hasUsableSlug)
        .filter((page) => !RESERVED_PAGE_SLUGS.has(page.slug))
        .map((page) => ({ locale, slug: page.slug }))
    }),
  )

  return params.flat()
}
