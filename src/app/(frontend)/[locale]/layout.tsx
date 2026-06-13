import { notFound } from 'next/navigation'

import { SiteHeader } from '@/components/blog/SiteHeader'
import { copy, isLocale } from '@/lib/i18n'
import { getSiteSettings } from '@/lib/content'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: value } = await params
  if (!isLocale(value)) notFound()
  const settings = await getSiteSettings(value)

  return (
    <div className="site-shell">
      <SiteHeader locale={value} siteName={settings?.siteName} />
      <main>{children}</main>
      <footer className="site-footer">
        <p>{settings?.siteName || copy[value].siteName}</p>
        <p>{settings?.disclaimer}</p>
      </footer>
    </div>
  )
}
