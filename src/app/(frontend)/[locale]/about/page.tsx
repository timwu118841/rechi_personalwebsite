export const revalidate = 300
export const generateStaticParams = localeStaticParams

import { notFound } from 'next/navigation'

import { getSiteSettings } from '@/lib/content'
import { copy, isLocale } from '@/lib/i18n'
import { localeStaticParams } from '@/lib/static-params'

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const settings = await getSiteSettings(locale)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: settings?.authorName || '作者姓名',
    description: settings?.authorBio,
    knowsAbout: settings?.authorExpertise,
  }

  return (
    <article className="about-page">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        type="application/ld+json"
      />
      <p className="post-kicker">{copy[locale].about}</p>
      <h1>{settings?.authorName || '作者姓名'}</h1>
      <p className="about-expertise">{settings?.authorExpertise}</p>
      <p>{settings?.authorBio}</p>
    </article>
  )
}
