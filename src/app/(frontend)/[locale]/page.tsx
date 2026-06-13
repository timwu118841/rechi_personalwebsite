import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PostCard } from '@/components/blog/PostCard'
import { copy, isLocale } from '@/lib/i18n'
import { getCategories, getPosts, getSiteSettings } from '@/lib/content'
import { siteURL } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const settings = await getSiteSettings(locale)
  return {
    title: settings?.siteName || copy[locale].siteName,
    description: settings?.defaultDescription || copy[locale].heroEyebrow,
    alternates: {
      canonical: `${siteURL}/${locale}`,
      languages: {
        'zh-Hant': `${siteURL}/zh-Hant`,
        en: `${siteURL}/en`,
      },
    },
  }
}

export default async function LocaleHome({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const [posts, featuredPosts, categories, settings] = await Promise.all([
    getPosts(locale, { limit: 12 }),
    getPosts(locale, { featured: true, limit: 1 }),
    getCategories(locale),
    getSiteSettings(locale),
  ])
  const featured = featuredPosts[0]
  const latest = featured ? posts.filter((post) => post.id !== featured.id) : posts
  const t = copy[locale]

  return (
    <>
      <section className="hero">
        <p>{settings?.tagline || t.heroEyebrow}</p>
        <h1>{settings?.homepageHeroTitle || t.heroTitle}</h1>
      </section>

      {featured && (
        <section className="content-section">
          <h2 className="section-title">{t.featured}</h2>
          <PostCard featured locale={locale} post={featured} />
        </section>
      )}

      <section className="content-section">
        <h2 className="section-title">{t.latest}</h2>
        {latest.length ? (
          <div className="post-list">
            {latest.map((post) => <PostCard key={post.id} locale={locale} post={post} />)}
          </div>
        ) : (
          <p className="empty-state">{t.noPosts}</p>
        )}
      </section>

      <section className="content-section">
        <h2 className="section-title">{t.categories}</h2>
        <div className="category-list">
          {categories.map((category) => (
            <Link href={`/${locale}/categories/${category.slug}`} key={category.id}>
              {category.title}
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
