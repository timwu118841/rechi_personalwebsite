import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCategories, getPosts, getSiteSettings } = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getPosts: vi.fn(),
  getSiteSettings: vi.fn(),
}))

vi.mock('@/lib/content', () => ({
  getCategories,
  getPosts,
  getSiteSettings,
}))

import LocaleHome from '@/app/(frontend)/[locale]/page'

describe('localized homepage', () => {
  beforeEach(() => {
    getCategories.mockResolvedValue([])
    getSiteSettings.mockResolvedValue(null)
    getPosts.mockImplementation(
      (_locale: string, options: { featured?: boolean } = {}) =>
        Promise.resolve(
          options.featured
            ? []
            : [
                {
                  id: 1,
                  title: '一般文章',
                  slug: 'regular-post',
                  excerpt: '這篇文章沒有設定為精選。',
                  content: null,
                  createdAt: '2026-06-13T00:00:00.000Z',
                },
              ],
        ),
    )
  })

  it('does not render the featured section when no post is marked as featured', async () => {
    const page = await LocaleHome({ params: Promise.resolve({ locale: 'zh-Hant' }) })
    const html = renderToStaticMarkup(page)

    expect(html).not.toContain('精選文章')
    expect(html).toContain('一般文章')
  })

  it('uses the localized homepage hero title from site settings', async () => {
    getSiteSettings.mockResolvedValue({
      homepageHeroTitle: '後台設定的首頁標題',
    })

    const page = await LocaleHome({ params: Promise.resolve({ locale: 'zh-Hant' }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('後台設定的首頁標題')
    expect(html).not.toContain('把複雜的法律，寫成值得閱讀的經驗。')
  })

  it('falls back to the existing localized title when the setting is empty', async () => {
    getSiteSettings.mockResolvedValue({ homepageHeroTitle: '' })

    const page = await LocaleHome({ params: Promise.resolve({ locale: 'zh-Hant' }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('把複雜的法律，寫成值得閱讀的經驗。')
  })
})
