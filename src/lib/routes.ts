import type { Locale } from './i18n'

function slugSegment(slug: string): string {
  return encodeURIComponent(slug)
}

export function decodeSlugParam(slug: string): string {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

export function localizedPostHref(locale: Locale, slug: string): string {
  return `/${locale}/posts/${slugSegment(slug)}`
}

export function localizedPageHref(locale: Locale, slug: string): string {
  return slug === 'home' ? `/${locale}` : `/${locale}/${slugSegment(slug)}`
}

export function localizedCategoryHref(locale: Locale, slug: string): string {
  return `/${locale}/categories/${slugSegment(slug)}`
}
