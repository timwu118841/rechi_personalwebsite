import { notFound } from 'next/navigation'

import { PostCard } from '@/components/blog/PostCard'
import { getCategories, getPosts } from '@/lib/content'
import { copy, isLocale } from '@/lib/i18n'

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const [posts, categories] = await Promise.all([
    getPosts(locale, { category: slug }),
    getCategories(locale),
  ])
  const category = categories.find((item) => item.slug === slug)
  if (!category) notFound()

  return (
    <section className="content-section archive-page">
      <p className="post-kicker">{copy[locale].categories}</p>
      <h1>{category.title}</h1>
      {posts.length ? (
        <div className="post-list">
          {posts.map((post) => <PostCard key={post.id} locale={locale} post={post} />)}
        </div>
      ) : (
        <p className="empty-state">{copy[locale].noPosts}</p>
      )}
    </section>
  )
}
