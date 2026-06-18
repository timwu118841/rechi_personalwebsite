import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCategories, getPages, getPosts } = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getPages: vi.fn(),
  getPosts: vi.fn(),
}))

vi.mock('@/lib/content', () => ({
  getCategories,
  getPages,
  getPosts,
}))

import {
  categoryStaticParams,
  localeStaticParams,
  pageStaticParams,
  postStaticParams,
} from '@/lib/static-params'

describe('frontend static generation params', () => {
  beforeEach(() => {
    getCategories.mockReset()
    getPages.mockReset()
    getPosts.mockReset()
  })

  it('prebuilds locale home pages', () => {
    expect(localeStaticParams()).toEqual([{ locale: 'zh-Hant' }, { locale: 'en' }])
  })

  it('prebuilds post detail pages for every locale', async () => {
    getPosts
      .mockResolvedValueOnce([{ slug: '測試文章' }, { slug: undefined }, { slug: '' }])
      .mockResolvedValueOnce([{ slug: 'test-post' }])

    await expect(postStaticParams()).resolves.toEqual([
      { locale: 'zh-Hant', slug: '測試文章' },
      { locale: 'en', slug: 'test-post' },
    ])
    expect(getPosts).toHaveBeenCalledWith('zh-Hant', { limit: 1000, staticParams: true })
  })

  it('prebuilds category archive pages for every locale', async () => {
    getCategories
      .mockResolvedValueOnce([{ slug: '家事民事' }, { slug: undefined }, { slug: '' }])
      .mockResolvedValueOnce([{ slug: 'corporate' }])

    await expect(categoryStaticParams()).resolves.toEqual([
      { locale: 'zh-Hant', slug: '家事民事' },
      { locale: 'en', slug: 'corporate' },
    ])
  })

  it('prebuilds fixed pages except home and reserved routes', async () => {
    getPages
      .mockResolvedValueOnce([
        { slug: 'home' },
        { slug: '關於律師' },
        { slug: 'search' },
        { slug: undefined },
        { slug: '' },
      ])
      .mockResolvedValueOnce([{ slug: 'privacy' }])

    await expect(pageStaticParams()).resolves.toEqual([
      { locale: 'zh-Hant', slug: '關於律師' },
      { locale: 'en', slug: 'privacy' },
    ])
  })
})
