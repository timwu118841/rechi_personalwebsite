import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPostBySlug, getPosts, getSiteSettings } = vi.hoisted(() => ({
  getPostBySlug: vi.fn(),
  getPosts: vi.fn(),
  getSiteSettings: vi.fn(),
}))

vi.mock('@/lib/content', () => ({
  getPostBySlug,
  getPosts,
  getSiteSettings,
}))

vi.mock('@/components/RichText', () => ({
  default: () => createElement('div', { className: 'article-body' }),
}))

import PostPage from '@/app/(frontend)/[locale]/posts/[slug]/page'
import { PostCard } from '@/components/blog/PostCard'

const content = {
  root: {
    type: 'root',
    children: [],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
}

const post = {
  id: 1,
  title: '封面圖片測試',
  slug: 'cover-image-test',
  excerpt: '確認封面圖片會顯示。',
  content,
  heroImage: {
    id: 10,
    alt: '文章封面替代文字',
    url: '/api/media/file/cover.jpg',
    width: 1200,
    height: 630,
    updatedAt: '2026-06-13T00:00:00.000Z',
    createdAt: '2026-06-13T00:00:00.000Z',
  },
  categories: [],
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
}

describe('post cover images', () => {
  beforeEach(() => {
    getPostBySlug.mockResolvedValue(post)
    getPosts.mockResolvedValue([])
    getSiteSettings.mockResolvedValue(null)
  })

  it('does not automatically render the article cover image in a post card', () => {
    const html = renderToStaticMarkup(
      createElement(PostCard, { locale: 'zh-Hant', post: post as never }),
    )

    expect(html).not.toContain('文章封面替代文字')
    expect(html).not.toContain('post-card-cover')
    expect(html).not.toContain('<img')
  })

  it('renders the configured cover image between the article header and body', async () => {
    const page = await PostPage({
      params: Promise.resolve({ locale: 'zh-Hant', slug: post.slug }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('article-cover')
    expect(html).toContain('文章封面替代文字')
  })

  it('does not render an empty media container when no article cover is configured', () => {
    const html = renderToStaticMarkup(
      createElement(PostCard, {
        locale: 'zh-Hant',
        post: { ...post, heroImage: null } as never,
      }),
    )

    expect(html).not.toContain('post-card-cover')
    expect(html).not.toContain('<img')
  })
})
