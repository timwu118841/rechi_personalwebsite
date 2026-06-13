import { notFound } from 'next/navigation'

import { SiteHeader } from '@/components/blog/SiteHeader'
import { copy, isLocale } from '@/lib/i18n'
import { getNavigation, getSiteSettings } from '@/lib/content'
import { resolveCMSLinkHref } from '@/lib/navigation'
import Link from 'next/link'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: value } = await params
  if (!isLocale(value)) notFound()
  const [settings, navigation] = await Promise.all([
    getSiteSettings(value),
    getNavigation(value),
  ])

  return (
    <div className="site-shell">
      <SiteHeader
        locale={value}
        navItems={navigation.header?.navItems}
        siteName={settings?.siteName}
      />
      <main>{children}</main>
      <footer className="site-footer">
        <p>{settings?.siteName || copy[value].siteName}</p>
        {navigation.footer?.navItems?.length ? (
          <nav aria-label="頁尾導覽">
            {navigation.footer.navItems.map(({ id, link }) => {
              const href = resolveCMSLinkHref(link, value)
              if (!href) return null
              return (
                <Link
                  href={href}
                  key={id || `${link.label}-${href}`}
                  {...(link.newTab
                    ? { rel: 'noopener noreferrer', target: '_blank' }
                    : {})}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        ) : null}
        <p>{settings?.disclaimer}</p>
      </footer>
    </div>
  )
}
