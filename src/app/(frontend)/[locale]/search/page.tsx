import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PostCard } from '@/components/blog/PostCard'
import { getPosts } from '@/lib/content'
import { copy, isLocale } from '@/lib/i18n'

export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const { q = '' } = await searchParams
  const query = q.trim()
  const posts = query ? await getPosts(locale, { query }) : []
  const t = copy[locale]

  return (
    <section className="content-section search-page">
      <h1>{t.searchTitle}</h1>
      <form action={`/${locale}/search`} className="search-form">
        <input
          aria-label={t.searchPlaceholder}
          defaultValue={query}
          name="q"
          placeholder={t.searchPlaceholder}
          type="search"
        />
        <button type="submit">{t.nav.search}</button>
      </form>
      {query &&
        (posts.length ? (
          <div className="post-list">
            {posts.map((post) => <PostCard key={post.id} locale={locale} post={post} />)}
          </div>
        ) : (
          <p className="empty-state">{t.noResults}</p>
        ))}
    </section>
  )
}
