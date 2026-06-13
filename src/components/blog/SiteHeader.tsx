import Link from 'next/link'

import { alternateLocale, copy, type Locale } from '@/lib/i18n'
import { resolveCMSLinkHref } from '@/lib/navigation'
import type { Header } from '@/payload-types'

export function SiteHeader({
  locale,
  navItems,
  siteName,
}: {
  locale: Locale
  navItems?: Header['navItems']
  siteName?: string
}) {
  const t = copy[locale]
  const other = alternateLocale(locale)

  return (
    <header className="site-header">
      <Link className="site-brand" href={`/${locale}`}>
        {siteName || t.siteName}
      </Link>
      <nav aria-label="主要導覽">
        <Link href={`/${locale}`}>{t.nav.home}</Link>
        {navItems?.map(({ id, link }) => {
          const href = resolveCMSLinkHref(link, locale)
          if (!href) return null
          return (
            <Link
              href={href}
              key={id || `${link.label}-${href}`}
              {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
            >
              {link.label}
            </Link>
          )
        })}
        <Link href={`/${locale}/search`}>{t.nav.search}</Link>
        <Link href={`/${other}`} hrefLang={other}>
          {other === 'en' ? 'EN' : '中'}
        </Link>
      </nav>
    </header>
  )
}
