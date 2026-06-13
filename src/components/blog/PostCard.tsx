import Link from 'next/link'

import type { Post } from '@/payload-types'
import { calculateReadingMinutes } from '@/lib/reading-time'
import { copy, type Locale } from '@/lib/i18n'

function categoryTitle(post: Post): string | undefined {
  const first = post.categories?.[0]
  return typeof first === 'object' && first ? first.title : undefined
}

export function PostCard({ post, locale, featured = false }: { post: Post; locale: Locale; featured?: boolean }) {
  const t = copy[locale]
  return (
    <article className={featured ? 'post-card post-card-featured' : 'post-card'}>
      <div className="post-kicker">
        {categoryTitle(post)}
        {categoryTitle(post) ? ' · ' : ''}
        {calculateReadingMinutes(post.content, locale)} {t.minutes}
      </div>
      <h2>
        <Link href={`/${locale}/posts/${post.slug}`}>{post.title}</Link>
      </h2>
      <p>{post.excerpt}</p>
      <div className="post-meta">
        <time dateTime={post.publishedAt || post.createdAt}>
          {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
            new Date(post.publishedAt || post.createdAt),
          )}
        </time>
        <Link href={`/${locale}/posts/${post.slug}`}>{t.readMore} →</Link>
      </div>
    </article>
  )
}
