import type { Locale } from './i18n'

type NavigationLink = {
  reference?: {
    relationTo: 'pages' | 'posts'
    value: { slug?: string | null } | string | number
  } | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

export function resolveCMSLinkHref(link: NavigationLink, locale: Locale): string | null {
  if (
    link.type === 'reference' &&
    typeof link.reference?.value === 'object' &&
    link.reference.value.slug
  ) {
    const prefix = link.reference.relationTo === 'posts' ? '/posts' : ''
    return `/${locale}${prefix}/${link.reference.value.slug}`
  }

  return link.url || null
}
