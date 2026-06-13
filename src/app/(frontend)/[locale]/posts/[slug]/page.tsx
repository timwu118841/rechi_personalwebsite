import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import RichText from '@/components/RichText'
import { PostCard } from '@/components/blog/PostCard'
import { getPostBySlug, getPosts, getSiteSettings } from '@/lib/content'
import { calculateReadingMinutes } from '@/lib/reading-time'
import { articleJsonLd, postMetadata } from '@/lib/seo'
import { copy, isLocale } from '@/lib/i18n'
import type { Category } from '@/payload-types'

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const [post, settings] = await Promise.all([
    getPostBySlug(locale, slug),
    getSiteSettings(locale),
  ])
  if (!post) return {}
  const otherLocale = locale === 'zh-Hant' ? 'en' : 'zh-Hant'
  const translated = await getPostBySlug(otherLocale, slug)
  return postMetadata(post, locale, settings, Boolean(translated))
}

export default async function PostPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const [post, settings] = await Promise.all([
    getPostBySlug(locale, slug),
    getSiteSettings(locale),
  ])
  if (!post) notFound()

  const categories = (post.categories || []).filter(
    (category): category is Category => typeof category === 'object' && category !== null,
  )
  const t = copy[locale]
  const jsonLd = articleJsonLd(post, locale, settings)
  const related = categories[0]?.slug
    ? (await getPosts(locale, { category: categories[0].slug, limit: 4 }))
        .filter((item) => item.id !== post.id)
        .slice(0, 3)
    : []

  return (
    <article className="article">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        type="application/ld+json"
      />
      <header className="article-header">
        <div className="post-kicker">
          {categories.map((category, index) => (
            <span key={category.id}>
              {index > 0 ? '、' : ''}
              <Link href={`/${locale}/categories/${category.slug}`}>{category.title}</Link>
            </span>
          ))}
          {categories.length ? ' · ' : ''}
          {calculateReadingMinutes(post.content, locale)} {t.minutes}
        </div>
        <h1>{post.title}</h1>
        <p className="article-excerpt">{post.excerpt}</p>
        <div className="byline">
          <span>{settings?.authorName || '作者姓名'}</span>
          <time dateTime={post.publishedAt || post.createdAt}>
            {new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
              new Date(post.publishedAt || post.createdAt),
            )}
          </time>
          <span>
            {t.updated}{' '}
            {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
              new Date(post.updatedAt),
            )}
          </span>
        </div>
      </header>

      <RichText className="article-body" data={post.content} enableGutter={false} />

      <aside className="disclaimer">
        <strong>{t.disclaimerTitle}</strong>
        <p>
          {settings?.disclaimer ||
            (locale === 'zh-Hant'
              ? '本文為一般性法律資訊與經驗分享，不構成個案法律意見或委任關係。'
              : 'This article provides general legal information and does not create legal advice or an attorney-client relationship.')}
        </p>
      </aside>

      {related.length > 0 && (
        <section className="content-section related-posts">
          <h2 className="section-title">
            {locale === 'zh-Hant' ? '相關文章' : 'Related stories'}
          </h2>
          <div className="post-list">
            {related.map((item) => <PostCard key={item.id} locale={locale} post={item} />)}
          </div>
        </section>
      )}
    </article>
  )
}
