import type { CollectionSlug } from 'payload'

import { copy, type Locale } from './i18n'

type SEOCollection = Extract<CollectionSlug, 'pages' | 'posts'>

const normalizeLocale = (locale?: string): Locale => (locale === 'en' ? 'en' : 'zh-Hant')

export function generateAdminSEOTitle({
  documentTitle,
  locale,
  siteName,
}: {
  documentTitle?: string | null
  locale?: string
  siteName?: string | null
}): string {
  const normalizedLocale = normalizeLocale(locale)
  const resolvedSiteName = siteName || copy[normalizedLocale].siteName

  return documentTitle ? `${documentTitle} | ${resolvedSiteName}` : resolvedSiteName
}

export function generateAdminSEOURL({
  baseURL,
  collection,
  locale,
  slug,
}: {
  baseURL: string
  collection?: SEOCollection
  locale?: string
  slug?: string | null
}): string {
  const normalizedBaseURL = baseURL.replace(/\/+$/, '')
  const normalizedLocale = normalizeLocale(locale)
  const localeRoot = `${normalizedBaseURL}/${normalizedLocale}`

  if (!slug || (collection === 'pages' && slug === 'home')) return localeRoot

  const encodedSlug = encodeURIComponent(slug)
  return collection === 'posts'
    ? `${localeRoot}/posts/${encodedSlug}`
    : `${localeRoot}/${encodedSlug}`
}
