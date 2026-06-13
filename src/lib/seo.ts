import type { Metadata } from 'next'

import type { Media, Post, SiteSetting } from '@/payload-types'
import type { Locale } from './i18n'

export const siteURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

export function mediaURL(media: Media | number | null | undefined): string | undefined {
  if (!media || typeof media !== 'object' || !media.url) return undefined
  return media.url.startsWith('http') ? media.url : `${siteURL}${media.url}`
}

export function postMetadata(
  post: Post,
  locale: Locale,
  settings: SiteSetting | null,
  alternatePublished = false,
): Metadata {
  const meta = post.meta
  const title = meta?.title || post.title
  const description = meta?.description || post.excerpt
  const canonical = `${siteURL}/${locale}/posts/${post.slug}`
  const otherLocale = locale === 'zh-Hant' ? 'en' : 'zh-Hant'
  const image = mediaURL(meta?.image || post.heroImage)

  return {
    title: `${title} | ${settings?.siteName || '法律筆記'}`,
    description,
    alternates: {
      canonical,
      languages: alternatePublished
        ? {
            [locale]: canonical,
            [otherLocale]: `${siteURL}/${otherLocale}/posts/${post.slug}`,
          }
        : { [locale]: canonical },
    },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      locale,
      publishedTime: post.publishedAt || post.createdAt,
      modifiedTime: post.updatedAt,
      images: image ? [{ url: image }] : undefined,
    },
    robots: meta?.noIndex ? { index: false, follow: true } : undefined,
  }
}

export function articleJsonLd(post: Post, locale: Locale, settings: SiteSetting | null) {
  const image = mediaURL(post.meta?.image || post.heroImage)
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta?.description || post.excerpt,
    inLanguage: locale,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: `${siteURL}/${locale}/posts/${post.slug}`,
    author: {
      '@type': 'Person',
      name: settings?.authorName || '作者姓名',
    },
    image: image ? [image] : undefined,
  }
}
