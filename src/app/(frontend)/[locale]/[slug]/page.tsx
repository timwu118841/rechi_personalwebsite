import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { getPageBySlug, getSiteSettings } from '@/lib/content'
import { isLocale } from '@/lib/i18n'
import { localizedPageHref } from '@/lib/routes'
import { mediaURL, siteURL } from '@/lib/seo'
import { pageStaticParams } from '@/lib/static-params'

export const revalidate = 300
export const generateStaticParams = pageStaticParams

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}

  const [page, settings] = await Promise.all([getPageBySlug(locale, slug), getSiteSettings(locale)])
  if (!page) return {}

  const title = page.meta?.title || page.title
  const description = page.meta?.description || settings?.defaultDescription
  const image = mediaURL(page.meta?.image)
  const pageHref = localizedPageHref(locale, page.slug)

  return {
    title: `${title} | ${settings?.siteName || '法律筆記'}`,
    description,
    alternates: { canonical: `${siteURL}${pageHref}` },
    openGraph: {
      title,
      description: description || undefined,
      url: `${siteURL}${pageHref}`,
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function ContentPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const page = await getPageBySlug(locale, slug)
  if (!page) notFound()

  return (
    <article className="content-page">
      <RenderHero {...page.hero} />
      <RenderBlocks blocks={page.layout} />
    </article>
  )
}
