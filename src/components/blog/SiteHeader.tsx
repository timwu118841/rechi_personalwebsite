import Link from 'next/link'

import { alternateLocale, copy, type Locale } from '@/lib/i18n'

export function SiteHeader({ locale, siteName }: { locale: Locale; siteName?: string }) {
  const t = copy[locale]
  const other = alternateLocale(locale)

  return (
    <header className="site-header">
      <Link className="site-brand" href={`/${locale}`}>
        {siteName || t.siteName}
      </Link>
      <nav aria-label="主要導覽">
        <Link href={`/${locale}`}>{t.nav.home}</Link>
        <Link href={`/${locale}/about`}>{t.nav.about}</Link>
        <Link href={`/${locale}/search`}>{t.nav.search}</Link>
        <Link href={`/${other}`} hrefLang={other}>
          {other === 'en' ? 'EN' : '中'}
        </Link>
      </nav>
    </header>
  )
}
