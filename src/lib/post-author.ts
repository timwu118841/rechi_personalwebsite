import type { Post } from '@/payload-types'

import type { Locale } from './i18n'

type PostAuthors = Pick<Post, 'populatedAuthors'>

export function resolvePostAuthorName(
  post: PostAuthors,
  fallback: string,
  locale: Locale = 'zh-Hant',
): string {
  const names =
    post.populatedAuthors
      ?.map((author) => author.name?.trim())
      .filter((name): name is string => Boolean(name)) ?? []

  return names.length > 0 ? names.join(locale === 'zh-Hant' ? '、' : ', ') : fallback
}
