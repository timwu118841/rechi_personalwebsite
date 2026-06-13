import type { MetadataRoute } from 'next'

import { getPosts } from '@/lib/content'
import { locales } from '@/lib/i18n'
import { siteURL } from '@/lib/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = locales.flatMap((locale) => [
    { url: `${siteURL}/${locale}`, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteURL}/${locale}/about`, changeFrequency: 'monthly', priority: 0.5 },
  ])

  const postGroups = await Promise.all(
    locales.map(async (locale) => {
      const posts = await getPosts(locale, { limit: 1000 })
      return posts
        .filter((post) => !post.meta?.noIndex)
        .map((post) => ({
          url: `${siteURL}/${locale}/posts/${post.slug}`,
          lastModified: new Date(post.updatedAt),
          changeFrequency: 'monthly' as const,
          priority: 0.8,
        }))
    }),
  )

  return [...staticPages, ...postGroups.flat()]
}
